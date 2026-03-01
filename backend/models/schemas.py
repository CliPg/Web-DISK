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
    graph_id: Optional[str] = None
    # 任务时间信息
    task_started_at: Optional[str] = None  # 改为字符串类型，直接使用 ISO 格式
    task_completed_at: Optional[str] = None  # 改为字符串类型，直接使用 ISO 格式
    # Token 消耗信息
    input_tokens: Optional[int] = 0
    output_tokens: Optional[int] = 0
    total_tokens: Optional[int] = 0

    class Config:
        from_attributes = False  # 禁用 from_attributes，因为我们手动构造数据


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
    input_tokens: int = 0  # 输入 token 数
    output_tokens: int = 0  # 输出 token 数
    created_at: datetime
    started_at: Optional[datetime] = None
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


# ==================== Knowledge Graph Models ====================

class KnowledgeGraphCreate(BaseModel):
    """创建知识图谱请求"""
    name: str = Field(..., min_length=2, max_length=50)
    description: Optional[str] = Field(None, max_length=200)


class KnowledgeGraphUpdate(BaseModel):
    """更新知识图谱请求"""
    name: Optional[str] = Field(None, min_length=2, max_length=50)
    description: Optional[str] = Field(None, max_length=200)


class KnowledgeGraphResponse(BaseModel):
    """知识图谱响应"""
    id: str
    name: str
    description: Optional[str] = None
    entity_count: int
    relation_count: int
    document_count: int
    created_at: datetime
    updated_at: datetime
    is_default: bool

    class Config:
        from_attributes = True


class KnowledgeGraphListResponse(BaseModel):
    """知识图谱列表响应"""
    graphs: list[KnowledgeGraphResponse]
