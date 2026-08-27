# 命理罗盘 · Destiny Compass

多体系命理学分析平台，集成八字、紫微斗数、印度吠陀占星、古典西洋占星、阿拉伯占星、RAG 知识库与多源搜索，由大语言模型驱动综合分析。

## 系统架构

```
┌─────────────────────────────────────────────────────────────┐
│                      Frontend (React + Vite)                │
│                         Port 5173                           │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Orchestrator (Fastify)                   │
│                   Port 3000 /health                         │
│              Multi-stage pipeline + SSE streaming           │
└─────────────────────────────────────────────────────────────┘
         │        │        │        │        │        │
         ▼        ▼        ▼        ▼        ▼        ▼
    ┌────────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐
    │ Bazi  │ │Ziwei │ │Vedic │ │West │ │Arab │ │  RAG │
    │ :3011 │ │ :3012│ │:3013│ │:3014│ │:3015│ │:3016│
    └────────┘ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘
                                            │
                                    ┌───────────────┐
                                    │  MCP Search   │
                                    │    :3017      │
                                    └───────────────┘
                                            │
                                    ┌───────────────┐
                                    │   MCP LLM     │
                                    │    :3018      │
                                    └───────────────┘
```

## 技术栈

- **Monorepo**: pnpm workspace
- **Runtime**: Node.js 20+ (ESM, TypeScript)
- **Backend**: Fastify MCP servers
- **Frontend**: React + Vite + TailwindCSS
- **LLM**: OpenAI-compatible API (agnes-ai)
- **Architecture**: Multi-server with health-check orchestrator

## 快速开始

### 安装依赖

```bash
pnpm install
```

### 构建

```bash
pnpm run build
```

### 启动所有服务

```bash
bash scripts/start-all.sh
```

### 环境变量

复制 `.env.example` 为 `.env` 并填入 API 密钥：

```bash
cp .env.example .env
```

## 健康检查

```bash
curl http://localhost:3000/health
curl http://localhost:5173/
```

## API 端点

- `GET /health` - 健康检查（Orchestrator）
- `GET /api/services` - 所有服务状态
- `POST /api/analyze` - 开始分析（SSE 流式返回）

## 各服务端口

| 服务 | 端口 | 说明 |
|------|------|------|
| Orchestrator | 3000 | 主编排器 |
| Frontend | 5173 | React SPA |
| MCP Bazi | 3011 | 八字引擎 |
| MCP Ziwei | 3012 | 紫微斗数 |
| MCP Vedic | 3013 | 印度吠陀占星 |
| MCP Western | 3014 | 古典西洋占星 |
| MCP Arabic | 3015 | 阿拉伯占星 |
| MCP RAG | 3016 | 知识库检索 |
| MCP Search | 3017 | 多源搜索 |
| MCP LLM | 3018 | 大语言模型网关 |

## 许可证

MIT
