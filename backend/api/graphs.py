from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional
import logging

from backend.core.dependencies import get_db
from backend.models.database import KnowledgeGraph as DBKnowledgeGraph, Document as DBDocument, Task as DBTask
from backend.models.schemas import (
    KnowledgeGraphCreate,
    KnowledgeGraphUpdate,
    KnowledgeGraphResponse,
    KnowledgeGraphListResponse,
)
from backend.db.neo4j import Neo4jRepository
from backend.core.config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/graphs", tags=["graphs"])


def ensure_default_graph(db: Session) -> DBKnowledgeGraph:
    """确保存在默认知识图谱"""
    default_graph = db.query(DBKnowledgeGraph).filter(DBKnowledgeGraph.is_default == True).first()
    if not default_graph:
        default_graph = DBKnowledgeGraph(
            name="默认知识图谱",
            description="系统默认的知识图谱",
            is_default=True,
            entity_count=0,
            relation_count=0,
            document_count=0,
        )
        db.add(default_graph)
        db.commit()
        db.refresh(default_graph)
        logger.info("Created default knowledge graph")
    return default_graph


@router.get("", response_model=KnowledgeGraphListResponse)
async def list_graphs(
    db: Session = Depends(get_db),
):
    """获取知识图谱列表"""
    # 确保存在默认图谱
    ensure_default_graph(db)

    graphs = db.query(DBKnowledgeGraph).order_by(
        DBKnowledgeGraph.is_default.desc(),
        DBKnowledgeGraph.created_at.desc()
    ).all()

    return KnowledgeGraphListResponse(
        graphs=[KnowledgeGraphResponse.model_validate(g) for g in graphs]
    )


@router.post("", response_model=KnowledgeGraphResponse)
async def create_graph(
    graph_data: KnowledgeGraphCreate,
    db: Session = Depends(get_db),
):
    """创建知识图谱"""
    # 检查名称是否已存在
    existing = db.query(DBKnowledgeGraph).filter(
        DBKnowledgeGraph.name == graph_data.name
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="知识图谱名称已存在")

    # 创建新知识图谱
    graph = DBKnowledgeGraph(
        name=graph_data.name,
        description=graph_data.description,
        is_default=False,
        entity_count=0,
        relation_count=0,
        document_count=0,
    )
    db.add(graph)
    db.commit()
    db.refresh(graph)

    logger.info(f"Created knowledge graph: {graph.id} - {graph.name}")
    return KnowledgeGraphResponse.model_validate(graph)


@router.get("/{graph_id}", response_model=KnowledgeGraphResponse)
async def get_graph(
    graph_id: str,
    db: Session = Depends(get_db),
):
    """获取知识图谱详情"""
    graph = db.query(DBKnowledgeGraph).filter(DBKnowledgeGraph.id == graph_id).first()

    if not graph:
        raise HTTPException(status_code=404, detail="知识图谱不存在")

    return KnowledgeGraphResponse.model_validate(graph)


@router.patch("/{graph_id}", response_model=KnowledgeGraphResponse)
async def update_graph(
    graph_id: str,
    graph_data: KnowledgeGraphUpdate,
    db: Session = Depends(get_db),
):
    """更新知识图谱"""
    graph = db.query(DBKnowledgeGraph).filter(DBKnowledgeGraph.id == graph_id).first()

    if not graph:
        raise HTTPException(status_code=404, detail="知识图谱不存在")

    # 不允许修改默认图谱的名称
    if graph.is_default and graph_data.name and graph_data.name != graph.name:
        raise HTTPException(status_code=400, detail="不允许修改默认知识图谱的名称")

    # 检查名称是否重复
    if graph_data.name and graph_data.name != graph.name:
        existing = db.query(DBKnowledgeGraph).filter(
            DBKnowledgeGraph.name == graph_data.name,
            DBKnowledgeGraph.id != graph_id
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="知识图谱名称已存在")

    # 更新字段
    if graph_data.name is not None:
        graph.name = graph_data.name
    if graph_data.description is not None:
        graph.description = graph_data.description

    db.commit()
    db.refresh(graph)

    logger.info(f"Updated knowledge graph: {graph_id}")
    return KnowledgeGraphResponse.model_validate(graph)


@router.delete("/{graph_id}")
async def delete_graph(
    graph_id: str,
    db: Session = Depends(get_db),
):
    """删除知识图谱"""
    graph = db.query(DBKnowledgeGraph).filter(DBKnowledgeGraph.id == graph_id).first()

    if not graph:
        raise HTTPException(status_code=404, detail="知识图谱不存在")

    # 不允许删除默认图谱
    if graph.is_default:
        raise HTTPException(status_code=400, detail="不允许删除默认知识图谱")

    # 检查是否有关联文档
    doc_count = db.query(DBDocument).filter(DBDocument.graph_id == graph_id).count()
    if doc_count > 0:
        raise HTTPException(
            status_code=400,
            detail=f"该知识图谱还有 {doc_count} 个关联文档，请先删除这些文档"
        )

    # 删除图谱（级联删除会处理关联关系）
    db.delete(graph)
    db.commit()

    logger.info(f"Deleted knowledge graph: {graph_id}")
    return {"message": "知识图谱已删除"}


@router.post("/{graph_id}/set-default", response_model=KnowledgeGraphResponse)
async def set_default_graph(
    graph_id: str,
    db: Session = Depends(get_db),
):
    """设置默认知识图谱"""
    graph = db.query(DBKnowledgeGraph).filter(DBKnowledgeGraph.id == graph_id).first()

    if not graph:
        raise HTTPException(status_code=404, detail="知识图谱不存在")

    # 取消所有图谱的默认状态
    db.query(DBKnowledgeGraph).filter(
        DBKnowledgeGraph.is_default == True
    ).update({"is_default": False})

    # 设置新的默认图谱
    graph.is_default = True
    db.commit()
    db.refresh(graph)

    logger.info(f"Set default knowledge graph: {graph_id}")
    return KnowledgeGraphResponse.model_validate(graph)


@router.post("/{graph_id}/clear")
async def clear_graph(
    graph_id: str,
    db: Session = Depends(get_db),
):
    """清空知识图谱的所有实体和关系（保留图谱结构）"""
    graph = db.query(DBKnowledgeGraph).filter(DBKnowledgeGraph.id == graph_id).first()

    if not graph:
        raise HTTPException(status_code=404, detail="知识图谱不存在")

    try:
        # 清空 Neo4j 中的所有实体和关系
        neo4j_repo = Neo4jRepository()
        neo4j_repo.clear_all()
        logger.info(f"Cleared Neo4j graph data for graph: {graph_id}")

        # 获取该图谱下的所有文档
        documents = db.query(DBDocument).filter(DBDocument.graph_id == graph_id).all()

        # 重置所有文档状态为 pending
        for doc in documents:
            doc.status = "pending"
            # 删除关联的任务记录
            db.query(DBTask).filter(DBTask.document_id == doc.id).delete()

        # 更新知识图谱统计
        graph.entity_count = 0
        graph.relation_count = 0
        graph.document_count = len(documents)  # 文档数不变

        db.commit()

        logger.info(f"Cleared knowledge graph: {graph_id}, reset {len(documents)} documents")
        return {
            "message": f"已清空知识图谱，{len(documents)} 个文档已重置为待处理状态",
            "reset_documents": len(documents)
        }

    except Exception as e:
        db.rollback()
        logger.error(f"Failed to clear graph {graph_id}: {e}")
        raise HTTPException(status_code=500, detail=f"清空失败: {str(e)}")
