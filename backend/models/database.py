from sqlalchemy import Column, String, Integer, Float, DateTime, Text, ForeignKey, Boolean
from sqlalchemy.orm import DeclarativeBase, relationship
from sqlalchemy.sql import func
from backend.models.schemas import TaskStatus, DocumentStatus
import uuid


class Base(DeclarativeBase):
    """数据库基类"""
    pass


class KnowledgeGraph(Base):
    """知识图谱表"""
    __tablename__ = "knowledge_graphs"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, nullable=False, unique=True)
    description = Column(Text, nullable=True)
    is_default = Column(Boolean, default=False)

    # 统计信息
    entity_count = Column(Integer, default=0)
    relation_count = Column(Integer, default=0)
    document_count = Column(Integer, default=0)

    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # 关联文档
    documents = relationship("Document", back_populates="knowledge_graph", cascade="all, delete-orphan")


class Document(Base):
    """文档表"""
    __tablename__ = "documents"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    filename = Column(String, nullable=False)  # 存储的文件名（带UUID前缀）
    original_filename = Column(String, nullable=False)  # 原始文件名
    file_path = Column(String, nullable=False)
    file_size = Column(Integer, nullable=False)
    status = Column(String, nullable=False, default=DocumentStatus.PENDING)

    # 关联知识图谱
    graph_id = Column(String, ForeignKey("knowledge_graphs.id"), nullable=True)

    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    completed_at = Column(DateTime, nullable=True)

    # 关联任务和知识图谱
    tasks = relationship("Task", back_populates="document", cascade="all, delete-orphan")
    knowledge_graph = relationship("KnowledgeGraph", back_populates="documents")


class Task(Base):
    """任务表"""
    __tablename__ = "tasks"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    document_id = Column(String, ForeignKey("documents.id"), nullable=False)
    celery_task_id = Column(String, unique=True, nullable=True)  # Celery任务ID

    status = Column(String, nullable=False, default=TaskStatus.PENDING)
    progress = Column(Float, default=0.0)
    current_step = Column(String, default="")
    message = Column(String, default="")
    error_message = Column(Text, nullable=True)

    # 知识图谱统计
    entities_count = Column(Integer, default=0)  # 已提取的实体数
    relations_count = Column(Integer, default=0)  # 已提取的关系数

    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    completed_at = Column(DateTime, nullable=True)

    # 关联文档
    document = relationship("Document", back_populates="tasks")
