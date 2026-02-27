from pydantic_settings import BaseSettings, SettingsConfigDict
from pathlib import Path
from typing import Optional, Union
from pydantic import field_validator


class Settings(BaseSettings):
    # API
    API_V1_PREFIX: str = "/api"
    PROJECT_NAME: str = "Web Disk Knowledge Graph"
    VERSION: str = "0.1.0"

    # Server
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    # CORS
    CORS_ORIGINS: Union[list[str], str] = "http://localhost:5173,http://localhost:3000"

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, v):
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",")]
        return v

    # File Storage
    UPLOAD_DIR: Path = Path(__file__).resolve().parent.parent.parent / "uploads"
    MAX_UPLOAD_SIZE: int = 100 * 1024 * 1024  # 100MB
    ALLOWED_EXTENSIONS: set[str] = {".pdf", ".docx", ".txt", ".md"}

    # Database
    SQLITE_DB_PATH: Path = Path(__file__).resolve().parent.parent.parent / "data" / "app.db"

    # Neo4j
    NEO4J_URI: str = "neo4j://127.0.0.1:7687"
    NEO4J_USER: str = "neo4j"
    NEO4J_PASSWORD: str = "12345678"

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # Celery
    CELERY_BROKER_URL: str = "redis://localhost:6379/0"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/0"

    # LLM (复用DISK配置)
    LLM_API_KEY: Optional[str] = None
    LLM_MODEL: str = "qwen-plus"

    class Config:
        env_file = Path(__file__).resolve().parent.parent.parent / ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True


settings = Settings()
