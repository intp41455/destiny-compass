# 命理罗盘 · Destiny Compass

多体系命理学分析平台，集成八字、紫微斗数、印度吠陀占星、古典西洋占星、阿拉伯占星，由大语言模型驱动综合分析。后端为单个 Cloudflare Worker，前端为 React SPA。

## 系统架构

```
┌─────────────────────────────────────────────┐
│         Frontend (React + Vite)             │
│              /destiny-compass/              │
└─────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────┐
│     Cloudflare Worker (Hono + SSE)          │
│  /api/status  /api/analyze  /api/stream/:id │
└─────────────────────────────────────────────┘
```

## 本地开发

```bash
pnpm install
cp packages/cloudflare-worker/.dev.vars packages/cloudflare-worker/.dev.vars.local
# 编辑 .dev.vars.local 填入 LLM_API_KEY

# 终端 1：启动 Worker
pnpm dev:worker

# 终端 2：启动前端
pnpm dev:frontend
```

前端访问 `http://localhost:5173/destiny-compass/`，API 通过 Vite proxy 转发到 `http://localhost:8787`。

## 部署

### 后端

在 GitHub 仓库 Settings → Secrets and variables → Actions 中添加：
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `LLM_API_KEY`

推送代码到 `master` 会自动触发 `.github/workflows/worker.yml` 部署到 `destiny-compass-prod`。

### 前端

前端构建产物在 `packages/frontend/dist/`，可部署到任意静态托管（GitHub Pages、Cloudflare Pages 等）。

## 环境变量

| 变量 | 说明 |
|------|------|
| `LLM_API_KEY` | OpenAI 兼容 API 密钥 |
| `LLM_BASE_URL` | 默认 `https://api.agnes-ai.cn` |
| `LLM_MODEL` | 默认 `agnes-2.5-flash` |
