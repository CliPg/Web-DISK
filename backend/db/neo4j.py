from typing import Optional
from neo4j import GraphDatabase
from backend.core.config import settings
import logging

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

    def get_entities(self, graph_id: str, limit: int = 100, offset: int = 0) -> list[dict]:
        """获取指定知识图谱的实体列表"""
        driver = self.connect()

        with driver.session() as session:
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


def element_id(node) -> str:
    """获取节点元素ID"""
    return str(node.element_id)
