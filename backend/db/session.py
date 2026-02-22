from backend.core.dependencies import engine, SessionLocal, get_db
from backend.models.database import Base
import logging

logger = logging.getLogger(__name__)


def init_db():
    """初始化数据库，创建所有表"""
    from backend.core.config import settings

    # 确保数据目录存在
    settings.SQLITE_DB_PATH.parent.mkdir(parents=True, exist_ok=True)

    Base.metadata.create_all(bind=engine)
    logger.info(f"Database initialized at {settings.SQLITE_DB_PATH}")
