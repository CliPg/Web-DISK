<div align="center">

# Web Disk Knowledge Graph

### 基于领域增量构建的知识图谱系统

[![Python Version](https://img.shields.io/badge/python-3.10+-blue.svg)](https://www.python.org/downloads/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-green.svg)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-19.2+-61DAFB?logo=react)](https://react.dev)
[![License](https://img.shields.io/badge/license-MIT-purple.svg)](LICENSE)

一个功能完整的知识图谱构建系统，能够从 PDF 文档中自动提取实体和关系，构建结构化的领域知识图谱，并提供现代化的 Web 可视化界面。

[功能特性](#-功能特性) • [快速开始](#-快速开始) • [系统架构](#-系统架构) • [API 文档](#-api-文档) • [开发指南](#-开发指南)

</div>

---

## 📋 项目简介

**Web Disk Knowledge Graph** 是一个基于 DISK（Domain Incremental conStruction of Knowledge Graphs）模块的智能知识图谱构建系统。系统通过自然语言处理和机器学习技术，从非结构化的 PDF 文档中提取结构化知识，支持增量式知识图谱构建和语义合并。

<p align="center">
  <img src="./docs/imgs/show.png" width="600">
</p>

### 核心价值

- **自动化知识提取**：从 PDF 文档自动识别实体、关系和属性
- **增量式构建**：支持断点续传，处理大文档无需从头开始
- **智能语义合并**：基于余弦相似度的实体去重与合并
- **实时可视化**：现代化的 Web 界面展示知识图谱和处理进度
- **模块化设计**：DISK 核心模块可独立使用，易于集成到其他项目

---

## ✨ 功能特性

### 🎯 文档处理
- **多格式支持**：主要支持 PDF 文档处理
- **OCR 能力**：集成 PaddleOCR 和 Tesseract，处理扫描版 PDF
- **文本蒸馏**：智能提取和清理文本内容，保留语义结构
- **批量处理**：支持多文档并发处理

### 🧠 知识提取
- **实体识别**：自动识别文档中人名、地名、机构、术语等实体
- **关系抽取**：提取实体间的语义关系
- **属性提取**：获取实体的详细属性信息
- **LLM 增强**：支持多种大语言模型进行智能提取

### 📊 知识图谱
- **图数据库存储**：使用 Neo4j 存储和管理知识图谱
- **图遍历查询**：支持复杂的多跳关系查询
- **图算法支持**：内置路径查找、社区发现等图算法
- **可视化展示**：交互式图谱可视化界面

### 🔄 任务管理
- **异步处理**：基于 Celery 的异步任务队列
- **进度监控**：实时查看处理进度和状态
- **断点续传**：支持从断点继续处理
- **错误处理**：完善的异常处理和日志记录

### 🎨 用户界面
- **现代化设计**：玻璃态（Glassmorphism）UI 风格
- **响应式布局**：适配桌面和移动设备
- **实时更新**：WebSocket 实时推送处理进度
- **暗色模式**：支持深色主题切换

---

## 🚀 快速开始

### 环境要求

- **Python**: 3.10 或更高版本
- **Node.js**: 18.0 或更高版本
- **Redis**: 6.0 或更高版本
- **Neo4j**: 5.0 或更高版本（可选，用于知识图谱存储）

### 1. 克隆项目

```bash
git clone https://github.com/CliPg/Web-DISK.git
cd web-disk
git clone https://github.com/CliPg/DISK.git
```

### 2. 安装依赖

**后端依赖**（使用 [uv](https://github.com/astral-sh/uv)）：

```bash
# 安装 uv（如果尚未安装）
curl -LsSf https://astral.sh/uv/install.sh | sh

# 创建虚拟环境并安装依赖
uv sync
```

**前端依赖**：

```bash
cd frontend
npm install
cd ..
```

### 3. 配置环境变量

复制环境变量模板并编辑：

```bash
cp .env.example .env
```

编辑 `.env` 文件，配置以下关键参数：

```env
# Neo4j 配置（必需）
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=your_neo4j_password

# Redis 配置（必需）
REDIS_URL=redis://localhost:6379/0

# LLM 配置（可选，用于智能提取）
LLM_API_KEY=your_dashscope_api_key
LLM_MODEL=qwen-plus
```

### 4. 启动服务

**启动依赖服务**：

```bash
# 使用 Docker Compose 启动 Redis 和 Neo4j（推荐）
docker-compose up -d

# 或手动启动 Redis 和 Neo4j
redis-server
neo4j start
```

**启动后端服务**：

```bash
# 激活虚拟环境
source .venv/bin/activate  # Linux/macOS
# 或
.venv\Scripts\activate     # Windows

# 启动 FastAPI 服务器
uv run uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

**启动 Celery Worker**（新终端窗口）：

```bash
source .venv/bin/activate
uv run celery -A backend.worker.celery_app worker --loglevel=info
```

**启动前端服务**（新终端窗口）：

```bash
cd frontend
npm run dev
```

### 5. 访问应用

- **前端界面**: http://localhost:5173
- **API 文档**: http://localhost:8000/docs
- **Neo4j 浏览器**: http://localhost:7474

---

## 🏗️ 系统架构

### 整体架构图

```
┌─────────────────────────────────────────────────────────────────────┐
│                              用户界面层                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │
│  │  文档管理   │  │  图谱可视化 │  │  流程监控   │  │   搜索     │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
                                    ▲
                                    │ HTTP/WebSocket
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                              API 网关层                               │
│                    ┌─────────────────────────────┐                   │
│                    │       FastAPI Router        │                   │
│                    └─────────────────────────────┘                   │
└─────────────────────────────────────────────────────────────────────┘
                                    ▲
                                    │
                ┌───────────────────┼───────────────────┐
                ▼                   ▼                   ▼
┌───────────────────┐   ┌───────────────────┐   ┌───────────────────┐
│   文档 API        │   │   任务 API        │   │   知识图谱 API    │
│   /api/documents  │   │   /api/tasks      │   │   /api/kg         │
└───────────────────┘   └───────────────────┘   └───────────────────┘
                ▲                   ▲                   ▲
                │                   │                   │
                └───────────────────┼───────────────────┘
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                             业务逻辑层                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────────┐ │
│  │ 文档处理器  │  │ 任务调度器  │  │       DISK 核心模块          │ │
│  └─────────────┘  └─────────────┘  │  ┌─────┐  ┌─────┐  ┌─────┐  │ │
│                                   │  │蒸馏器│  │提取器│  │合并器│  │ │
│                                   │  └─────┘  └─────┘  └─────┘  │ │
│                                   └─────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
                ▲                                                   ▲
                │                                                   │
                └───────────────────┬───────────────────────────────┘
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                             数据存储层                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐│
│  │   SQLite    │  │   Neo4j     │  │   Redis     │  │  文件存储   ││
│  │  (元数据)   │  │  (知识图谱) │  │  (任务队列) │  │   (PDF)     ││
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘│
└─────────────────────────────────────────────────────────────────────┘
```

### DISK 核心模块

DISK（Domain Incremental conStruction of Knowledge Graphs）是系统的核心知识图谱构建引擎：

```
DISK/
├── distiller/          # PDF 文本蒸馏器
│   ├── pdf_distiller.py    # PDF 文本提取
│   └── ocr_processor.py    # OCR 图像识别
├── extractor/          # 知识提取器
│   ├── entities_extractor.py   # 实体提取
│   ├── relations_extractor.py  # 关系提取
│   └── extractor.py            # 统一提取接口
├── merger/             # 语义合并器
│   └── merger.py            # 基于相似度的实体合并
├── manager/            # 知识图谱管理器
│   └── kg_manager.py        # 图谱增删改查
├── models/             # 数据模型
│   ├── knowledge_graph.py   # 知识图谱数据结构
│   └── neo4j_connector.py   # Neo4j 连接器
└── utils/              # 工具函数
    └── checkpoint.py        # 断点续传支持
```

### 数据处理流程

```
PDF 文档上传
    │
    ▼
┌─────────────────┐
│  文档验证存储   │
└─────────────────┘
    │
    ▼
┌─────────────────┐     ┌─────────────────┐
│  PDF 文本蒸馏   │────▶│   OCR 处理      │
│  (pdfplumber)   │     │  (PaddleOCR)    │
└─────────────────┘     └─────────────────┘
    │
    ▼
┌─────────────────┐
│  文本分块处理   │
└─────────────────┘
    │
    ▼
┌─────────────────┐     ┌─────────────────┐
│  实体提取 (LLM) │────▶│  关系提取 (LLM) │
└─────────────────┘     └─────────────────┘
    │                         │
    └─────────────┬───────────┘
                  ▼
        ┌─────────────────┐
        │  语义合并去重   │
        │ (Cosine Similar)│
        └─────────────────┘
                  │
                  ▼
        ┌─────────────────┐
        │  知识图谱构建   │
        │    (Neo4j)      │
        └─────────────────┘
```

---

## 📡 API 文档

### 文档管理 API

| 方法 | 端点 | 描述 |
|------|------|------|
| POST | `/api/documents/upload` | 上传 PDF 文档 |
| GET | `/api/documents` | 获取文档列表 |
| GET | `/api/documents/{id}` | 获取文档详情 |
| DELETE | `/api/documents/{id}` | 删除文档 |

### 任务管理 API

| 方法 | 端点 | 描述 |
|------|------|------|
| POST | `/api/tasks/create` | 创建处理任务 |
| GET | `/api/tasks` | 获取任务列表 |
| GET | `/api/tasks/{id}` | 获取任务详情 |
| GET | `/api/tasks/{id}/status` | 获取任务状态 |
| DELETE | `/api/tasks/{id}` | 取消任务 |

### 知识图谱 API

| 方法 | 端点 | 描述 |
|------|------|------|
| GET | `/api/kg/nodes` | 获取所有节点 |
| GET | `/api/kg/edges` | 获取所有边 |
| GET | `/api/kg/node/{id}` | 获取节点详情 |
| GET | `/api/kg/path` | 查找节点间路径 |
| POST | `/api/kg/query` | Cypher 查询 |

详细 API 文档请访问：`http://localhost:8000/docs`

---

## 🛠️ 开发指南

### 代码规范

**Python 代码风格**：
- 遵循 PEP 8 规范
- 使用 ruff 进行格式化和检查
- 行长度限制：100 字符
- 类型注解：所有函数应包含类型提示

**TypeScript 代码风格**：
- 使用 ESLint + TypeScript ESLint
- 遵循 React 最佳实践
- 组件使用函数式组件和 Hooks

### 运行测试

```bash
# Python 测试
uv run pytest

# 前端测试
cd frontend
npm test
```

### 代码格式化

```bash
# Python 代码格式化
uv run ruff format backend/ DISK/

# Python 代码检查
uv run ruff check backend/ DISK/

# 前端代码格式化
cd frontend
npm run lint
```

### 项目结构

```
web-disk/
├── backend/                # FastAPI 后端
│   ├── api/               # API 路由
│   ├── core/              # 核心配置
│   ├── db/                # 数据库会话
│   ├── models/            # SQLAlchemy 模型
│   └── worker/            # Celery 任务
├── frontend/              # React 前端
│   ├── src/
│   │   ├── components/    # UI 组件
│   │   ├── pages/         # 页面组件
│   │   ├── services/      # API 服务
│   │   └── types/         # TypeScript 类型
│   └── public/            # 静态资源
├── DISK/                  # 知识图谱构建模块
│   ├── distiller/         # 文本蒸馏
│   ├── extractor/         # 知识提取
│   ├── merger/            # 语义合并
│   ├── manager/           # 图谱管理
│   └── models/            # 数据模型
├── data/                  # SQLite 数据库
├── uploads/               # 文件上传目录
├── .env.example           # 环境变量模板
├── pyproject.toml         # Python 项目配置
└── README.md              # 项目文档
```

---

## 🔧 配置说明

### 环境变量

| 变量名 | 描述 | 默认值 |
|--------|------|--------|
| `API_V1_PREFIX` | API 路径前缀 | `/api` |
| `HOST` | 服务器地址 | `0.0.0.0` |
| `PORT` | 服务器端口 | `8000` |
| `CORS_ORIGINS` | 允许的跨域来源 | `http://localhost:5173` |
| `NEO4J_URI` | Neo4j 连接地址 | `bolt://localhost:7687` |
| `NEO4J_USER` | Neo4j 用户名 | `neo4j` |
| `NEO4J_PASSWORD` | Neo4j 密码 | - |
| `REDIS_URL` | Redis 连接地址 | `redis://localhost:6379/0` |
| `LLM_API_KEY` | LLM API 密钥 | - |
| `LLM_MODEL` | LLM 模型名称 | `qwen-plus` |

---

## 📦 部署

### Docker 部署

```bash
# 构建并启动所有服务
docker-compose up -d

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down
```

### 生产环境配置

1. **修改环境变量**：使用生产环境配置
2. **数据库备份**：配置 Neo4j 和 Redis 持久化
3. **负载均衡**：使用 Nginx 反向代理
4. **监控日志**：配置日志收集和监控

---

## 🤝 贡献指南

欢迎贡献代码、报告问题或提出建议！

1. Fork 项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

---

## 📄 许可证

本项目采用 MIT 许可证 - 详见 [LICENSE](LICENSE) 文件

---

## 🙏 致谢

- [FastAPI](https://fastapi.tiangolo.com) - 现代化的 Python Web 框架
- [React](https://react.dev) - 用于构建用户界面的 JavaScript 库
- [Neo4j](https://neo4j.com) - 高性能图数据库
- [Celery](https://docs.celeryproject.org) - 分布式任务队列
- [PaddleOCR](https://github.com/PaddlePaddle/PaddleOCR) - OCR 识别引擎

---

## 📞 联系方式

- 项目主页: [https://github.com/CliPg/web-disk](https://github.com/CliPg/web-disk)
- 问题反馈: [Issues](https://github.com/CliPg/web-disk/issues)

---

<div align="center">

**如果这个项目对您有帮助，请给一个 ⭐️**

Made with ❤️ by CliPg

</div>
