from celery import Celery
from backend.core.config import settings

celery_app = Celery(
    "web_disk",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=["backend.tasks.document_tasks"]
)

# 配置
celery_app.conf.update(
    task_track_started=True,
    task_time_limit=3600,  # 1小时超时
    task_soft_time_limit=3300,  # 55分钟软超时
    result_expires=3600,  # 结果保存1小时
    worker_prefetch_multiplier=1,  # 每次只取一个任务
    task_acks_late=True,  # 任务执行完才确认
    worker_max_tasks_per_child=10,  # 防止内存泄漏
)
