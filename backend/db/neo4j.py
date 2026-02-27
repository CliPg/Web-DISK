from typing import Optional
from neo4j import GraphDatabase
from backend.core.config import settings
import logging
import numpy as np

logger = logging.getLogger(__name__)


class Neo4jRepository:
    """Neo4j知识图谱仓库"""

    def __init__(self):
        self.driver = None

    def connect(self):
        """连接到Neo4j"""
        if not self.driver:
            self.driver = GraphDatabase.driver(
                settings.NEO4J_URI,
                auth=(settings.NEO4J_USER, settings.NEO4J_PASSWORD)
            )
        return self.driver

    def close(self):
        """关闭连接"""
        if self.driver:
            self.driver.close()
            self.driver = None

    def get_stats(self, graph_id: Optional[str] = None) -> dict:
        """获取知识图谱统计信息"""
        driver = self.connect()

        with driver.session() as session:
            # 根据 graph_id 过滤
            if graph_id:
                entity_query = """
                    MATCH (n {graph_id: $graph_id})
                    RETURN count(n) as total, labels(n) as labels
                """
                relation_query = """
                    MATCH (a {graph_id: $graph_id})-[r]->(b {graph_id: $graph_id})
                    RETURN count(r) as total, type(r) as type
                """
                params = {"graph_id": graph_id}
            else:
                entity_query = """
                    MATCH (n)
                    RETURN count(n) as total, labels(n) as labels
                """
                relation_query = """
                    MATCH ()-[r]->()
                    RETURN count(r) as total, type(r) as type
                """
                params = {}

            # 获取实体统计
            entity_result = session.run(entity_query, params)
            entities = entity_result.data()

            # 获取关系统计
            relation_result = session.run(relation_query, params)
            relations = relation_result.data()

        total_entities = sum(e["total"] for e in entities)
        total_relations = sum(r["total"] for r in relations)

        entity_types = {}
        for e in entities:
            for label in e.get("labels", []):
                entity_types[label] = entity_types.get(label, 0) + e["total"]

        relation_types = {}
        for r in relations:
            rel_type = r.get("type", "UNKNOWN")
            relation_types[rel_type] = relation_types.get(rel_type, 0) + r["total"]

        return {
            "total_entities": total_entities,
            "total_relations": total_relations,
            "entity_types": entity_types,
            "relation_types": relation_types
        }

    def get_entities(self, graph_id: str, limit: int = 100, offset: int = 0, order_by_relation_count: bool = False) -> list[dict]:
        """获取指定知识图谱的实体列表

        Args:
            graph_id: 知识图谱ID
            limit: 返回数量限制
            offset: 偏移量
            order_by_relation_count: 是否按关系数量降序排序（用于获取关系最多的实体）
        """
        driver = self.connect()

        with driver.session() as session:
            if order_by_relation_count:
                # 按关系数量排序：统计每个实体的关系数量（作为起点或终点）
                result = session.run("""
                    MATCH (n {graph_id: $graph_id})
                    OPTIONAL MATCH (n)-[r]-()
                    WITH n, count(r) as relation_count
                    ORDER BY relation_count DESC
                    SKIP $offset
                    LIMIT $limit
                    RETURN n, relation_count
                """, graph_id=graph_id, offset=offset, limit=limit)

                entities = []
                for record in result:
                    node = record["n"]
                    entities.append({
                        "id": element_id(node),
                        "labels": list(node.labels),
                        "properties": dict(node),
                        "relation_count": record["relation_count"]
                    })
                return entities
            else:
                # 默认按 elementId 排序
                result = session.run("""
                    MATCH (n {graph_id: $graph_id})
                    RETURN n
                    ORDER BY elementId(n)
                    SKIP $offset
                    LIMIT $limit
                """, graph_id=graph_id, offset=offset, limit=limit)

                entities = []
                for record in result:
                    node = record["n"]
                    entities.append({
                        "id": element_id(node),
                        "labels": list(node.labels),
                        "properties": dict(node)
                    })
                return entities

    def get_relations(self, graph_id: str, limit: int = 100, offset: int = 0) -> list[dict]:
        """获取指定知识图谱的关系列表"""
        driver = self.connect()

        with driver.session() as session:
            result = session.run("""
                MATCH (a {graph_id: $graph_id})-[r]->(b {graph_id: $graph_id})
                RETURN elementId(a) as start_id, labels(a) as start_labels,
                       elementId(b) as end_id, labels(b) as end_labels,
                       type(r) as rel_type, properties(r) as props
                ORDER BY elementId(r)
                SKIP $offset
                LIMIT $limit
            """, graph_id=graph_id, offset=offset, limit=limit)

            relations = []
            for record in result:
                relations.append({
                    "start_id": record["start_id"],
                    "start_labels": record["start_labels"],
                    "end_id": record["end_id"],
                    "end_labels": record["end_labels"],
                    "type": record["rel_type"],
                    "properties": record["props"]
                })
            return relations

    def clear_graph(self, graph_id: str):
        """清空指定知识图谱的所有数据"""
        driver = self.connect()

        with driver.session() as session:
            # 先删除关系
            result = session.run("""
                MATCH ()-[r]->()
                WHERE r.graph_id = $graph_id
                DELETE r
                RETURN count(r) as deleted
            """, graph_id=graph_id)
            deleted_relations = result.single()["deleted"]

            # 再删除节点
            result = session.run("""
                MATCH (n)
                WHERE n.graph_id = $graph_id
                DELETE n
                RETURN count(n) as deleted
            """, graph_id=graph_id)
            deleted_nodes = result.single()["deleted"]

            logger.info(f"Cleared graph {graph_id}: deleted {deleted_nodes} nodes and {deleted_relations} relations")
            return {"nodes": deleted_nodes, "relations": deleted_relations}

    def clear_all(self):
        """清空所有数据"""
        driver = self.connect()

        with driver.session() as session:
            session.run("MATCH (n) DETACH DELETE n")
            logger.warning("Neo4j database cleared")

    def search_entities(
        self,
        graph_id: str,
        query: str,
        limit: int = 20,
        search_type: str = "all"
    ) -> list[dict]:
        """模糊搜索实体和关系

        Args:
            graph_id: 知识图谱ID
            query: 搜索关键词
            limit: 返回数量限制
            search_type: 搜索类型 (all/entity/relation)
        """
        driver = self.connect()
        results = []

        with driver.session() as session:
            if search_type in ("all", "entity"):
                # 搜索实体
                entity_query = """
                    MATCH (n {graph_id: $graph_id})
                    WHERE n.name CONTAINS $search_query OR n.description CONTAINS $search_query
                    RETURN n, elementId(n) as entity_id
                    LIMIT $limit
                """
                entity_result = session.run(
                    entity_query,
                    graph_id=graph_id,
                    search_query=query,
                    limit=limit
                )

                for record in entity_result:
                    node = record["n"]

                    # 获取关联实体（最多5个）
                    related_query = """
                        MATCH (n {graph_id: $graph_id})-[r]-(m {graph_id: $graph_id})
                        WHERE elementId(n) = $entity_id
                        RETURN type(r) as rel_type, r.name as rel_name,
                               elementId(m) as target_id, m.name as target_name, labels(m) as target_labels
                        LIMIT 5
                    """
                    related_result = session.run(
                        related_query,
                        graph_id=graph_id,
                        entity_id=record["entity_id"]
                    )

                    related_entities = []
                    for rel_record in related_result:
                        related_entities.append({
                            "relation_type": rel_record["rel_type"],
                            "relation_name": rel_record.get("rel_name", ""),
                            "entity_id": rel_record["target_id"],
                            "entity_name": rel_record.get("target_name", ""),
                            "entity_labels": rel_record.get("target_labels", [])
                        })

                    results.append({
                        "id": record["entity_id"],
                        "type": "entity",
                        "name": node.get("name", ""),
                        "label": node.get("label", ""),
                        "description": node.get("description", ""),
                        "labels": list(node.labels),
                        "properties": dict(node),
                        "related_entities": related_entities,
                        "relevance": 1.0  # 模糊搜索默认相关性
                    })

            if search_type in ("all", "relation"):
                # 搜索关系
                relation_query = """
                    MATCH (a {graph_id: $graph_id})-[r]->(b {graph_id: $graph_id})
                    WHERE r.name CONTAINS $search_query OR r.description CONTAINS $search_query OR type(r) CONTAINS $search_query
                    RETURN elementId(r) as relation_id, type(r) as rel_type,
                           r.name as rel_name, r.description as rel_description,
                           properties(r) as rel_props,
                           elementId(a) as source_id, a.name as source_name,
                           elementId(b) as target_id, b.name as target_name
                    LIMIT $limit
                """
                relation_result = session.run(
                    relation_query,
                    graph_id=graph_id,
                    search_query=query,
                    limit=limit
                )

                for record in relation_result:
                    results.append({
                        "id": record["relation_id"],
                        "type": "relation",
                        "name": record.get("rel_name", record["rel_type"]),
                        "label": record["rel_type"],
                        "description": record.get("rel_description", ""),
                        "properties": record["rel_props"],
                        "source_entity": {
                            "id": record["source_id"],
                            "name": record.get("source_name", "")
                        },
                        "target_entity": {
                            "id": record["target_id"],
                            "name": record.get("target_name", "")
                        },
                        "relevance": 1.0
                    })

        return results

    def get_related_entities(
        self,
        graph_id: str,
        entity_id: str,
        depth: int = 1
    ) -> list[dict]:
        """获取指定实体的关联实体

        Args:
            graph_id: 知识图谱ID
            entity_id: 实体ID
            depth: 关联深度
        """
        driver = self.connect()

        with driver.session() as session:
            # 使用动态深度查询
            query = f"""
                MATCH (start {{graph_id: $graph_id}})
                WHERE elementId(start) = $entity_id
                MATCH (start)-[r*1..{depth}]-(related {{graph_id: $graph_id}})
                WHERE elementId(related) <> $entity_id
                RETURN DISTINCT elementId(related) as id,
                       related.name as name,
                       related.label as label,
                       related.description as description,
                       labels(related) as labels,
                       properties(related) as props,
                       count(*) as connection_count
                ORDER BY connection_count DESC
                LIMIT 50
            """

            result = session.run(
                query,
                graph_id=graph_id,
                entity_id=entity_id
            )

            related = []
            for record in result:
                related.append({
                    "id": record["id"],
                    "name": record.get("name", ""),
                    "label": record.get("label", ""),
                    "description": record.get("description", ""),
                    "labels": record["labels"],
                    "properties": record["props"],
                    "connection_count": record["connection_count"]
                })

            return related

    def search_by_similarity(
        self,
        graph_id: str,
        query_embedding: list,
        limit: int = 10
    ) -> list[dict]:
        """基于 embedding 相似度搜索实体

        Args:
            graph_id: 知识图谱ID
            query_embedding: 查询文本的 embedding 向量
            limit: 返回数量限制
        """
        driver = self.connect()

        with driver.session() as session:
            # 获取所有有 embedding 的实体
            query = """
                MATCH (n {graph_id: $graph_id})
                WHERE n.embedding IS NOT NULL
                RETURN n, elementId(n) as entity_id
            """

            result = session.run(query, graph_id=graph_id)

            entities_with_scores = []
            for record in result:
                node = record["n"]
                node_embedding = node.get("embedding")

                if node_embedding and isinstance(node_embedding, list):
                    # 计算余弦相似度
                    score = cosine_similarity(query_embedding, node_embedding)

                    if score > 0.3:  # 相似度阈值
                        entities_with_scores.append({
                            "id": record["entity_id"],
                            "type": "entity",
                            "name": node.get("name", ""),
                            "label": node.get("label", ""),
                            "description": node.get("description", ""),
                            "labels": list(node.labels),
                            "properties": dict(node),
                            "related_entities": [],
                            "relevance": score
                        })

            # 按相似度排序
            entities_with_scores.sort(key=lambda x: x["relevance"], reverse=True)

            return entities_with_scores[:limit]


def element_id(node) -> str:
    """获取节点元素ID"""
    return str(node.element_id)


def cosine_similarity(a: list, b: list) -> float:
    """计算余弦相似度"""
    if not a or not b or len(a) != len(b):
        return 0.0
    a_arr = np.array(a)
    b_arr = np.array(b)
    dot_product = np.dot(a_arr, b_arr)
    norm_a = np.linalg.norm(a_arr)
    norm_b = np.linalg.norm(b_arr)
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return float(dot_product / (norm_a * norm_b))
