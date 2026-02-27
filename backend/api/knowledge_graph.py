from fastapi import APIRouter, Depends, Query, HTTPException
from backend.models.schemas import KnowledgeGraphStats, EntityResponse, RelationResponse
from backend.db.neo4j import Neo4jRepository
from backend.services.embedding import aget_embedding
from typing import Optional
from pydantic import BaseModel

router = APIRouter(prefix="/knowledge-graph", tags=["knowledge-graph"])

neo4j_repo = Neo4jRepository()


class SearchRequest(BaseModel):
    """语义搜索请求"""
    query: str
    graph_id: str
    limit: Optional[int] = 10


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
    order_by_relation_count: bool = Query(False, description="是否按关系数量降序排序"),
):
    """获取指定知识图谱的实体列表"""
    try:
        entities = neo4j_repo.get_entities(
            graph_id=graph_id,
            limit=limit,
            offset=offset,
            order_by_relation_count=order_by_relation_count
        )
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


@router.get("/search")
async def search_knowledge_graph(
    graph_id: str = Query(..., description="知识图谱ID"),
    query: str = Query(..., description="搜索关键词"),
    search_type: str = Query("all", description="搜索类型: all/entity/relation"),
    limit: int = Query(20, ge=1, le=100, description="返回数量限制")
):
    """搜索知识图谱（模糊搜索）"""
    try:
        if not query.strip():
            return {"results": [], "total": 0}

        results = neo4j_repo.search_entities(
            graph_id=graph_id,
            query=query,
            limit=limit,
            search_type=search_type
        )

        return {"results": results, "total": len(results)}
    except Exception as e:
        return {"results": [], "total": 0, "error": str(e)}


@router.post("/search/similar")
async def search_similar_entities(request: SearchRequest):
    """基于语义相似度搜索实体（用于搜索联想）"""
    try:
        # 生成查询文本的 embedding
        query_embedding = await aget_embedding(request.query)

        if not query_embedding:
            return {"results": [], "total": 0}

        results = neo4j_repo.search_by_similarity(
            graph_id=request.graph_id,
            query_embedding=query_embedding,
            limit=request.limit
        )

        return {"results": results, "total": len(results)}
    except Exception as e:
        return {"results": [], "total": 0, "error": str(e)}


@router.get("/entities/{entity_id}/related")
async def get_entity_relations(
    entity_id: str,
    graph_id: str = Query(..., description="知识图谱ID"),
    depth: int = Query(1, ge=1, le=3, description="关联深度")
):
    """获取指定实体的关联实体"""
    try:
        related = neo4j_repo.get_related_entities(
            graph_id=graph_id,
            entity_id=entity_id,
            depth=depth
        )

        return {"related_entities": related, "total": len(related)}
    except Exception as e:
        return {"related_entities": [], "total": 0, "error": str(e)}
