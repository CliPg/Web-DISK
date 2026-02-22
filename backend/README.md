# FastAPI 后端

## 架构

```
┌─────────┐      ┌────────┐      ┌──────┐      ┌─────────┐
│  前端   │ ─SSE─▶│ FastAPI│ ─▶ ─▶│Celery│ ─▶ ─▶ │ Neo4j   │
└─────────┘      │  App   │      │ Redis│      └─────────┘
       │          └────────┘      └──────┘            ▲
       ▼               │              │                │
   上传PDF      创建任务ID      异步处理          KG持久化
                            调用DISK
```

## 依赖服务

- Redis (localhost:6379)
- Neo4j (localhost:7687)
- 通义千问 API Key

## 快速启动

### 1. 安装依赖

```bash
uv sync
```

### 2. 配置环境变量

```bash
cp .env.example .env
# 编辑 .env 文件，设置 NEO4J_PASSWORD 和 LLM_API_KEY
```

### 3. 启动服务

```bash
# 终端1: 启动API服务
uv run uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload

# 终端2: 启动Celery Worker
uv run celery -A backend.tasks.celery_app worker --loglevel=info --concurrency=2

# 终端3: 启动Redis (如果需要)
redis-server

# 终端4: 启动Neo4j (如果需要)
neo4j start
```

## API 端点

### 文档管理

- `POST /api/documents/upload` - 上传PDF文档
- `GET /api/documents` - 获取文档列表
- `GET /api/documents/{id}` - 获取文档详情
- `DELETE /api/documents/{id}` - 删除文档

### 任务管理

- `GET /api/tasks/{id}` - 获取任务详情
- `GET /api/tasks/{id}/stream` - SSE流式获取任务进度
- `GET /api/tasks` - 获取任务列表
- `POST /api/tasks/{id}/cancel` - 取消任务

### 知识图谱

- `GET /api/knowledge-graph/stats` - 获取图谱统计
- `GET /api/knowledge-graph/entities` - 获取实体列表
- `GET /api/knowledge-graph/relations` - 获取关系列表
- `POST /api/knowledge-graph/clear` - 清空图谱

## 数据流

1. 用户上传PDF → FastAPI保存到 `uploads/`
2. 创建数据库记录（Document + Task）
3. 提交Celery异步任务
4. Celery Worker调用DISK处理：
   - PDF蒸馏 → 文本块
   - 实体/关系抽取（带增量合并）
   - 构建KnowledgeGraph
   - 持久化到Neo4j
5. 前端通过SSE接收进度更新
