import json
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import Optional

from backend.core.dependencies import get_db
from backend.models.database import Task as DBTask, Document as DBDocument
from backend.models.schemas import TaskResponse, TaskProgress, TaskStatus
from celery.result import AsyncResult
from backend.tasks.celery_app import celery_app
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/tasks", tags=["tasks"])


@router.get("/{task_id}", response_model=TaskResponse)
async def get_task(task_id: str, db: Session = Depends(get_db)):
    """获取任务详情"""
    task = db.query(DBTask).filter(DBTask.id == task_id).first()

    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")

    # 对于处理中但没有 started_at 的旧任务，使用 created_at 作为 started_at
    # 这样可以避免计时从很久以前开始
    response = TaskResponse.model_validate(task)
    if task.status == TaskStatus.PROCESSING and not task.started_at:
        # 不修改数据库，只在响应中提供
        pass  # 前端会回退使用 created_at

    return response


@router.get("/{task_id}/stream")
async def stream_task_progress(task_id: str, db: Session = Depends(get_db)):
    """SSE流式推送任务进度"""

    async def event_generator():
        """生成SSE事件"""
        last_progress = -1
        last_status = None

        while True:
            # 从数据库获取最新状态
            task = db.query(DBTask).filter(DBTask.id == task_id).first()

            if not task:
                yield f"event: error\ndata: {json.dumps({'error': '任务不存在'})}\n\n"
                break

            # 检查状态变化
            progress_changed = task.progress != last_progress
            status_changed = task.status != last_status

            if progress_changed or status_changed:
                data = {
                    "task_id": task.id,
                    "status": task.status,
                    "progress": task.progress,
                    "current_step": task.current_step,
                    "message": task.message,
                    "error": task.error_message,
                    "entities_count": task.entities_count,
                    "relations_count": task.relations_count,
                }
                yield f"event: progress\ndata: {json.dumps(data)}\n\n"

                last_progress = task.progress
                last_status = task.status

            # 检查任务是否完成
            if task.status in [TaskStatus.COMPLETED, TaskStatus.FAILED]:
                yield f"event: complete\ndata: {json.dumps({'status': task.status})}\n\n"
                break

            # 等待再检查
            import asyncio
            await asyncio.sleep(1)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("")
async def list_tasks(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    status: Optional[TaskStatus] = None,
    db: Session = Depends(get_db),
):
    """获取任务列表"""
    query = db.query(DBTask)

    if status:
        query = query.filter(DBTask.status == status)

    total = query.count()
    tasks = query.order_by(DBTask.created_at.desc()).offset(skip).limit(limit).all()

    return {
        "tasks": [TaskResponse.model_validate(t) for t in tasks],
        "total": total
    }


@router.post("/{task_id}/cancel")
async def cancel_task(task_id: str, db: Session = Depends(get_db)):
    """取消任务"""
    task = db.query(DBTask).filter(DBTask.id == task_id).first()

    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")

    if task.status in [TaskStatus.COMPLETED, TaskStatus.FAILED]:
        raise HTTPException(status_code=400, detail="任务已完成或失败，无法取消")

    # 取消Celery任务
    if task.celery_task_id:
        try:
            celery_app.control.revoke(task.celery_task_id, terminate=True)
        except Exception as e:
            logger.error(f"Failed to cancel Celery task: {e}")

    # 更新状态
    task.status = TaskStatus.FAILED
    task.error_message = "任务已取消"
    db.commit()

    return {"message": "任务已取消"}
