import uuid
import shutil
from pathlib import Path
from typing import Generator, Optional
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, Query, Form
from sqlalchemy.orm import Session

from backend.core.dependencies import get_db, get_settings
from backend.core.config import Settings
from backend.models.database import Document as DBDocument, Task as DBTask, KnowledgeGraph as DBKnowledgeGraph
from backend.models.schemas import (
    DocumentUploadResponse,
    DocumentResponse,
    DocumentListResponse,
    DocumentStatus,
    TaskStatus,
)
from backend.tasks.document_tasks import process_document
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/documents", tags=["documents"])


def get_upload_dir(settings: Settings = Depends(get_settings)) -> Path:
    """获取上传目录，确保存在"""
    settings.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    return settings.UPLOAD_DIR


def ensure_default_graph(db: Session) -> DBKnowledgeGraph:
    """确保存在默认知识图谱"""
    from backend.api.graphs import ensure_default_graph as _ensure_default_graph
    return _ensure_default_graph(db)


@router.post("/upload", response_model=DocumentUploadResponse)
async def upload_document(
    file: UploadFile = File(...),
    graph_id: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    upload_dir: Path = Depends(get_upload_dir),
    settings: Settings = Depends(get_settings),
):
    """上传PDF文档并创建处理任务

    Args:
        file: 上传的文件
        graph_id: 目标知识图谱ID，如果不指定则使用默认图谱
    """
    # 验证文件类型
    if not file.filename:
        raise HTTPException(status_code=400, detail="文件名不能为空")

    file_ext = Path(file.filename).suffix.lower()
    if file_ext not in settings.ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"不支持的文件类型，仅支持: {', '.join(settings.ALLOWED_EXTENSIONS)}"
        )

    # 确定目标知识图谱
    target_graph = None
    if graph_id:
        target_graph = db.query(DBKnowledgeGraph).filter(DBKnowledgeGraph.id == graph_id).first()
        if not target_graph:
            raise HTTPException(status_code=400, detail="指定的知识图谱不存在")
    else:
        target_graph = ensure_default_graph(db)

    # 生成唯一文件名
    unique_filename = f"{uuid.uuid4()}{file_ext}"
    file_path = upload_dir / unique_filename

    # 保存文件
    try:
        with file_path.open("wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        file_size = file_path.stat().st_size
    except Exception as e:
        logger.error(f"Failed to save file: {e}")
        raise HTTPException(status_code=500, detail=f"文件保存失败: {str(e)}")

    # 创建文档记录
    document = DBDocument(
        filename=unique_filename,
        original_filename=file.filename,
        file_path=str(file_path),
        file_size=file_size,
        status=DocumentStatus.PENDING,
        graph_id=target_graph.id,
    )
    db.add(document)
    db.commit()
    db.refresh(document)

    # 创建任务记录（不自动提交Celery任务，等待手动触发）
    task = DBTask(
        document_id=document.id,
        status=TaskStatus.PENDING,
        current_step="等待开始",
        message="文档已上传，点击'开始构建'开始处理",
    )
    db.add(task)
    db.commit()
    db.refresh(task)

    # 不再自动提交Celery任务，改为手动触发

    logger.info(f"Document uploaded: {document.id} -> graph: {target_graph.name}")

    return DocumentUploadResponse(
        document_id=document.id,
        filename=file.filename,
        task_id=task.id,
        status=document.status,
    )


@router.get("", response_model=DocumentListResponse)
async def list_documents(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    status: DocumentStatus = None,
    db: Session = Depends(get_db),
):
    """获取文档列表"""
    query = db.query(DBDocument)

    if status:
        query = query.filter(DBDocument.status == status)

    total = query.count()
    documents = query.order_by(DBDocument.created_at.desc()).offset(skip).limit(limit).all()

    # 获取每个文档的最新任务
    result = []
    for doc in documents:
        # 获取最新任务
        latest_task = db.query(DBTask).filter(DBTask.document_id == doc.id).order_by(DBTask.created_at.desc()).first()

        if latest_task:
            logger.info(f"Document {doc.id}: task.started_at={latest_task.started_at}, task.status={latest_task.status}")

        # 直接构造响应字典
        doc_dict = {
            "id": doc.id,
            "filename": doc.filename,
            "original_filename": doc.original_filename,
            "file_path": doc.file_path,
            "file_size": doc.file_size,
            "status": doc.status,
            "task_id": latest_task.id if latest_task else None,
            "error_message": latest_task.error_message if latest_task else None,
            "created_at": doc.created_at,
            "updated_at": doc.updated_at,
            "completed_at": doc.completed_at,
            "graph_id": doc.graph_id,
            "task_started_at": latest_task.started_at.isoformat() if latest_task and latest_task.started_at else None,
            "task_completed_at": latest_task.completed_at.isoformat() if latest_task and latest_task.completed_at else None,
        }
        result.append(DocumentResponse(**doc_dict))

    return DocumentListResponse(documents=result, total=total)


@router.get("/{document_id}", response_model=DocumentResponse)
async def get_document(document_id: str, db: Session = Depends(get_db)):
    """获取单个文档详情"""
    document = db.query(DBDocument).filter(DBDocument.id == document_id).first()

    if not document:
        raise HTTPException(status_code=404, detail="文档不存在")

    latest_task = db.query(DBTask).filter(DBTask.document_id == document_id).order_by(DBTask.created_at.desc()).first()

    # 直接构造响应字典
    doc_dict = {
        "id": document.id,
        "filename": document.filename,
        "original_filename": document.original_filename,
        "file_path": document.file_path,
        "file_size": document.file_size,
        "status": document.status,
        "task_id": latest_task.id if latest_task else None,
        "error_message": latest_task.error_message if latest_task else None,
        "created_at": document.created_at,
        "updated_at": document.updated_at,
        "completed_at": document.completed_at,
        "graph_id": document.graph_id,
        "task_started_at": latest_task.started_at.isoformat() if latest_task and latest_task.started_at else None,
        "task_completed_at": latest_task.completed_at.isoformat() if latest_task and latest_task.completed_at else None,
    }

    return DocumentResponse(**doc_dict)


@router.delete("/{document_id}")
async def delete_document(document_id: str, db: Session = Depends(get_db)):
    """删除文档"""
    document = db.query(DBDocument).filter(DBDocument.id == document_id).first()

    if not document:
        raise HTTPException(status_code=404, detail="文档不存在")

    # 删除文件
    try:
        file_path = Path(document.file_path)
        if file_path.exists():
            file_path.unlink()
    except Exception as e:
        logger.error(f"Failed to delete file: {e}")

    # 删除数据库记录（级联删除任务）
    db.delete(document)
    db.commit()

    # TODO: 从知识图谱中删除相关实体和关系

    return {"message": "文档已删除"}


@router.post("/{document_id}/start")
async def start_processing(document_id: str, db: Session = Depends(get_db)):
    """手动开始处理文档"""
    document = db.query(DBDocument).filter(DBDocument.id == document_id).first()

    if not document:
        raise HTTPException(status_code=404, detail="文档不存在")

    # 获取或创建任务
    task = db.query(DBTask).filter(DBTask.document_id == document_id).first()
    if not task:
        task = DBTask(
            document_id=document.id,
            status=TaskStatus.PENDING,
            current_step="等待开始",
            message="任务已创建",
        )
        db.add(task)
        db.commit()
        db.refresh(task)

    # 检查任务状态
    if task.status == TaskStatus.PROCESSING:
        raise HTTPException(status_code=400, detail="任务正在处理中")

    if task.status == TaskStatus.COMPLETED:
        raise HTTPException(status_code=400, detail="任务已完成")

    # 提交Celery任务
    try:
        from datetime import datetime
        celery_task = process_document.delay(
            document_id=document.id,
            file_path=document.file_path,
            task_id=task.id,
        )
        # 更新Celery任务ID和开始时间
        task.celery_task_id = celery_task.id
        task.status = TaskStatus.PROCESSING
        task.started_at = datetime.utcnow()
        task.current_step="任务已提交"
        task.message="开始处理文档..."
        db.commit()

        logger.info(f"Task started: task_id={task.id}, started_at={task.started_at}")

        # 更新文档状态
        document.status = DocumentStatus.PROCESSING
        db.commit()

    except Exception as e:
        logger.error(f"Failed to submit Celery task: {e}")
        task.status = TaskStatus.FAILED
        task.error_message = f"任务提交失败: {str(e)}"
        document.status = DocumentStatus.FAILED
        db.commit()
        raise HTTPException(status_code=500, detail=f"任务提交失败: {str(e)}")

    return {
        "message": "任务已开始",
        "task_id": task.id,
        "celery_task_id": celery_task.id
    }
