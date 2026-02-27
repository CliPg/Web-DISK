"""Embedding 服务 - 使用 Ollama 生成本地向量"""
import logging
from typing import Optional
from langchain_community.embeddings import OllamaEmbeddings
from backend.core.config import settings

logger = logging.getLogger(__name__)

# 全局 embedding 实例
_embedding_model: Optional[OllamaEmbeddings] = None


def get_embedding_model() -> OllamaEmbeddings:
    """获取 embedding 模型实例（单例模式）"""
    global _embedding_model
    if _embedding_model is None:
        _embedding_model = OllamaEmbeddings(
            model="nomic-embed-text",  # Ollama 推荐的 embedding 模型
            base_url="http://localhost:11434"
        )
    return _embedding_model


def get_embedding(text: str) -> list[float]:
    """生成文本的 embedding 向量

    Args:
        text: 输入文本

    Returns:
        embedding 向量
    """
    try:
        model = get_embedding_model()
        embedding = model.embed_query(text)
        return embedding
    except Exception as e:
        logger.error(f"Failed to generate embedding: {e}")
        # 返回空向量，避免查询失败
        return []


async def aget_embedding(text: str) -> list[float]:
    """异步生成文本的 embedding 向量

    Args:
        text: 输入文本

    Returns:
        embedding 向量
    """
    try:
        model = get_embedding_model()
        embedding = await model.aembed_query(text)
        return embedding
    except Exception as e:
        logger.error(f"Failed to generate embedding async: {e}")
        return []
