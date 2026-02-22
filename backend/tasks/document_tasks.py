import sys
import os
from pathlib import Path
from typing import Optional
from celery import Task
from celery.exceptions import SoftTimeLimitExceeded
import logging

# 添加DISK模块路径
disk_path = Path(__file__).resolve().parent.parent.parent / "DISK"
sys.path.insert(0, str(disk_path))

from backend.tasks.celery_app import celery_app
from backend.db.neo4j import Neo4jRepository
from backend.db.session import SessionLocal
from backend.models.database import Document as DBDocument, Task as DBTask, KnowledgeGraph as DBKnowledgeGraph
from backend.models.schemas import TaskStatus

# 导入DISK模块
from disk import DISK
from config.llm import llm, embeddings
from models.knowledge_graph import KnowledgeGraph

logger = logging.getLogger(__name__)


class CallbackTask(Task):
    """支持回调的Celery任务基类"""
    _callback = None

    def __init__(self):
        self.neo4j_repo = Neo4jRepository()


def update_task_progress(task_id: str, progress: float, current_step: str, message: str, status: Optional[TaskStatus] = None, entities_count: int = 0, relations_count: int = 0):
    """更新任务进度到数据库"""
    db = SessionLocal()
    try:
        task = db.query(DBTask).filter(DBTask.id == task_id).first()
        if task:
            task.progress = progress
            task.current_step = current_step
            task.message = message
            task.entities_count = entities_count
            task.relations_count = relations_count
            if status:
                task.status = status
            db.commit()
    except Exception as e:
        logger.error(f"Failed to update task progress: {e}")
        db.rollback()
    finally:
        db.close()


def load_knowledge_from_neo4j() -> KnowledgeGraph:
    """从Neo4j加载现有知识图谱

    注意：当前DISK的KnowledgeGraph是内存结构，Neo4j connector是单向写入
    这里我们创建一个空的KG，让DISK做增量处理
    """
    # 由于DISK的Neo4jConnector是单向写入，我们需要通过其他方式实现增量
    # 暂时返回空KG，依赖后续的合并逻辑
    return KnowledgeGraph()


def update_graph_stats(graph_id: str, db: SessionLocal):
    """更新知识图谱的统计信息"""
    try:
        # 获取图谱下所有已完成任务的实体和关系统计
        from sqlalchemy import func

        # 获取该图谱下的文档ID列表
        doc_ids = db.query(DBDocument.id).filter(DBDocument.graph_id == graph_id).all()
        doc_ids = [d[0] for d in doc_ids]

        if not doc_ids:
            return

        # 获取这些文档关联的最新任务的统计
        stats = db.query(
            func.sum(DBTask.entities_count).label('entities'),
            func.sum(DBTask.relations_count).label('relations')
        ).join(
            DBDocument, DBDocument.id == DBTask.document_id
        ).filter(
            DBDocument.graph_id == graph_id,
            DBTask.status == TaskStatus.COMPLETED
        ).first()

        entity_count = stats.entities or 0
        relation_count = stats.relations or 0

        # 更新知识图谱的统计信息
        graph = db.query(DBKnowledgeGraph).filter(DBKnowledgeGraph.id == graph_id).first()
        if graph:
            graph.entity_count = int(entity_count)
            graph.relation_count = int(relation_count)
            graph.document_count = len(doc_ids)
            db.commit()

    except Exception as e:
        logger.error(f"Failed to update graph stats: {e}")


