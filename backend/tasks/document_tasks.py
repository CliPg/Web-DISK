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
from models.neo4j_connector import Neo4jConnector

logger = logging.getLogger(__name__)


class CallbackTask(Task):
    """支持回调的Celery任务基类"""
    _callback = None

    def __init__(self):
        self.neo4j_repo = Neo4jRepository()


def update_task_progress(task_id: str, progress: float, current_step: str, message: str, status: Optional[TaskStatus] = None, entities_count: int = 0, relations_count: int = 0, input_tokens: int = 0, output_tokens: int = 0):
    """更新任务进度到数据库"""
    from datetime import datetime

    db = SessionLocal()
    try:
        task = db.query(DBTask).filter(DBTask.id == task_id).first()
        if task:
            task.progress = progress
            task.current_step = current_step
            task.message = message
            task.entities_count = entities_count
            task.relations_count = relations_count
            task.input_tokens = input_tokens
            task.output_tokens = output_tokens
            if status:
                task.status = status
                # 任务完成或失败时，设置 completed_at 时间
                if status in [TaskStatus.COMPLETED, TaskStatus.FAILED]:
                    task.completed_at = datetime.utcnow()
            db.commit()
    except Exception as e:
        logger.error(f"Failed to update task progress: {e}")
        db.rollback()
    finally:
        db.close()


def load_knowledge_from_neo4j(graph_id: str = None) -> KnowledgeGraph:
    """从Neo4j加载指定知识图谱的已有数据，用于增量构建

    Args:
        graph_id: 知识图谱ID，如果为None则返回空KG

    Returns:
        KnowledgeGraph: 包含已有实体和关系的知识图谱
    """
    from neo4j import GraphDatabase
    from backend.core.config import settings
    from models.knowledge_graph import Entity, Relation

    # 如果没有graph_id，返回空KG
    if not graph_id:
        return KnowledgeGraph()

    kg = KnowledgeGraph()

    try:
        driver = GraphDatabase.driver(
            settings.NEO4J_URI,
            auth=(settings.NEO4J_USER, settings.NEO4J_PASSWORD)
        )

        with driver.session() as session:
            # 加载该图谱的所有实体
            entity_query = """
                MATCH (n {graph_id: $graph_id})
                RETURN labels(n)[0] as label, n.name as name, n.embedding as embedding
            """
            entity_result = session.run(entity_query, {"graph_id": graph_id})
            for record in entity_result:
                entity = Entity(
                    label=record["label"] or "Entity",
                    name=record["name"],
                    embedding=record["embedding"]
                )
                kg.entities.append(entity)

            # 加载该图谱的所有关系
            # 需要重新构建Entity对象作为关系的起点和终点
            entity_map = {e.name: e for e in kg.entities}

            relation_query = """
                MATCH (a {graph_id: $graph_id})-[r]->(b {graph_id: $graph_id})
                RETURN labels(a)[0] as start_label, a.name as start_name,
                       labels(b)[0] as end_label, b.name as end_name,
                       type(r) as label, r.name as name, r.embedding as embedding
            """
            relation_result = session.run(relation_query, {"graph_id": graph_id})
            for record in relation_result:
                start_entity = entity_map.get(record["start_name"])
                end_entity = entity_map.get(record["end_name"])

                if start_entity and end_entity:
                    relation = Relation(
                        start_entity=start_entity,
                        end_entity=end_entity,
                        label=record["label"] or "RELATION",
                        name=record["name"],
                        embedding=record["embedding"]
                    )
                    kg.relations.append(relation)

        driver.close()
        logger.info(f"Loaded knowledge graph {graph_id}: {len(kg.entities)} entities, {len(kg.relations)} relations")

    except Exception as e:
        logger.error(f"Failed to load knowledge graph from Neo4j: {e}")

    return kg


def update_graph_stats(graph_id: str, db: SessionLocal):
    """更新知识图谱的统计信息（直接从Neo4j获取实际数量）"""
    try:
        from backend.db.neo4j import Neo4jRepository

        # 从 Neo4j 获取实际的实体和关系数量
        neo4j_repo = Neo4jRepository()
        stats = neo4j_repo.get_stats(graph_id=graph_id)

        entity_count = stats.get('total_entities', 0)
        relation_count = stats.get('total_relations', 0)

        # 获取该图谱下的文档数量
        doc_count = db.query(DBDocument).filter(DBDocument.graph_id == graph_id).count()

        # 更新知识图谱的统计信息
        graph = db.query(DBKnowledgeGraph).filter(DBKnowledgeGraph.id == graph_id).first()
        if graph:
            graph.entity_count = int(entity_count)
            graph.relation_count = int(relation_count)
            graph.document_count = doc_count
            db.commit()
            logger.info(f"Updated graph {graph_id} stats: {entity_count} entities, {relation_count} relations, {doc_count} documents")

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
        # 从Neo4j加载该图谱的已有数据，实现增量构建
        kg = load_knowledge_from_neo4j(graph_id)
        original_entity_count = len(kg.entities)
        original_relation_count = len(kg.relations)

        disk = DISK(llm=llm, embeddings=embeddings, kg=kg)

        # 使用 DISK 的 build_knowledge_graph 方法（并行模式）
        update_task_progress(task_id, 0.1, "构建知识图谱", "正在提取文本并构建知识图谱...")

        final_kg = disk.build_knowledge_graph(
            pdf_path=file_path,
            mode="parallel"  # 使用并行模式，提升处理速度
        )

        logger.info(f"Knowledge graph built: {len(final_kg.entities)} entities, {len(final_kg.relations)} relations")

        # 获取 Token 使用统计
        token_summary = disk.get_token_summary()
        input_tokens = 0
        output_tokens = 0
        if token_summary:
            input_tokens = token_summary.get('total_input_tokens', 0)
            output_tokens = token_summary.get('total_output_tokens', 0)
            logger.info(f"Token usage - Input: {input_tokens}, Output: {output_tokens}, Total: {input_tokens + output_tokens}")

        # 计算新增的实体和关系（用于持久化）
        new_entities = final_kg.entities[original_entity_count:]
        new_relations = final_kg.relations[original_relation_count:]

        logger.info(f"New entities: {len(new_entities)}, new relations: {len(new_relations)}")

        # 持久化到Neo4j（只保存新增的实体和关系）
        update_task_progress(task_id, 0.9, "保存图谱", "正在写入Neo4j数据库...", input_tokens=input_tokens, output_tokens=output_tokens)

        from backend.core.config import settings

        # 传入 graph_id 实现数据隔离
        connector = Neo4jConnector(
            uri=settings.NEO4J_URI,
            user=settings.NEO4J_USER,
            password=settings.NEO4J_PASSWORD,
            graph_id=graph_id
        )
        connector.create_entities(new_entities)
        connector.create_relations(new_relations)
        connector.close()

        # 更新为完成状态
        update_task_progress(
            task_id,
            1.0,
            "完成",
            f"知识图谱构建完成！实体数: {len(final_kg.entities)}, 关系数: {len(final_kg.relations)}",
            TaskStatus.COMPLETED,
            entities_count=len(final_kg.entities),
            relations_count=len(final_kg.relations),
            input_tokens=input_tokens,
            output_tokens=output_tokens
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
