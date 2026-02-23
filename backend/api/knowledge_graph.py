from fastapi import APIRouter, Depends, Query
from backend.models.schemas import KnowledgeGraphStats, EntityResponse, RelationResponse
from backend.db.neo4j import Neo4jRepository
from typing import Optional

router = APIRouter(prefix="/knowledge-graph", tags=["knowledge-graph"])

neo4j_repo = Neo4jRepository()


@router.get("/stats")
async def get_kg_stats(
    graph_id: Optional[str] = Query(None, description="知识图谱ID，不传则返回全局统计")
):
    """获取知识图谱统计信息"""
    try:
        stats = neo4j_repo.get_stats(graph_id=graph_id)
        return KnowledgeGraphStats(**stats)
    except Exception as e:
        return KnowledgeGraphStats(
            total_entities=0,
            total_relations=0,
            entity_types={},
            relation_types={}
        )


@router.get("/entities")
async def get_entities(
    graph_id: str = Query(..., description="知识图谱ID"),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
):
    """获取指定知识图谱的实体列表"""
    try:
        entities = neo4j_repo.get_entities(graph_id=graph_id, limit=limit, offset=offset)
        return {"entities": entities, "total": len(entities)}
    except Exception as e:
        return {"entities": [], "total": 0}


@router.get("/relations")
async def get_relations(
    graph_id: str = Query(..., description="知识图谱ID"),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
):
    """获取指定知识图谱的关系列表"""
    try:
        relations = neo4j_repo.get_relations(graph_id=graph_id, limit=limit, offset=offset)
        return {"relations": relations, "total": len(relations)}
    except Exception as e:
        return {"relations": [], "total": 0}


@router.post("/clear")
async def clear_kg():
    """清空所有知识图谱数据（危险操作）"""
    try:
        neo4j_repo.clear_all()
        return {"message": "知识图谱已清空"}
    except Exception as e:
        return {"error": str(e)}