@celery_app.task(base=CallbackTask, name="backend.tasks.document_tasks.process_document", bind=True)
def process_document(self, document_id: str, file_path: str, task_id: str):
    """处理文档，构建知识图谱

    Args:
        document_id: 文档ID
        file_path: PDF文件路径
        task_id: 数据库任务ID
    """
    db = SessionLocal()
    graph_id = None
    try:
        # 获取文档信息，获取关联的知识图谱
        document = db.query(DBDocument).filter(DBDocument.id == document_id).first()
        if not document:
            raise Exception(f"文档不存在: {document_id}")

        graph_id = document.graph_id
        graph = None
        if graph_id:
            graph = db.query(DBKnowledgeGraph).filter(DBKnowledgeGraph.id == graph_id).first()
            if graph:
                logger.info(f"Processing document for graph: {graph.name}")

        # 更新任务状态为处理中
        update_task_progress(task_id, 0.0, "初始化", f"准备处理文档{' (图谱: ' + graph.name + ')' if graph else ''}...", TaskStatus.PROCESSING)

        # 初始化DISK实例（每个任务独立实例）
        kg = load_knowledge_from_neo4j()
        disk = DISK(llm=llm, embeddings=embeddings, kg=kg)

        # Step 1: 蒸馏PDF文本 (10%)
        self.update_state(state="PROGRESS", meta={"step": "distilling", "progress": 0.1})
        update_task_progress(task_id, 0.1, "蒸馏文本", "正在从PDF提取文本块...")

        # 使用DISK的PDFDistiller
        from distiller import PDFDistiller
        distiller = PDFDistiller()
        texts = distiller.extract_text_blocks(file_path)

        if not texts:
            raise Exception("无法从PDF提取文本内容")

        total_blocks = len(texts)
        logger.info(f"Extracted {total_blocks} text blocks from PDF")

        # Step 2: 抽取实体和关系 (10% - 80%)
        update_task_progress(task_id, 0.15, "抽取知识", f"开始处理 {total_blocks} 个文本块...")

        from extractor import Extractor
        from merger import Merger

        extractor = Extractor(llm=llm, embeddings=embeddings)
        merger = Merger()

        all_entities = []
        all_relations = []

        for i, text in enumerate(texts):
            try:
                # 检查超时
                if self.request.called_directly:
                    raise SoftTimeLimitExceeded()

                # 抽取实体和关系
                result = extractor.extract_relations_and_entities(text)
                if result is None:
                    continue

                relations, entities = result

                # 合并到已有知识图谱
                if len(all_entities) > 0 and len(all_relations) > 0:
                    all_relations, all_entities = merger.merge(
                        entities1=all_entities,
                        relations1=all_relations,
                        entities2=entities,
                        relations2=relations
                    )
                else:
                    all_entities = entities
                    all_relations = relations

                # 更新进度 (15% - 80%)
                progress = 0.15 + (i + 1) / total_blocks * 0.65
                update_task_progress(
                    task_id,
                    progress,
                    "抽取知识",
                    f"正在处理第 {i + 1}/{total_blocks} 个文本块...",
                    entities_count=len(all_entities),
                    relations_count=len(all_relations)
                )

                # 每处理完一个block更新一次Celery状态
                self.update_state(
                    state="PROGRESS",
                    meta={
                        "step": "extracting",
                        "progress": progress,
                        "current": i + 1,
                        "total": total_blocks,
                        "entities_count": len(all_entities),
                        "relations_count": len(all_relations)
                    }
                )

            except Exception as e:
                logger.error(f"Error processing block {i}: {e}")
                continue

        # Step 3: 构建知识图谱 (80% - 90%)
        update_task_progress(task_id, 0.85, "构建图谱", "正在整合实体和关系...")

        from manager import KGManager
        kg_manager = KGManager(kg=kg)
        kg_manager.add_entities(all_entities)
        kg_manager.add_relations(all_relations)

        final_kg = kg_manager.kg
        logger.info(f"Knowledge graph built: {len(final_kg.entities)} entities, {len(final_kg.relations)} relations")

        # Step 4: 持久化到Neo4j (90% - 100%)
        update_task_progress(task_id, 0.9, "保存图谱", "正在写入Neo4j数据库...")

        from models.neo4j_connector import Neo4jConnector
        from backend.core.config import settings

        connector = Neo4jConnector(
            uri=settings.NEO4J_URI,
            user=settings.NEO4J_USER,
            password=settings.NEO4J_PASSWORD
        )
        connector.create_entities(final_kg.entities)
        connector.create_relations(final_kg.relations)
        connector.close()

        # 更新为完成状态
        update_task_progress(
            task_id,
            1.0,
            "完成",
            f"知识图谱构建完成！实体数: {len(final_kg.entities)}, 关系数: {len(final_kg.relations)}",
            TaskStatus.COMPLETED
        )

        # 更新文档状态
        document = db.query(DBDocument).filter(DBDocument.id == document_id).first()
        if document:
            document.status = TaskStatus.COMPLETED
            db.commit()

        # 更新知识图谱统计信息
        if graph_id:
            update_graph_stats(graph_id, db)

        return {
            "status": "completed",
            "entities_count": len(final_kg.entities),
            "relations_count": len(final_kg.relations)
        }

    except SoftTimeLimitExceeded:
        error_msg = "任务超时"
        update_task_progress(task_id, 0, "失败", error_msg, TaskStatus.FAILED)
        document = db.query(DBDocument).filter(DBDocument.id == document_id).first()
        if document:
            document.status = TaskStatus.FAILED
            db.commit()
        logger.error(f"Task {task_id} timed out")
        raise

    except Exception as e:
        error_msg = f"处理失败: {str(e)}"
        update_task_progress(task_id, 0, "失败", error_msg, TaskStatus.FAILED)
        document = db.query(DBDocument).filter(DBDocument.id == document_id).first()
        if document:
            document.status = TaskStatus.FAILED
            db.commit()
        logger.error(f"Task {task_id} failed: {e}", exc_info=True)
        raise

    finally:
        db.close()


@celery_app.task(name="backend.tasks.document_tasks.delete_document")
def delete_document_from_kg(document_id: str):
    """从知识图谱中删除与文档相关的数据

    注意：由于当前架构中实体关系没有标记来源文档，
    这个功能暂时只是标记，实际删除需要更复杂的追踪
    """
    # TODO: 实现基于文档的实体/关系删除
    logger.info(f"Delete document {document_id} from KG (not implemented yet)")
    return {"status": "not_implemented"}
