# CLAUDE.md — 命理罗盘 (Destiny Compass)

> 本项目仅供娱乐与工程演示。命理分析不具科学依据。

## 1. 项目目的

一个多智能体编排应用，将 **5 套命理体系**（八字、紫微斗数、印度吠陀占星、古典西洋占星、阿拉伯占星）拆成独立 MCP 服务，由编排层统一调度。前端 React SPA，后端两条路径：

- **生产路径**：单个 Cloudflare Worker（Hono），嵌入全部排盘逻辑，调用 LLM 生成解读，SSE 分段流式返回。
- **本地/微服务调试路径**：独立 orchestrator（Fastify）连接 8 个 MCP 进程（每个排盘体系 + RAG + 搜索 + LLM 网关）。

核心工程问题：当一个任务需要 5 套互不相同的算法、知识库检索和 LLM 生成时，架构如何组织以做到故障隔离、独立扩容和可替换。

## 2. 技术栈

| 层级 | 技术 |
|---|---|
| 语言 | TypeScript 5.5+，全 strict 模式，ESM |
| 包管理 | pnpm workspace（`shamefully-hoist = true`，lockfile 版本 9） |
| 前端 | React 18 + Vite 5 + Tailwind CSS 3 + PostCSS |
| 生产后端 | Hono 4.6 部署于 Cloudflare Workers |
| 本地编排 | Fastify 4.28 + tsx |
| 测试 | Vitest 2 |
| 天文计算 | astronomy-engine 2.1 |
| CI/CD | GitHub Actions → Cloudflare Workers (worker.yml) + GitHub Pages (pages.yml) |

## 3. 目录结构

```
destiny-compass/
├── packages/
│   ├── shared/          # 跨包类型、常量、astronomy/geo-coding/solar-time/schemas 子模块
│   ├── frontend/        # React SPA（Vite，base=/destiny-compass/，代理 /api → :8787）
│   ├── cloudflare-worker/  # 生产后端（Hono Worker，嵌入全部排盘+流水线+SSE）
│   ├── orchestrator/    # 本地微服务编排层（Fastify，通过 MCP client 调 8 个 MCP 进程）
│   ├── mcp-bazi/        # 八字排盘 MCP（含真太阳时）
│   ├── mcp-ziwei/       # 紫微斗数 MCP（Phase 2）
│   ├── mcp-vedic/       # 印度吠陀占星 MCP（Phase 2）
│   ├── mcp-western/     # 古典西洋占星 MCP（Phase 2）
│   ├── mcp-arabic/      # 阿拉伯占星 MCP（Phase 2）
│   ├── mcp-rag/         # 命理知识库检索 MCP
│   ├── mcp-search/      # 多源检索 MCP（维基/Web）
│   └── mcp-llm/         # LLM 网关 MCP（OpenAI 兼容协议）
├── docs/                # architecture.{html,json,png}
├── scripts/start-all.sh # 一键启动所有 MCP + 编排层
├── tsconfig.base.json   # ES2022, ESNext, bundler resolution, strict
├── pnpm-workspace.yaml
└── .github/workflows/   # worker.yml（部署 Worker）+ pages.yml（部署前端）
```

## 4. 安装 / 构建 / 运行 / 测试

### 安装

```bash
pnpm install
```

### 本地开发（两种模式）

**模式 A：直接跑 Worker（推荐，最简）**

```bash
# 1. Worker（终端 1）
pnpm dev:worker          # wrangler dev --port 8787

# 2. 前端（终端 2）
pnpm dev:frontend        # Vite → http://localhost:5173/destiny-compass/
```

Worker 需要 LLM API key。复制 `.dev.vars` 模板并填入 key：
```bash
cp packages/cloudflare-worker/.dev.vars packages/cloudflare-worker/.dev.vars.local
# 编辑 .dev.vars.local: LLM_API_KEY=your-key
```

**模式 B：完整 MCP 微服务（8 个进程 + 编排层）**

```bash
pnpm dev                 # 并行启动所有服务的 dev 脚本
# 或逐个：
pnpm dev:orchestrator    # Fastify → :3000
pnpm dev:mcp-bazi        # → :3011
pnpm dev:mcp-llm         # → :3018
# ... 等等
```

### 构建

```bash
pnpm build               # 构建所有包（先 shared，再其他）
```

### 测试

```bash
pnpm test                # 运行所有包的 vitest run
```

各包也可单独测（如 `pnpm --filter @destiny/shared test`）。

### 环境变量

见 `.env.example`。关键变量：

