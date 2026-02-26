# DISK 多智能体架构设计方案

## 目录

1. [背景与目标](#背景与目标)
2. [架构概览](#架构概览)
3. [智能体设计](#智能体设计)
4. [通信协议](#通信协议)
5. [代码实现](#代码实现)
6. [部署方案](#部署方案)
7. [监控与调试](#监控与调试)

---

## 背景与目标

### 现有架构分析

当前 DISK (Domain Incremental conStruction of Knowledge graphs) 系统采用单体架构：

```
┌─────────────────────────────────────────────────────────────┐
│                         DISK 类                              │
├─────────────────────────────────────────────────────────────┤
│  ┌───────────┐   ┌───────────┐   ┌───────────┐   ┌────────┐ │
│  │ Distiller │ → │ Extractor │ → │  Merger   │ → │ Manager│ │
│  └───────────┘   └───────────┘   └───────────┘   └────────┘ │
│       ↓               ↓               ↓              ↓       │
│   文本块         实体/关系        语义合并       Neo4j 存储   │
└─────────────────────────────────────────────────────────────┘
```

**存在的问题**：
- 各模块耦合在一个类中，难以独立扩展
- 并行处理仅限于线程池级别，无法分布式部署
- 缺乏任务级别的容错和重试机制
- 难以实现不同处理策略的灵活组合

### 多智能体目标

1. **解耦模块**：每个处理阶段由独立的 Agent 负责
2. **分布式部署**：Agent 可运行在不同进程/机器上
3. **容错机制**：单个 Agent 失败不影响整体流程
4. **灵活扩展**：可插拔的 Agent 设计，便于添加新功能
5. **可视监控**：实时追踪 Agent 间的协作过程

---

## 架构概览

### 整体架构

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         多智能体协作架构                                  │
└─────────────────────────────────────────────────────────────────────────┘

                              ┌─────────────┐
                              │   任务输入   │
                              │  (PDF 文件)  │
                              └──────┬──────┘
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          Agent 消息队列 (Redis)                          │
└─────────────────────────────────────────────────────────────────────────┘
                                     │
         ┌───────────────────────────┼───────────────────────────┐
         │                           │                           │
         ▼                           ▼                           ▼
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│  Distiller      │       │  Extractor      │       │  Quality        │
│  Agent Group    │──────▶│  Agent Group    │──────▶│  Agent          │
│  (文档解析)      │       │  (知识提取)      │       │  (质量审核)      │
└─────────────────┘       └─────────────────┘       └─────────────────┘
         │                           │                           │
         ▼                           ▼                           ▼
    文本块队列                  实体/关系队列                 审核后数据
                                      │                           │
                                      ▼                           ▼
                              ┌─────────────────┐       ┌─────────────────┐
                              │  Merger         │──────▶│  Storage        │
                              │  Agent          │       │  Agent          │
                              │  (语义合并)      │       │  (图谱存储)      │
                              └─────────────────┘       └─────────────────┘
                                      │                           │
                                      ▼                           ▼
                                 合并后数据                  Neo4j 数据库
```

### 处理流程图

```
┌────────────┐    ┌────────────┐    ┌────────────┐    ┌────────────┐
│   PDF      │───▶│  Distiller │───▶│ Extractor  │───▶│  Quality   │
│   Upload   │    │   Agent    │    │   Agent    │    │   Agent    │
└────────────┘    └────────────┘    └────────────┘    └────────────┘
                       │                 │                 │
                       ▼                 ▼                 ▼
                  [Text Chunks]    [Entities+        [Filtered
                                    Relations]        Results]
                                                           │
                                                           ▼
┌────────────┐    ┌────────────┐    ┌────────────┐    ┌────────────┐
│   Neo4j    │◀───│  Storage   │◀───│  Merger    │◀───│            │
│   Database │    │   Agent    │    │   Agent    │    │            │
└────────────┘    └────────────┘    └────────────┘    └────────────┘
```

---

## 智能体设计

### 1. Distiller Agent（文档解析智能体）

**职责**：
- 接收 PDF 文件路径
- 提取文本块
- 提取图片并进行 OCR
- 提取表格数据
- 输出标准化的文本块消息

**输入消息格式**：
```json
{
  "task_id": "uuid",
  "type": "distill",
  "pdf_path": "/path/to/file.pdf",
  "options": {
    "extract_images": true,
    "extract_tables": true,
    "ocr_enabled": true
  }
}
```

**输出消息格式**：
```json
{
  "task_id": "uuid",
  "type": "text_chunks",
  "source_pdf": "/path/to/file.pdf",
  "chunks": [
    {
      "index": 0,
      "content": "文本内容...",
      "page": 1,
      "metadata": {}
    }
  ],
  "images": [...],
  "tables": [...]
}
```

---

### 2. Extractor Agent（知识提取智能体）

**职责**：
- 接收文本块
- 调用 LLM 提取实体和关系
- 生成向量嵌入
- 输出结构化的实体和关系

**支持多种提取策略**：
- **实体优先**：先提取所有实体，再提取关系
- **关系优先**：先提取关系，关系中的实体自动提取
- **联合提取**：同时提取实体和关系（当前默认）

**输入消息格式**：
```json
{
  "task_id": "uuid",
  "type": "extract",
  "chunk": {
    "index": 0,
    "content": "文本内容...",
    "page": 1
  },
  "pdf_path": "/path/to/file.pdf",
  "strategy": "joint"
}
```

**输出消息格式**：
```json
{
  "task_id": "uuid",
  "type": "extraction_result",
  "chunk_index": 0,
  "entities": [
    {
      "name": "实体名称",
      "label": "Person",
      "description": "描述",
      "embedding": [0.1, 0.2, ...]
    }
  ],
  "relations": [
    {
      "start_entity": {...},
      "end_entity": {...},
      "label": "WORKS_AT",
      "name": "就职于",
      "embedding": [0.3, 0.4, ...]
    }
  ]
}
```

---

### 3. Quality Agent（质量审核智能体）

**职责**：
- 接收提取结果
- 验证实体和关系的质量
- 过滤低质量结果
- 标记需要人工审核的内容

**质量检查维度**：
- 实体名称长度和格式
- 关系的合理性
- 置信度评分
- 数据完整性

**输入消息格式**：
```json
{
  "task_id": "uuid",
  "type": "quality_check",
  "extraction_result": {...}
}
```

**输出消息格式**：
```json
{
  "task_id": "uuid",
  "type": "quality_result",
  "status": "approved" | "rejected" | "needs_review",
  "entities": [...],
  "relations": [...],
  "rejected_reasons": [...],
  "confidence_score": 0.85
}
```

---

### 4. Merger Agent（语义合并智能体）

**职责**：
- 接收一批审核通过的结果
- 计算实体间的语义相似度
- 合并重复实体
- 更新关系中的实体引用

**合并策略**：
- 基于余弦相似度
- 可配置相似度阈值
- 支持批量合并

**输入消息格式**：
```json
{
  "task_id": "uuid",
  "type": "merge",
  "batch": {
    "entities": [...],
    "relations": [...]
  },
  "existing_kg": {
    "entities": [...],
    "relations": [...]
  },
  "threshold": 0.8
}
```

**输出消息格式**：
```json
{
  "task_id": "uuid",
  "type": "merge_result",
  "merged_entities": [...],
  "merged_relations": [...],
  "statistics": {
    "original_count": 100,
    "merged_count": 80,
    "duplicates_found": 20
  }
}
```

---

### 5. Storage Agent（存储智能体）

**职责**：
- 接收合并后的图谱数据
- 批量写入 Neo4j
- 处理写入冲突
- 返回存储结果

**输入消息格式**：
```json
{
  "task_id": "uuid",
  "type": "store",
  "graph_data": {
    "entities": [...],
    "relations": [...]
  },
  "neo4j_config": {
    "uri": "bolt://localhost:7687",
    "user": "neo4j",
    "password": "password"
  }
}
```

**输出消息格式**：
```json
{
  "task_id": "uuid",
  "type": "store_result",
  "status": "success" | "partial" | "failed",
  "entities_created": 50,
  "relations_created": 80,
  "errors": []
}
```

---

### 6. Coordinator Agent（协调智能体）[可选]

**职责**：
- 管理整个处理流程
- 分配任务给各 Agent
- 监控执行状态
- 处理异常和重试

**功能**：
- 任务调度
- 进度跟踪
- 错误处理
- 状态恢复

---

## 通信协议

### 消息总线设计

使用 Redis Pub/Sub + Stream 实现消息总线：

```
┌─────────────────────────────────────────────────────────────┐
│                      Redis 消息总线                          │
├─────────────────────────────────────────────────────────────┤
│  Channels:                                                  │
│  - agent:distiller:input     → 输入 PDF 处理任务            │
│  - agent:distiller:output    → 输出文本块                   │
│  - agent:extractor:input     → 输入文本块                   │
│  - agent:extractor:output    → 输出提取结果                 │
│  - agent:quality:input       → 输入待审核数据               │
│  - agent:quality:output      → 输出审核结果                 │
│  - agent:merger:input        → 输入待合并数据               │
│  - agent:merger:output       → 输出合并结果                 │
│  - agent:storage:input       → 输入待存储数据               │
│  - agent:storage:output      → 输出存储结果                 │
│                                                             │
│  Streams:                                                   │
│  - task:progress                → 任务进度流                │
│  - agent:health                 → Agent 健康检查            │
└─────────────────────────────────────────────────────────────┘
```

### 消息格式标准

所有消息遵循以下格式：

```python
from pydantic import BaseModel, Field
from typing import Optional, Any, Literal
from uuid import uuid4

class AgentMessage(BaseModel):
    """Agent 间通信的标准消息格式"""
    task_id: str = Field(default_factory=lambda: str(uuid4()))
    type: str  # 消息类型
    source: str  # 发送者 Agent ID
    target: Optional[str] = None  # 目标 Agent ID，广播时为空
    timestamp: float = Field(default_factory=lambda: time.time())
    payload: dict  # 消息内容
    metadata: dict = Field(default_factory=dict)  # 元数据
    reply_to: Optional[str] = None  # 回复队列
```

---

## 代码实现

### 1. Agent 基类

```python
# agents/base.py
import asyncio
import json
import logging
from abc import ABC, abstractmethod
from typing import Any, Callable, Optional
import redis.asyncio as redis
from pydantic import BaseModel

logger = logging.getLogger(__name__)


class AgentMessage(BaseModel):
    """Agent 间通信的标准消息格式"""
    task_id: str
    type: str
    source: str
    target: Optional[str] = None
    payload: dict
    timestamp: float
    metadata: dict = {}
    reply_to: Optional[str] = None


class BaseAgent(ABC):
    """Agent 基类"""

    def __init__(
        self,
        agent_id: str,
        redis_url: str = "redis://localhost:6379/0",
        input_channel: str = None,
        output_channel: str = None,
    ):
        self.agent_id = agent_id
        self.redis_url = redis_url
        self.input_channel = input_channel or f"agent:{agent_id}:input"
        self.output_channel = output_channel or f"agent:{agent_id}:output"
        self.redis: Optional[redis.Redis] = None
        self.running = False
        self._message_handlers: dict[str, Callable] = {}

    async def start(self):
        """启动 Agent"""
        self.redis = await redis.from_url(self.redis_url)
        self.running = True

        # 注册默认消息处理器
        self.register_handler("ping", self._handle_ping)
        self.register_handler("shutdown", self._handle_shutdown)

        logger.info(f"Agent {self.agent_id} started")

        # 启动消息监听
        await self._listen()

    async def stop(self):
        """停止 Agent"""
        self.running = False
        if self.redis:
            await self.redis.close()
        logger.info(f"Agent {self.agent_id} stopped")

    def register_handler(self, message_type: str, handler: Callable):
        """注册消息处理器"""
        self._message_handlers[message_type] = handler

    async def _listen(self):
        """监听输入队列"""
        pubsub = self.redis.pubsub()
        await pubsub.subscribe(self.input_channel)

        async for message in pubsub.listen():
            if not self.running:
                break

            if message["type"] == "message":
                try:
                    data = json.loads(message["data"])
                    msg = AgentMessage(**data)
                    await self._process_message(msg)
                except Exception as e:
                    logger.error(f"Error processing message: {e}")

    async def _process_message(self, msg: AgentMessage):
        """处理接收到的消息"""
        handler = self._message_handlers.get(msg.type)

        if handler:
            try:
                response = await handler(msg)
                if response and msg.reply_to:
                    await self.send(response, channel=msg.reply_to)
            except Exception as e:
                logger.error(f"Error in handler {msg.type}: {e}")
                await self.send_error(msg, str(e))
        else:
            logger.warning(f"No handler for message type: {msg.type}")

    async def send(
        self,
        payload: dict | AgentMessage,
        channel: str = None,
        reply_to: str = None,
    ) -> None:
        """发送消息"""
        if isinstance(payload, AgentMessage):
            msg = payload
        else:
            msg = AgentMessage(
                task_id=payload.get("task_id", ""),
                type=payload.get("type", ""),
                source=self.agent_id,
                payload=payload,
                timestamp=time.time(),
            )

        if reply_to:
            msg.reply_to = reply_to

        target_channel = channel or self.output_channel
        await self.redis.publish(target_channel, msg.model_dump_json())

    async def send_error(self, original_msg: AgentMessage, error: str):
        """发送错误消息"""
        await self.send(
            {
                "type": "error",
                "task_id": original_msg.task_id,
                "error": error,
                "original_type": original_msg.type,
            },
            channel=original_msg.reply_to or self.output_channel,
        )

    async def _handle_ping(self, msg: AgentMessage) -> dict:
        """处理 ping 消息"""
        return {"type": "pong", "agent_id": self.agent_id}

    async def _handle_shutdown(self, msg: AgentMessage) -> dict:
        """处理 shutdown 消息"""
        await self.stop()
        return {"type": "shutdown_ack", "agent_id": self.agent_id}

    @abstractmethod
    async def process(self, data: dict) -> Any:
        """处理业务数据的抽象方法，子类需实现"""
        pass
```

### 2. Distiller Agent 实现

```python
# agents/distiller_agent.py
import os
from pathlib import Path
from typing import Any

from agents.base import BaseAgent, AgentMessage
from DISK.distiller.pdf_distiller import PDFDistiller


class DistillerAgent(BaseAgent):
    """文档解析 Agent"""

    def __init__(
        self,
        agent_id: str = "distiller",
        redis_url: str = "redis://localhost:6379/0",
        work_dir: str = "./uploads",
    ):
        super().__init__(agent_id, redis_url)
        self.work_dir = Path(work_dir)
        self.work_dir.mkdir(parents=True, exist_ok=True)
        self.distiller = PDFDistiller()

        # 注册消息处理器
        self.register_handler("distill", self._handle_distill)

    async def _handle_distill(self, msg: AgentMessage) -> dict:
        """处理文档解析请求"""
        pdf_path = msg.payload.get("pdf_path")
        options = msg.payload.get("options", {})

        try:
            # 调用 PDFDistiller 提取文本块
            text_blocks = self.distiller.extract_text_blocks(pdf_path)

            # 可选：提取图片
            images = []
            if options.get("extract_images", False):
                images = self.distiller.extract_images_and_ocr(pdf_path)

            # 可选：提取表格
            tables = []
            if options.get("extract_tables", False):
                tables = self.distiller.extract_tables_improved(pdf_path)

            # 构造文本块列表
            chunks = [
                {
                    "index": i,
                    "content": block,
                    "page": 1,  # 可以从 PDFDistiller 扩展获取页码
                    "metadata": {},
                }
                for i, block in enumerate(text_blocks)
            ]

            return {
                "type": "text_chunks",
                "task_id": msg.task_id,
                "source_pdf": pdf_path,
                "chunks": chunks,
                "images": images,
                "tables": tables,
                "statistics": {
                    "total_chunks": len(chunks),
                    "total_images": len(images),
                    "total_tables": len(tables),
                },
            }

        except Exception as e:
            logger.error(f"Error distilling PDF {pdf_path}: {e}")
            raise

    async def process(self, data: dict) -> Any:
        """处理业务数据（同步接口兼容）"""
        return await self._handle_distill(
            AgentMessage(
                task_id=data.get("task_id", ""),
                type="distill",
                source="internal",
                payload=data,
                timestamp=0,
            )
        )
```

### 3. Extractor Agent 实现

```python
# agents/extractor_agent.py
import asyncio
from concurrent.futures import ThreadPoolExecutor
from typing import Any

from agents.base import BaseAgent, AgentMessage
from DISK.extractor.extractor import Extractor


class ExtractorAgent(BaseAgent):
    """知识提取 Agent"""

    def __init__(
        self,
        agent_id: str = "extractor",
        redis_url: str = "redis://localhost:6379/0",
        llm=None,
        embeddings=None,
        max_workers: int = 4,
        language: str = None,
    ):
        super().__init__(agent_id, redis_url)
        self.max_workers = max_workers
        self.executor = ThreadPoolExecutor(max_workers=max_workers)

        # 初始化 Extractor（每个线程一个实例）
        self._extractor_kwargs = {
            "llm": llm,
            "embeddings": embeddings,
            "language": language,
        }

        # 注册消息处理器
        self.register_handler("extract", self._handle_extract)
        self.register_handler("extract_batch", self._handle_extract_batch)

    async def _handle_extract(self, msg: AgentMessage) -> dict:
        """处理单个文本块提取请求"""
        chunk = msg.payload.get("chunk")
        pdf_path = msg.payload.get("pdf_path")

        # 在线程池中执行提取（避免阻塞事件循环）
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            self.executor,
            self._extract_sync,
            chunk["content"],
            pdf_path,
        )

        if result is None:
            return {
                "type": "extraction_result",
                "task_id": msg.task_id,
                "chunk_index": chunk["index"],
                "status": "failed",
                "entities": [],
                "relations": [],
            }

        relations, entities = result

        return {
            "type": "extraction_result",
            "task_id": msg.task_id,
            "chunk_index": chunk["index"],
            "status": "success",
            "entities": [
                {
                    "name": e.name,
                    "label": e.label,
                    "description": e.description,
                    "embedding": e.embedding,
                }
                for e in entities
            ],
            "relations": [
                {
                    "start_entity": {
                        "name": r.start_entity.name,
                        "label": r.start_entity.label,
                    },
                    "end_entity": {
                        "name": r.end_entity.name,
                        "label": r.end_entity.label,
                    },
                    "label": r.label,
                    "name": r.name,
                    "description": r.description,
                    "embedding": r.embedding,
                }
                for r in relations
            ],
        }

    async def _handle_extract_batch(self, msg: AgentMessage) -> dict:
        """处理批量文本块提取请求"""
        chunks = msg.payload.get("chunks", [])
        pdf_path = msg.payload.get("pdf_path")

        tasks = [
            self._handle_extract(
                AgentMessage(
                    task_id=msg.task_id,
                    type="extract",
                    source="internal",
                    payload={"chunk": chunk, "pdf_path": pdf_path},
                    timestamp=0,
                )
            )
            for chunk in chunks
        ]

        results = await asyncio.gather(*tasks, return_exceptions=True)

        # 整理结果
        all_entities = []
        all_relations = []
        failed_indices = []

        for i, result in enumerate(results):
            if isinstance(result, Exception):
                failed_indices.append(i)
                continue

            if result.get("status") == "success":
                all_entities.extend(result.get("entities", []))
                all_relations.extend(result.get("relations", []))

        return {
            "type": "batch_extraction_result",
            "task_id": msg.task_id,
            "entities": all_entities,
            "relations": all_relations,
            "statistics": {
                "total_chunks": len(chunks),
                "successful": len(chunks) - len(failed_indices),
                "failed": len(failed_indices),
                "total_entities": len(all_entities),
                "total_relations": len(all_relations),
            },
        }

    def _extract_sync(self, text: str, pdf_path: str = None):
        """同步执行提取（在线程池中运行）"""
        # 创建线程局部的 Extractor 实例
        import threading

        local = threading.local()

        if not hasattr(local, "extractor"):
            from DISK.extractor.extractor import Extractor
            local.extractor = Extractor(**self._extractor_kwargs)

        return local.extractor.extract_relations_and_entities(text, pdf_path)

    async def process(self, data: dict) -> Any:
        """处理业务数据（同步接口兼容）"""
        return await self._handle_extract(
            AgentMessage(
                task_id=data.get("task_id", ""),
                type="extract",
                source="internal",
                payload=data,
                timestamp=0,
            )
        )

    async def stop(self):
        """停止 Agent"""
        self.executor.shutdown(wait=True)
        await super().stop()
```

### 4. Quality Agent 实现

```python
# agents/quality_agent.py
from agents.base import BaseAgent, AgentMessage
from typing import Any


class QualityAgent(BaseAgent):
    """质量审核 Agent"""

    def __init__(
        self,
        agent_id: str = "quality",
        redis_url: str = "redis://localhost:6379/0",
        confidence_threshold: float = 0.6,
    ):
        super().__init__(agent_id, redis_url)
        self.confidence_threshold = confidence_threshold

        # 注册消息处理器
        self.register_handler("quality_check", self._handle_quality_check)

    async def _handle_quality_check(self, msg: AgentMessage) -> dict:
        """处理质量检查请求"""
        entities = msg.payload.get("entities", [])
        relations = msg.payload.get("relations", [])

        # 质量检查
        approved_entities = []
        approved_relations = []
        rejected_reasons = []

        for entity in entities:
            issues = self._check_entity(entity)
            if issues:
                rejected_reasons.extend(
                    [f"Entity '{entity.get('name')}': {issue}" for issue in issues]
                )
            else:
                approved_entities.append(entity)

        for relation in relations:
            issues = self._check_relation(relation, approved_entities)
            if issues:
                rejected_reasons.extend(
                    [f"Relation: {issue}" for issue in issues]
                )
            else:
                approved_relations.append(relation)

        # 计算置信度
        confidence = self._calculate_confidence(
            approved_entities, approved_relations
        )

        status = "approved"
        if confidence < self.confidence_threshold:
            status = "rejected"
        elif confidence < 0.8:
            status = "needs_review"

        return {
            "type": "quality_result",
            "task_id": msg.task_id,
            "status": status,
            "entities": approved_entities,
            "relations": approved_relations,
            "rejected_reasons": rejected_reasons,
            "confidence_score": confidence,
        }

    def _check_entity(self, entity: dict) -> list[str]:
        """检查实体质量"""
        issues = []

        name = entity.get("name", "")
        label = entity.get("label", "")

        # 检查名称长度
        if len(name) < 2:
            issues.append("Name too short")

        # 检查标签
        if not label or label.strip() == "":
            issues.append("Missing label")

        # 检查是否有特殊字符（排除允许的）
        if any(char in name for char in ["\n", "\r", "\t"]):
            issues.append("Invalid characters in name")

        return issues

    def _check_relation(self, relation: dict, entities: list) -> list[str]:
        """检查关系质量"""
        issues = []

        start_entity = relation.get("start_entity", {})
        end_entity = relation.get("end_entity", {})

        # 检查实体是否存在
        start_name = start_entity.get("name")
        end_name = end_entity.get("name")

        valid_names = {e.get("name") for e in entities}

        if start_name not in valid_names:
            issues.append(f"Start entity '{start_name}' not found")

        if end_name not in valid_names:
            issues.append(f"End entity '{end_name}' not found")

        # 检查是否是自指关系
        if start_name == end_name:
            issues.append("Self-referential relation")

        return issues

    def _calculate_confidence(self, entities: list, relations: list) -> float:
        """计算置信度"""
        # 简单的置信度计算：基于数据完整性
        entity_scores = [
            1.0 if e.get("description") else 0.7
            for e in entities
        ]
        relation_scores = [
            1.0 if r.get("description") else 0.8
            for r in relations
        ]

        if not entity_scores and not relation_scores:
            return 0.0

        all_scores = entity_scores + relation_scores
        return sum(all_scores) / len(all_scores)

    async def process(self, data: dict) -> Any:
        """处理业务数据（同步接口兼容）"""
        return await self._handle_quality_check(
            AgentMessage(
                task_id=data.get("task_id", ""),
                type="quality_check",
                source="internal",
                payload=data,
                timestamp=0,
            )
        )
```

### 5. Merger Agent 实现

```python
# agents/merger_agent.py
from agents.base import BaseAgent, AgentMessage
from DISK.merger.merger import Merger
from DISK.models import Entity, Relation
from typing import Any


class MergerAgent(BaseAgent):
    """语义合并 Agent"""

    def __init__(
        self,
        agent_id: str = "merger",
        redis_url: str = "redis://localhost:6379/0",
        threshold: float = 0.8,
    ):
        super().__init__(agent_id, redis_url)
        self.merger = Merger(threshold=threshold)

        # 注册消息处理器
        self.register_handler("merge", self._handle_merge)

    async def _handle_merge(self, msg: AgentMessage) -> dict:
        """处理合并请求"""
        batch_entities_data = msg.payload.get("batch", {}).get("entities", [])
        batch_relations_data = msg.payload.get("batch", {}).get("relations", [])
        existing_entities_data = msg.payload.get("existing_kg", {}).get("entities", [])
        existing_relations_data = msg.payload.get("existing_kg", {}).get("relations", [])
        threshold = msg.payload.get("threshold", self.merger.threshold)

        # 转换为 Entity 和 Relation 对象
        batch_entities = [self._dict_to_entity(e) for e in batch_entities_data]
        batch_relations = [
            self._dict_to_relation(r, batch_entities)
            for r in batch_relations_data
        ]
        existing_entities = [self._dict_to_entity(e) for e in existing_entities_data]
        existing_relations = [
            self._dict_to_relation(r, existing_entities)
            for r in existing_relations_data
        ]

        # 执行合并
        merged_relations, merged_entities = self.merger.merge(
            entities1=existing_entities,
            relations1=existing_relations,
            entities2=batch_entities,
            relations2=batch_relations,
        )

        # 统计信息
        original_count = len(existing_entities) + len(batch_entities)
        merged_count = len(merged_entities)
        duplicates_found = original_count - merged_count

        return {
            "type": "merge_result",
            "task_id": msg.task_id,
            "merged_entities": [self._entity_to_dict(e) for e in merged_entities],
            "merged_relations": [self._relation_to_dict(r) for r in merged_relations],
            "statistics": {
                "original_count": original_count,
                "merged_count": merged_count,
                "duplicates_found": duplicates_found,
            },
        }

    def _dict_to_entity(self, data: dict) -> Entity:
        """字典转 Entity 对象"""
        return Entity(
            name=data.get("name"),
            label=data.get("label"),
            embedding=data.get("embedding", []),
            description=data.get("description", ""),
        )

    def _dict_to_relation(self, data: dict, entities: list) -> Relation:
        """字典转 Relation 对象"""
        # 查找对应的实体
        start_name = data.get("start_entity", {}).get("name")
        end_name = data.get("end_entity", {}).get("name")

        start_entity = next(
            (e for e in entities if e.name == start_name),
            self._dict_to_entity(data.get("start_entity", {})),
        )
        end_entity = next(
            (e for e in entities if e.name == end_name),
            self._dict_to_entity(data.get("end_entity", {})),
        )

        return Relation(
            start_entity=start_entity,
            end_entity=end_entity,
            label=data.get("label"),
            name=data.get("name"),
            embedding=data.get("embedding", []),
            description=data.get("description", ""),
        )

    def _entity_to_dict(self, entity: Entity) -> dict:
        """Entity 对象转字典"""
        return {
            "name": entity.name,
            "label": entity.label,
            "embedding": entity.embedding,
            "description": entity.description,
        }

    def _relation_to_dict(self, relation: Relation) -> dict:
        """Relation 对象转字典"""
        return {
            "start_entity": {
                "name": relation.start_entity.name,
                "label": relation.start_entity.label,
            },
            "end_entity": {
                "name": relation.end_entity.name,
                "label": relation.end_entity.label,
            },
            "label": relation.label,
            "name": relation.name,
            "embedding": relation.embedding,
            "description": relation.description,
        }

    async def process(self, data: dict) -> Any:
        """处理业务数据（同步接口兼容）"""
        return await self._handle_merge(
            AgentMessage(
                task_id=data.get("task_id", ""),
                type="merge",
                source="internal",
                payload=data,
                timestamp=0,
            )
        )
```

### 6. Storage Agent 实现

```python
# agents/storage_agent.py
from agents.base import BaseAgent, AgentMessage
from DISK.models.neo4j_connector import Neo4jConnector
from DISK.models import Entity, Relation
from typing import Any


class StorageAgent(BaseAgent):
    """存储 Agent"""

    def __init__(
        self,
        agent_id: str = "storage",
        redis_url: str = "redis://localhost:6379/0",
        neo4j_uri: str = "bolt://localhost:7687",
        neo4j_user: str = "neo4j",
        neo4j_password: str = "password",
    ):
        super().__init__(agent_id, redis_url)
        self.neo4j_uri = neo4j_uri
        self.neo4j_user = neo4j_user
        self.neo4j_password = neo4j_password

        # 注册消息处理器
        self.register_handler("store", self._handle_store)

    async def _handle_store(self, msg: AgentMessage) -> dict:
        """处理存储请求"""
        graph_data = msg.payload.get("graph_data", {})
        neo4j_config = msg.payload.get("neo4j_config", {})

        # 转换为 Entity 和 Relation 对象
        entities = [
            Entity(
                name=e.get("name"),
                label=e.get("label"),
                embedding=e.get("embedding", []),
                description=e.get("description", ""),
            )
            for e in graph_data.get("entities", [])
        ]

        relations = []
        for r in graph_data.get("relations", []):
            # 查找实体
            start_entity = next(
                (e for e in entities if e.name == r.get("start_entity", {}).get("name")),
                None,
            )
            end_entity = next(
                (e for e in entities if e.name == r.get("end_entity", {}).get("name")),
                None,
            )

            if start_entity and end_entity:
                relations.append(
                    Relation(
                        start_entity=start_entity,
                        end_entity=end_entity,
                        label=r.get("label"),
                        name=r.get("name"),
                        embedding=r.get("embedding", []),
                        description=r.get("description", ""),
                    )
                )

        # 连接 Neo4j 并存储
        uri = neo4j_config.get("uri", self.neo4j_uri)
        user = neo4j_config.get("user", self.neo4j_user)
        password = neo4j_config.get("password", self.neo4j_password)

        try:
            connector = Neo4jConnector(uri=uri, user=user, password=password)
            connector.create_entities(entities)
            connector.create_relations(relations)
            connector.close()

            return {
                "type": "store_result",
                "task_id": msg.task_id,
                "status": "success",
                "entities_created": len(entities),
                "relations_created": len(relations),
                "errors": [],
            }

        except Exception as e:
            return {
                "type": "store_result",
                "task_id": msg.task_id,
                "status": "failed",
                "entities_created": 0,
                "relations_created": 0,
                "errors": [str(e)],
            }

    async def process(self, data: dict) -> Any:
        """处理业务数据（同步接口兼容）"""
        return await self._handle_store(
            AgentMessage(
                task_id=data.get("task_id", ""),
                type="store",
                source="internal",
                payload=data,
                timestamp=0,
            )
        )
```

### 7. 协调器实现

```python
# agents/coordinator.py
import asyncio
import time
from typing import Any, Optional
import redis.asyncio as redis

from agents.base import AgentMessage


class TaskCoordinator:
    """任务协调器 - 管理多智能体协作流程"""

    def __init__(
        self,
        redis_url: str = "redis://localhost:6379/0",
        batch_size: int = 32,
        merge_threshold: float = 0.8,
    ):
        self.redis_url = redis_url
        self.batch_size = batch_size
        self.merge_threshold = merge_threshold
        self.redis: Optional[redis.Redis] = None
        self.task_status: dict = {}

    async def start(self):
        """启动协调器"""
        self.redis = await redis.from_url(self.redis_url)

    async def stop(self):
        """停止协调器"""
        if self.redis:
            await self.redis.close()

    async def process_pdf(
        self,
        pdf_path: str,
        progress_callback: callable = None,
    ) -> dict:
        """
        处理 PDF 文件的完整流程

        Args:
            pdf_path: PDF 文件路径
            progress_callback: 进度回调函数

        Returns:
            处理结果统计
        """
        import uuid

        task_id = str(uuid.uuid4())
        start_time = time.time()

        # 初始化任务状态
        self.task_status[task_id] = {
            "stage": "distill",
            "progress": 0,
            "errors": [],
        }

        try:
            # 阶段 1: 文档解析
            if progress_callback:
                await progress_callback(task_id, "distill", 0)

            chunks = await self._distill_pdf(pdf_path, task_id)

            self.task_status[task_id]["stage"] = "extract"
            self.task_status[task_id]["total_chunks"] = len(chunks)

            # 阶段 2: 知识提取（分批处理）
            all_entities = []
            all_relations = []

            for i in range(0, len(chunks), self.batch_size):
                batch = chunks[i : i + self.batch_size]
                progress = (i + len(batch)) / len(chunks)

                if progress_callback:
                    await progress_callback(task_id, "extract", progress)

                entities, relations = await self._extract_batch(
                    batch, pdf_path, task_id
                )

                # 阶段 3: 质量检查
                approved_entities, approved_relations = await self._quality_check(
                    entities, relations, task_id
                )

                # 阶段 4: 合并
                all_relations, all_entities = await self._merge(
                    all_entities,
                    all_relations,
                    approved_entities,
                    approved_relations,
                    task_id,
                )

            # 阶段 5: 存储
            if progress_callback:
                await progress_callback(task_id, "store", 1.0)

            store_result = await self._store(all_entities, all_relations, task_id)

            self.task_status[task_id]["stage"] = "completed"
            self.task_status[task_id]["progress"] = 1.0

            return {
                "task_id": task_id,
                "status": "completed",
                "duration": time.time() - start_time,
                "statistics": {
                    "total_chunks": len(chunks),
                    "total_entities": len(all_entities),
                    "total_relations": len(all_relations),
                    "entities_created": store_result.get("entities_created", 0),
                    "relations_created": store_result.get("relations_created", 0),
                },
            }

        except Exception as e:
            self.task_status[task_id]["stage"] = "failed"
            self.task_status[task_id]["errors"].append(str(e))
            raise

    async def _distill_pdf(self, pdf_path: str, task_id: str) -> list:
        """调用 Distiller Agent 解析 PDF"""
        response_queue = f"coordinator:{task_id}"

        # 订阅响应队列
        pubsub = self.redis.pubsub()
        await pubsub.subscribe(response_queue)

        # 发送请求
        await self.redis.publish(
            "agent:distiller:input",
            AgentMessage(
                task_id=task_id,
                type="distill",
                source="coordinator",
                payload={"pdf_path": pdf_path},
                timestamp=time.time(),
                reply_to=response_queue,
            ).model_dump_json(),
        )

        # 等待响应
        async for message in pubsub.listen():
            if message["type"] == "message":
                import json

                data = json.loads(message["data"])
                if data.get("type") == "text_chunks":
                    await pubsub.unsubscribe(response_queue)
                    return data.get("chunks", [])

        raise TimeoutError("Distiller agent timeout")

    async def _extract_batch(
        self, chunks: list, pdf_path: str, task_id: str
    ) -> tuple[list, list]:
        """调用 Extractor Agent 批量提取"""
        response_queue = f"coordinator:{task_id}:extract"

        pubsub = self.redis.pubsub()
        await pubsub.subscribe(response_queue)

        await self.redis.publish(
            "agent:extractor:input",
            AgentMessage(
                task_id=task_id,
                type="extract_batch",
                source="coordinator",
                payload={"chunks": chunks, "pdf_path": pdf_path},
                timestamp=time.time(),
                reply_to=response_queue,
            ).model_dump_json(),
        )

        async for message in pubsub.listen():
            if message["type"] == "message":
                import json

                data = json.loads(message["data"])
                if data.get("type") == "batch_extraction_result":
                    await pubsub.unsubscribe(response_queue)
                    return data.get("entities", []), data.get("relations", [])

        raise TimeoutError("Extractor agent timeout")

    async def _quality_check(
        self, entities: list, relations: list, task_id: str
    ) -> tuple[list, list]:
        """调用 Quality Agent 检查质量"""
        response_queue = f"coordinator:{task_id}:quality"

        pubsub = self.redis.pubsub()
        await pubsub.subscribe(response_queue)

        await self.redis.publish(
            "agent:quality:input",
            AgentMessage(
                task_id=task_id,
                type="quality_check",
                source="coordinator",
                payload={"entities": entities, "relations": relations},
                timestamp=time.time(),
                reply_to=response_queue,
            ).model_dump_json(),
        )

        async for message in pubsub.listen():
            if message["type"] == "message":
                import json

                data = json.loads(message["data"])
                if data.get("type") == "quality_result":
                    await pubsub.unsubscribe(response_queue)
                    return data.get("entities", []), data.get("relations", [])

        raise TimeoutError("Quality agent timeout")

    async def _merge(
        self,
        entities1: list,
        relations1: list,
        entities2: list,
        relations2: list,
        task_id: str,
    ) -> tuple[list, list]:
        """调用 Merger Agent 合并数据"""
        response_queue = f"coordinator:{task_id}:merge"

        pubsub = self.redis.pubsub()
        await pubsub.subscribe(response_queue)

        await self.redis.publish(
            "agent:merger:input",
            AgentMessage(
                task_id=task_id,
                type="merge",
                source="coordinator",
                payload={
                    "existing_kg": {"entities": entities1, "relations": relations1},
                    "batch": {"entities": entities2, "relations": relations2},
                    "threshold": self.merge_threshold,
                },
                timestamp=time.time(),
                reply_to=response_queue,
            ).model_dump_json(),
        )

        async for message in pubsub.listen():
            if message["type"] == "message":
                import json

                data = json.loads(message["data"])
                if data.get("type") == "merge_result":
                    await pubsub.unsubscribe(response_queue)
                    return (
                        data.get("merged_relations", []),
                        data.get("merged_entities", []),
                    )

        raise TimeoutError("Merger agent timeout")

    async def _store(
        self, entities: list, relations: list, task_id: str
    ) -> dict:
        """调用 Storage Agent 存储数据"""
        response_queue = f"coordinator:{task_id}:store"

        pubsub = self.redis.pubsub()
        await pubsub.subscribe(response_queue)

        await self.redis.publish(
            "agent:storage:input",
            AgentMessage(
                task_id=task_id,
                type="store",
                source="coordinator",
                payload={
                    "graph_data": {"entities": entities, "relations": relations}
                },
                timestamp=time.time(),
                reply_to=response_queue,
            ).model_dump_json(),
        )

        async for message in pubsub.listen():
            if message["type"] == "message":
                import json

                data = json.loads(message["data"])
                if data.get("type") == "store_result":
                    await pubsub.unsubscribe(response_queue)
                    return data

        raise TimeoutError("Storage agent timeout")
```

### 8. 启动脚本

```python
# agents/start_agents.py
"""
多智能体启动脚本

用法:
    # 启动单个 Agent
    python start_agents.py --agent distiller

    # 启动所有 Agent
    python start_agents.py --all

    # 启动协调器
    python start_agents.py --coordinator
"""

import argparse
import asyncio
import logging
import sys
from pathlib import Path

# 添加项目路径
sys.path.insert(0, str(Path(__file__).parent.parent))

from agents.base import BaseAgent
from agents.distiller_agent import DistillerAgent
from agents.extractor_agent import ExtractorAgent
from agents.quality_agent import QualityAgent
from agents.merger_agent import MergerAgent
from agents.storage_agent import StorageAgent
from agents.coordinator import TaskCoordinator

from DISK.utils.parser import Parser
from DISK.utils.llm_proxy import LLMProxy
from langchain_community.embeddings import DashScopeEmbeddings

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


async def start_distiller_agent(redis_url: str):
    """启动 Distiller Agent"""
    agent = DistillerAgent(
        agent_id="distiller",
        redis_url=redis_url,
        work_dir="./uploads",
    )
    try:
        await agent.start()
    except KeyboardInterrupt:
        await agent.stop()


async def start_extractor_agent(redis_url: str, language: str = None):
    """启动 Extractor Agent"""
    # 初始化 LLM 和 Embeddings
    llm = LLMProxy(
        provider="dashscope",
        model_name="qwen-max",
        api_key="your-api-key",
    )

    embeddings = DashScopeEmbeddings(
        dashscope_api_key="your-api-key",
        model="text-embedding-v3",
    )

    agent = ExtractorAgent(
        agent_id="extractor",
        redis_url=redis_url,
        llm=llm,
        embeddings=embeddings,
        max_workers=4,
        language=language,
    )
    try:
        await agent.start()
    except KeyboardInterrupt:
        await agent.stop()


async def start_quality_agent(redis_url: str, threshold: float = 0.6):
    """启动 Quality Agent"""
    agent = QualityAgent(
        agent_id="quality",
        redis_url=redis_url,
        confidence_threshold=threshold,
    )
    try:
        await agent.start()
    except KeyboardInterrupt:
        await agent.stop()


async def start_merger_agent(redis_url: str, threshold: float = 0.8):
    """启动 Merger Agent"""
    agent = MergerAgent(
        agent_id="merger",
        redis_url=redis_url,
        threshold=threshold,
    )
    try:
        await agent.start()
    except KeyboardInterrupt:
        await agent.stop()


async def start_storage_agent(
    redis_url: str,
    neo4j_uri: str,
    neo4j_user: str,
    neo4j_password: str,
):
    """启动 Storage Agent"""
    agent = StorageAgent(
        agent_id="storage",
        redis_url=redis_url,
        neo4j_uri=neo4j_uri,
        neo4j_user=neo4j_user,
        neo4j_password=neo4j_password,
    )
    try:
        await agent.start()
    except KeyboardInterrupt:
        await agent.stop()


async def start_all_agents(redis_url: str, neo4j_config: dict):
    """启动所有 Agent"""
    tasks = [
        asyncio.create_task(start_distiller_agent(redis_url)),
        asyncio.create_task(start_extractor_agent(redis_url)),
        asyncio.create_task(start_quality_agent(redis_url)),
        asyncio.create_task(start_merger_agent(redis_url)),
        asyncio.create_task(
            start_storage_agent(
                redis_url,
                neo4j_config["uri"],
                neo4j_config["user"],
                neo4j_config["password"],
            )
        ),
    ]

    try:
        await asyncio.gather(*tasks)
    except KeyboardInterrupt:
        for task in tasks:
            task.cancel()


async def run_coordinator_example():
    """运行协调器示例"""
    coordinator = TaskCoordinator(redis_url="redis://localhost:6379/0")
    await coordinator.start()

    async def progress_callback(task_id, stage, progress):
        logger.info(f"Task {task_id}: {stage} - {progress:.1%}")

    try:
        result = await coordinator.process_pdf(
            pdf_path="./uploads/example.pdf",
            progress_callback=progress_callback,
        )
        logger.info(f"Processing completed: {result}")
    finally:
        await coordinator.stop()


def main():
    parser = argparse.ArgumentParser(description="DISK Multi-Agent System")
    parser.add_argument("--agent", choices=[
        "distiller", "extractor", "quality", "merger", "storage"
    ], help="Agent to start")
    parser.add_argument("--all", action="store_true", help="Start all agents")
    parser.add_argument("--coordinator", action="store_true", help="Run coordinator")
    parser.add_argument("--redis-url", default="redis://localhost:6379/0")
    parser.add_argument("--neo4j-uri", default="bolt://localhost:7687")
    parser.add_argument("--neo4j-user", default="neo4j")
    parser.add_argument("--neo4j-password", default="password")
    parser.add_argument("--language", choices=["zh", "en"], help="Document language")

    args = parser.parse_args()

    if args.all:
        neo4j_config = {
            "uri": args.neo4j_uri,
            "user": args.neo4j_user,
            "password": args.neo4j_password,
        }
        asyncio.run(start_all_agents(args.redis_url, neo4j_config))
    elif args.coordinator:
        asyncio.run(run_coordinator_example())
    elif args.agent:
        agent_functions = {
            "distiller": start_distiller_agent,
            "extractor": lambda url: start_extractor_agent(url, args.language),
            "quality": start_quality_agent,
            "merger": start_merger_agent,
            "storage": lambda url: start_storage_agent(
                url, args.neo4j_uri, args.neo4j_user, args.neo4j_password
            ),
        }
        asyncio.run(agent_functions[args.agent](args.redis_url))
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
```

---

## 部署方案

### 方案一：单机多进程部署

适合开发和小规模部署：

```
┌─────────────────────────────────────────────────────────┐
│                      单机部署                            │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │ Supervisor  │  │   Redis     │  │   Neo4j     │    │
│  │  (进程管理)  │  │  (消息队列)  │  │  (图数据库)  │    │
│  └─────────────┘  └─────────────┘  └─────────────┘    │
│         │                                              │
│         ├─► distiller_agent.py                         │
│         ├─► extractor_agent.py (×4 workers)            │
│         ├─► quality_agent.py                           │
│         ├─► merger_agent.py                            │
│         └─► storage_agent.py                           │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**使用 Supervisor 管理进程**：

```ini
# /etc/supervisor/conf.d/disk-agents.conf

[program:disk-distiller]
command=uv run python agents/start_agents.py --agent distiller
directory=/path/to/web-disk
autostart=true
autorestart=true
stderr_logfile=/var/log/disk/distiller.err.log
stdout_logfile=/var/log/disk/distiller.out.log

[program:disk-extractor]
command=uv run python agents/start_agents.py --agent extractor
directory=/path/to/web-disk
autostart=true
autorestart=true
numprocs=4
process_name=%(program_name)s_%(process_num)02d
stderr_logfile=/var/log/disk/extractor.err.log
stdout_logfile=/var/log/disk/extractor.out.log

[program:disk-quality]
command=uv run python agents/start_agents.py --agent quality
directory=/path/to/web-disk
autostart=true
autorestart=true
stderr_logfile=/var/log/disk/quality.err.log
stdout_logfile=/var/log/disk/quality.out.log

[program:disk-merger]
command=uv run python agents/start_agents.py --agent merger
directory=/path/to/web-disk
autostart=true
autorestart=true
stderr_logfile=/var/log/disk/merger.err.log
stdout_logfile=/var/log/disk/merger.out.log

[program:disk-storage]
command=uv run python agents/start_agents.py --agent storage
directory=/path/to/web-disk
autostart=true
autorestart=true
stderr_logfile=/var/log/disk/storage.err.log
stdout_logfile=/var/log/disk/storage.out.log
```

### 方案二：Docker Compose 部署

适合测试和中小规模部署：

```yaml
# docker-compose.yml
version: '3.8'

services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

  neo4j:
    image: neo4j:5-community
    environment:
      NEO4J_AUTH: neo4j/password
      NEO4J_PLUGINS: '["apoc"]'
    ports:
      - "7474:7474"
      - "7687:7687"
    volumes:
      - neo4j_data:/data

  distiller:
    build:
      context: .
      dockerfile: docker/Dockerfile.agent
    command: python agents/start_agents.py --agent distiller
    environment:
      - REDIS_URL=redis://redis:6379/0
    depends_on:
      - redis
    volumes:
      - ./uploads:/app/uploads

  extractor:
    build:
      context: .
      dockerfile: docker/Dockerfile.agent
    command: python agents/start_agents.py --agent extractor
    environment:
      - REDIS_URL=redis://redis:6379/0
      - DASHSCOPE_API_KEY=${DASHSCOPE_API_KEY}
    depends_on:
      - redis
    deploy:
      replicas: 4

  quality:
    build:
      context: .
      dockerfile: docker/Dockerfile.agent
    command: python agents/start_agents.py --agent quality
    environment:
      - REDIS_URL=redis://redis:6379/0
    depends_on:
      - redis

  merger:
    build:
      context: .
      dockerfile: docker/Dockerfile.agent
    command: python agents/start_agents.py --agent merger
    environment:
      - REDIS_URL=redis://redis:6379/0
    depends_on:
      - redis

  storage:
    build:
      context: .
      dockerfile: docker/Dockerfile.agent
    command: python agents/start_agents.py --agent storage
    environment:
      - REDIS_URL=redis://redis:6379/0
      - NEO4J_URI=bolt://neo4j:7687
      - NEO4J_USER=neo4j
      - NEO4J_PASSWORD=password
    depends_on:
      - redis
      - neo4j

volumes:
  redis_data:
  neo4j_data:
```

**Dockerfile.agent**：

```dockerfile
# docker/Dockerfile.agent
FROM python:3.11-slim

WORKDIR /app

# 安装系统依赖
RUN apt-get update && apt-get install -y \
    poppler-utils \
    tesseract-ocr \
    tesseract-ocr-chi-sim \
    && rm -rf /var/lib/apt/lists/*

# 复制项目文件
COPY DISK/ ./DISK/
COPY agents/ ./agents/
COPY pyproject.toml ./

# 安装 Python 依赖
RUN pip install --no-cache-dir -e .

CMD ["python", "agents/start_agents.py"]
```

### 方案三：Kubernetes 部署

适合大规模生产部署：

```yaml
# k8s/disk-agents-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: disk-distiller
spec:
  replicas: 2
  selector:
    matchLabels:
      app: disk-distiller
  template:
    metadata:
      labels:
        app: disk-distiller
    spec:
      containers:
      - name: distiller
        image: disk-agents:latest
        args: ["--agent", "distiller"]
        env:
        - name: REDIS_URL
          value: "redis://redis-service:6379/0"
        volumeMounts:
        - name: uploads
          mountPath: /app/uploads
      volumes:
      - name: uploads
        persistentVolumeClaim:
          claimName: uploads-pvc

---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: disk-extractor
spec:
  replicas: 8  # 可根据负载调整
  selector:
    matchLabels:
      app: disk-extractor
  template:
    metadata:
      labels:
        app: disk-extractor
    spec:
      containers:
      - name: extractor
        image: disk-agents:latest
        args: ["--agent", "extractor"]
        env:
        - name: REDIS_URL
          value: "redis://redis-service:6379/0"
        - name: DASHSCOPE_API_KEY
          valueFrom:
            secretKeyRef:
              name: disk-secrets
              key: dashscope-api-key
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "2Gi"
            cpu: "2000m"

---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: disk-quality
spec:
  replicas: 2
  selector:
    matchLabels:
      app: disk-quality
  template:
    metadata:
      labels:
        app: disk-quality
    spec:
      containers:
      - name: quality
        image: disk-agents:latest
        args: ["--agent", "quality"]
        env:
        - name: REDIS_URL
          value: "redis://redis-service:6379/0"
```

---

## 监控与调试

### 1. Agent 健康检查

```python
# agents/health_check.py
import asyncio
import redis.asyncio as redis


async def check_agents_health(redis_url: str):
    """检查所有 Agent 的健康状态"""
    r = await redis.from_url(redis_url)

    agents = ["distiller", "extractor", "quality", "merger", "storage"]
    health_status = {}

    for agent_id in agents:
        try:
            # 发送 ping 消息
            await r.publish(
                f"agent:{agent_id}:input",
                '{"type":"ping","source":"health_check"}'
            )

            # 等待 pong 响应
            pubsub = r.pubsub()
            await pubsub.subscribe(f"agent:{agent_id}:output")

            response = None
            timeout = 5

            for _ in range(timeout * 10):
                message = await pubsub.get_message(timeout=0.1)
                if message and message["type"] == "message":
                    import json

                    data = json.loads(message["data"])
                    if data.get("type") == "pong":
                        response = data
                        break

            await pubsub.unsubscribe(f"agent:{agent_id}:output")

            health_status[agent_id] = {
                "status": "healthy" if response else "unhealthy",
                "response_time": response.get("timestamp", 0) if response else None,
            }

        except Exception as e:
            health_status[agent_id] = {
                "status": "error",
                "error": str(e),
            }

    await r.close()
    return health_status


if __name__ == "__main__":
    status = asyncio.run(check_agents_health("redis://localhost:6379/0"))
    for agent, info in status.items():
        print(f"{agent}: {info['status']}")
```

### 2. 消息追踪

```python
# agents/message_tracer.py
import asyncio
import json
from collections import defaultdict
import redis.asyncio as redis


class MessageTracer:
    """消息追踪器 - 记录 Agent 间的所有消息"""

    def __init__(self, redis_url: str):
        self.redis_url = redis_url
        self.redis = None
        self.message_log = defaultdict(list)

    async def start(self):
        """启动追踪"""
        self.redis = await redis.from_url(self.redis_url)

        # 订阅所有 Agent 的输出通道
        agents = ["distiller", "extractor", "quality", "merger", "storage"]
        channels = [f"agent:{agent}:output" for agent in agents]

        pubsub = self.redis.pubsub()
        await pubsub.subscribe(*channels)

        print("🔍 Message Tracer Started. Listening to all agent outputs...")

        async for message in pubsub.listen():
            if message["type"] == "message":
                data = json.loads(message["data"])
                channel = message["channel"].decode()

                print(f"📨 [{channel}] {data.get('type')} | Task: {data.get('task_id', 'N/A')}")

                self.message_log[channel].append({
                    "timestamp": data.get("timestamp"),
                    "type": data.get("type"),
                    "source": data.get("source"),
                    "task_id": data.get("task_id"),
                })

    async def get_task_trace(self, task_id: str) -> dict:
        """获取特定任务的追踪信息"""
        trace = []

        for channel, messages in self.message_log.items():
            for msg in messages:
                if msg["task_id"] == task_id:
                    trace.append({
                        "channel": channel,
                        **msg,
                    })

        return sorted(trace, key=lambda x: x["timestamp"])

    async def print_statistics(self):
        """打印消息统计"""
        print("\n📊 Message Statistics:")
        for channel, messages in self.message_log.items():
            type_counts = defaultdict(int)
            for msg in messages:
                type_counts[msg["type"]] += 1

            print(f"\n{channel}:")
            for msg_type, count in type_counts.items():
                print(f"  {msg_type}: {count}")


if __name__ == "__main__":
    tracer = MessageTracer("redis://localhost:6379/0")
    asyncio.run(tracer.start())
```

### 3. 进度监控 API

```python
# backend/api/agent_monitor.py
from fastapi import APIRouter, WebSocket
from typing import Dict
import redis.asyncio as redis

router = APIRouter(prefix="/agent-monitor", tags=["agent-monitor"])


@router.get("/health")
async def get_agents_health():
    """获取所有 Agent 的健康状态"""
    from agents.health_check import check_agents_health

    status = await check_agents_health("redis://localhost:6379/0")
    return status


@router.get("/tasks/{task_id}")
async def get_task_status(task_id: str):
    """获取任务状态"""
    r = await redis.from_url("redis://localhost:6379/0")
    status_key = f"task:{task_id}:status"

    status = await r.hgetall(status_key)
    await r.close()

    if not status:
        return {"error": "Task not found"}

    return {
        "task_id": task_id,
        "stage": status.get(b"stage", b"unknown").decode(),
        "progress": float(status.get(b"progress", b"0")),
        "errors": status.get(b"errors", b"[]").decode(),
    }


@router.websocket("/ws/progress/{task_id}")
async def task_progress_websocket(websocket: WebSocket, task_id: str):
    """实时任务进度 WebSocket"""
    await websocket.accept()

    r = await redis.from_url("redis://localhost:6379/0")
    pubsub = r.pubsub()
    await pubsub.subscribe(f"task:{task_id}:progress")

    try:
        async for message in pubsub.listen():
            if message["type"] == "message":
                await websocket.send_text(message["data"])
    finally:
        await pubsub.unsubscribe(f"task:{task_id}:progress")
        await r.close()
```

---

## 总结

本设计方案描述了如何将现有的 DISK 单体架构重构为多智能体架构：

### 核心优势

1. **解耦**：每个处理阶段独立为一个 Agent，互不影响
2. **可扩展**：可根据负载水平扩展各个 Agent
3. **容错**：单个 Agent 失败可以重试，不影响整体
4. **监控**：完整的消息追踪和健康检查机制
5. **灵活**：易于添加新的 Agent 或修改处理逻辑

### 迁移路径

1. **第一阶段**：实现 BaseAgent 和消息协议，启动单个 Agent
2. **第二阶段**：实现所有 Agent，本地测试
3. **第三阶段**：Docker Compose 部署，集成到现有系统
4. **第四阶段**：生产环境部署，监控优化

### 兼容性

- 现有 DISK 模块代码可以复用
- 与现有 FastAPI 后端无缝集成
- 支持同步和异步两种调用方式
