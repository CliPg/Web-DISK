import logging
import os
from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from backend.api import chat, documents, graphs, knowledge_graph, tasks
from backend.core.config import settings
from backend.db.session import init_db

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    # 启动时初始化数据库
    logger.info("Initializing database...")
    init_db()
    logger.info("Application started")

    yield

    # 关闭时清理
    logger.info("Application shutting down")


# 创建FastAPI应用
app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    lifespan=lifespan,
)

# 配置CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册路由
app.include_router(documents.router, prefix=settings.API_V1_PREFIX)
app.include_router(tasks.router, prefix=settings.API_V1_PREFIX)
app.include_router(knowledge_graph.router, prefix=settings.API_V1_PREFIX)
app.include_router(graphs.router, prefix=settings.API_V1_PREFIX)
app.include_router(chat.router, prefix=settings.API_V1_PREFIX)


@app.get("/health")
async def health():
    """健康检查端点"""
    return {"status": "healthy"}


# 静态文件托管与路由兜底
if os.path.exists(settings.STATIC_DIR):
    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        # 如果是 API 请求前缀但未匹配到路由，则返回 404
        if full_path.startswith("api") or full_path.startswith(settings.API_V1_PREFIX.lstrip("/")):
            return {"detail": "Not Found"}
            
        # 尝试返回对应的静态文件 (如 assets/index.js, favicon.ico 等)
        file_path = settings.STATIC_DIR / full_path
        if os.path.isfile(file_path):
            return FileResponse(file_path)
            
        # 兜底返回 index.html，支持 SPA 路由
        index_file = settings.STATIC_DIR / "index.html"
        if os.path.exists(index_file):
            return FileResponse(index_file)
            
        return {"detail": "Frontend index.html not found"}
else:
    @app.get("/")
    async def root():
        """如果静态目录不存在，显示健康信息"""
        return {"name": settings.PROJECT_NAME, "version": settings.VERSION, "status": "running"}


if __name__ == "__main__":
    uvicorn.run("main:app", host=settings.HOST, port=settings.PORT, reload=True, log_level="info")
