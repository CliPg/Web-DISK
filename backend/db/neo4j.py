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

    def get_stats(self) -> dict:
        """获取知识图谱统计信息"""
        driver = self.connect()

        with driver.session() as session:
            # 获取实体总数和类型分布
            entity_result = session.run("""
                MATCH (n)
                RETURN count(n) as total, labels(n) as labels
            """)
            entities = entity_result.data()

            # 获取关系总数和类型分布
            relation_result = session.run("""
                MATCH ()-[r]->()
                RETURN count(r) as total, type(r) as type
            """)
            relations = relation_result.data()

        total_entities = sum(e["total"] for e in entities)
        total_relations = sum(r["total"] for r in relations)

        entity_types = {}
        for e in entities:
            for label in e["labels"]:
                entity_types[label] = entity_types.get(label, 0) + e["total"]

        relation_types = {}
        for r in relations:
            relation_types[r["type"]] = relation_types.get(r["type"], 0) + r["total"]

        return {
            "total_entities": total_entities,
            "total_relations": total_relations,
            "entity_types": entity_types,
            "relation_types": relation_types
        }

    def get_entities(self, limit: int = 100, offset: int = 0) -> list[dict]:
        """获取实体列表"""
        driver = self.connect()

        with driver.session() as session:
            result = session.run("""
                MATCH (n)
                RETURN n
                ORDER BY elementId(n)
                SKIP $offset
                LIMIT $limit
            """, offset=offset, limit=limit)

            entities = []
            for record in result:
                node = record["n"]
                entities.append({
                    "id": element_id(node),
                    "labels": list(node.labels),
                    "properties": dict(node)
                })
            return entities

    def get_relations(self, limit: int = 100, offset: int = 0) -> list[dict]:
        """获取关系列表"""
        driver = self.connect()

        with driver.session() as session:
            result = session.run("""
                MATCH (a)-[r]->(b)
                RETURN elementId(a) as start_id, labels(a) as start_labels,
                       elementId(b) as end_id, labels(b) as end_labels,
                       type(r) as rel_type, properties(r) as props
                ORDER BY elementId(r)
                SKIP $offset
                LIMIT $limit
            """, offset=offset, limit=limit)

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

    def clear_all(self):
        """清空所有数据"""
        driver = self.connect()

        with driver.session() as session:
            session.run("MATCH (n) DETACH DELETE n")
            logger.warning("Neo4j database cleared")


def element_id(node) -> str:
    """获取节点元素ID"""
    return str(node.element_id)
