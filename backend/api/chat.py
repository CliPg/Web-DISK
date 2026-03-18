import json
import time
from typing import List, Optional

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from backend.core.config import settings

router = APIRouter(prefix="/chat", tags=["chat"])


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    model: Optional[str] = None
    stream: Optional[bool] = False


class ChatResponse(BaseModel):
    id: str
    object: str = "chat.completion"
    created: int
    model: str
    choices: List[dict]
    usage: Optional[dict] = None


@router.post("", response_model=ChatResponse)
async def chat_completions(request: ChatRequest):
    """
    Stateless chat completion endpoint.
    Expects a list of messages (history) from the frontend.
    """
    if not settings.LLM_API_KEY:
        # Mock response if API key is not set
        return ChatResponse(
            id="mock-id",
            created=int(time.time()),
            model=request.model or settings.LLM_MODEL,
            choices=[
                {
                    "index": 0,
                    "message": {
                        "role": "assistant",
                        "content": "后端未设置 LLM_API_KEY，这是来自系统的 Mock 响应。请在 .env 文件中配置 LLM_API_KEY 以使用真实的 AI 功能。",
                    },
                    "finish_reason": "stop",
                }
            ],
        )

    # Example using OpenAI-compatible API (e.g., DeepSeek, Qwen)
    api_url = (
        "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions"  # Default for Qwen
    )
    headers = {
        "Authorization": f"Bearer {settings.LLM_API_KEY}",
        "Content-Type": "application/json",
    }

    payload = {
        "model": request.model or settings.LLM_MODEL,
        "messages": [msg.model_dump() for msg in request.messages],
        "stream": request.stream,
    }

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(api_url, headers=headers, json=payload, timeout=60.0)
            response.raise_for_status()
            return response.json()
    except httpx.HTTPStatusError as e:
        error_detail = e.response.text
        try:
            error_json = json.loads(error_detail)
            error_detail = error_json.get("error", {}).get("message", error_detail)
        finally:
            raise HTTPException(
                status_code=e.response.status_code, detail=f"LLM API Error: {error_detail}"
            )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")
