from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from enum import Enum


class TaskStatus(str, Enum):
    """任务状态枚举"""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class DocumentStatus(str, Enum):
    """文档状态枚举"""
    UPLOADING = "uploading"
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


# ==================== Request Models ====================

class DocumentUploadResponse(BaseModel):
    """文档上传响应"""
    document_id: str
    filename: str
    task_id: str
    status: DocumentStatus


# ==================== Response Models ====================

class EntityResponse(BaseModel):
    """实体响应"""
    label: str
    name: str

    class Config:
        # 不序列化embedding字段，太大
        exclude_fields = {'embedding'}


class RelationResponse(BaseModel):
    """关系响应"""
    start_entity: str
    end_entity: str
    label: str
    name: str

    class Config:
        exclude_fields = {'embedding'}


class DocumentResponse(BaseModel):
    """文档响应"""
    id: str
    filename: str
    original_filename: str
    file_path: str
    file_size: int
    status: DocumentStatus
    task_id: Optional[str] = None
    error_message: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    completed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class DocumentListResponse(BaseModel):
    """文档列表响应"""
    documents: list[DocumentResponse]
    total: int


class TaskProgress(BaseModel):
    """任务进度信息"""
    task_id: str
    status: TaskStatus
    progress: float = Field(ge=0, le=1, default=0)
    current_step: str = ""
    total_steps: int = 0
    message: str = ""
    error: Optional[str] = None
    entities_count: int = 0  # 已提取的实体数
    relations_count: int = 0  # 已提取的关系数


class TaskResponse(BaseModel):
    """任务响应"""
    id: str
    document_id: str
    status: TaskStatus
    progress: float
    current_step: str
    message: str
    error_message: Optional[str] = None
    entities_count: int = 0  # 已提取的实体数
    relations_count: int = 0  # 已提取的关系数
    created_at: datetime
    updated_at: datetime
    completed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class KnowledgeGraphStats(BaseModel):
    """知识图谱统计"""
    total_entities: int
    total_relations: int
    entity_types: dict[str, int]
    relation_types: dict[str, int]