| 变量 | 用途 |
|---|---|
| `LLM_API_KEY` | LLM API 密钥 |
| `LLM_BASE_URL` | LLM 接口地址（默认 `https://api.agnes-ai.cn`） |
| `LLM_DEFAULT_MODEL` | 默认模型（默认 `agnes-2.5-flash`） |
| `LLM_TIMEOUT_MS` | LLM 超时毫秒（默认 60000） |
| `MCP_HOST_<NAME>` | MCP 服务地址覆盖（如 `MCP_HOST_BAZI=bazi-svc:3011`），用于 docker/k8s |

Cloudflare Worker 另有 `.dev.vars` / `.dev.vars.local` 文件，不被 git 追踪。

## 5. 关键约定与坑点

### 架构约定

1. **两套后端，职责不同但逻辑镜像**。`cloudflare-worker` 嵌入全部排盘 + pipeline + SSE 逻辑，是生产版本；`orchestrator` 通过 MCP client 调用独立 MCP 进程，是本地微服务调试版本。两个版本的 pipeline/event-bus/config 逻辑高度相似但不共享代码（Worker 无法引用 MCP 依赖）。**修改 pipeline 逻辑时两边要同步。**

2. **编排层不含任何排盘算法**。`orchestrator/src/pipeline/` 只做调度与拼装；领域逻辑全在各自的 MCP 包里。Worker 是例外，它嵌入了排盘逻辑以适应 Cloudflare 运行时约束。

3. **pipeline 串行 + SSE 分段推送**。5 步流程（真太阳时排盘 → 人生分析 → 年度运势 → 月度运势 → 每日运势 ×7），每步结果通过 SSE `analysis` 事件推给前端，不等全量完成。

4. **LLM 协议是 OpenAI 兼容**，非 Anthropic。前端 `LLMSettings` 组件支持用户自主配置 base URL、API key、model。默认指向 `agnes-ai.cn`。

5. **端口约定**（`packages/orchestrator/src/config.ts`）：
   - 3000 orchestrator, 3011 bazi, 3012 ziwei, 3013 vedic, 3014 western, 3015 arabic, 3016 rag, 3017 search, 3018 llm
   - `MCP_CALL_TIMEOUT_MS = 30000`, `MCP_HEALTH_TIMEOUT_MS = 2000`

### 构建与工具

6. **pnpm shamefully-hoist = true**（`.pnpmrc`），兼容不支持 pnpm 半严格模式的工具。

7. **shared 包必须先构建**。它是其他包（如 orchestrator）的 workspace 依赖（`"@destiny/shared": "workspace:*"`），构建命令 `pnpm build` 递归处理所有包时会按依赖顺序执行，但如果手动逐个构建，先 `pnpm --filter @destiny/shared build`。

8. **前端 Vite base path 是 `/destiny-compass/`**。部署到 GitHub Pages 的非根路径；本地 `http://localhost:5173/destiny-compass/`。所有静态资源路径和路由需考虑此前缀。

9. **前端 Vite 代理 `/api` → `http://localhost:8787`**（即 Worker）。开发时需先启动 Worker。

10. **前端无 `__tests__` 目录**。目前只有后端包有 Vitest 测试。

### CI/CD

11. **worker.yml** 在 push 到 `main`/`master`/`feat/destiny-compass-landing` 且 `packages/cloudflare-worker/**` 变更时触发，需要 3 个 Secrets：`CLOUDFLARE_API_TOKEN`、`CLOUDFLARE_ACCOUNT_ID`、`LLM_API_KEY`。

12. **pages.yml** 在 push 到相同分支时触发（无路径过滤），无需额外 Secrets，使用 GitHub Pages 内建 OIDC 认证。

13. **Workflow 的 pnpm 版本不一致**：worker.yml 用 pnpm 10 + Node 22；pages.yml 用 pnpm 9 + Node 20。本地锁文件版本也可能与 CI 不一，注意同步。

### 已知技术边界

14. **Ziwei/Vedic/Western/Arabic 排盘算法标注 Phase 2**：骨架和接口已就绪，但算法完整性不如 Bazi。

15. **编排层是单点**：EventBus 在进程内存（history/subscribers/terminated），无外部持久化。生产化需要多副本 + 会话状态外置。

16. **缺少端到端/集成测试**：pipeline 的编排正确性缺少集成测试覆盖，目前只有单元测试。

17. **多进程本地开发偏重**：需要 docker-compose 或逐个起进程（`scripts/start-all.sh` 可一键启动）。