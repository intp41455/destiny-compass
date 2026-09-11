# Destiny Compass 项目落地实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复关键运行时缺陷，补全前后端功能，使项目可稳定部署到 Cloudflare Workers 并交付可用的 Web 体验。

**Architecture:** 后端保持 Cloudflare Worker + Hono + SSE 流式架构；前端 React + Vite + TailwindCSS，生产环境直连 Worker API；排盘计算全部在 Worker 内完成，不依赖外部 MCP 服务。

**Tech Stack:** TypeScript, Hono, Cloudflare Workers, Wrangler, React, Vite, TailwindCSS, pnpm workspace

---

## 文件结构变更

| 路径 | 操作 | 说明 |
|------|------|------|
| `packages/cloudflare-worker/src/config.ts` | 修改 | 统一 LLM base URL 与默认模型 |
| `packages/cloudflare-worker/wrangler.toml` | 修改 | 修正生产环境 LLM_BASE_URL |
| `packages/cloudflare-worker/.dev.vars` | 修改 | 同步本地开发配置 |
| `packages/cloudflare-worker/src/index.ts` | 修改 | 延迟启动 pipeline，解决 SSE 事件丢失 |
| `packages/cloudflare-worker/src/event-bus.ts` | 修改 | 支持 pipeline 延迟启动 |
| `packages/cloudflare-worker/src/ziwei.ts` | 创建 | 简化紫微斗数计算 |
| `packages/cloudflare-worker/src/types.ts` | 修改 | 增加 ZiweiResult 类型 |
| `packages/cloudflare-worker/src/pipeline.ts` | 修改 | 接入紫微斗数 |
| `packages/frontend/.env.production` | 创建 | 生产环境 API 地址 |
| `packages/frontend/src/api/client.ts` | 修改 | 使用 Vite 环境变量 |
| `packages/frontend/src/components/StatusBadge.tsx` | 修改 | 适配 Worker 状态格式 |
| `packages/frontend/src/components/InputForm.tsx` | 修改 | 输入校验与默认值 |
| `packages/frontend/src/hooks/useSSE.ts` | 修改 | 增强断线错误提示 |
| `.github/workflows/worker.yml` | 修改 | 部署到 production 环境 |
| `README.md` | 修改 | 更新部署与本地开发说明 |

---

## Task 1: 统一并修复 LLM API 配置

**Files:**
- Modify: `packages/cloudflare-worker/src/config.ts`
- Modify: `packages/cloudflare-worker/wrangler.toml`
- Modify: `packages/cloudflare-worker/.dev.vars`
- Modify: `.env.example`

当前问题：`config.ts` 默认 `LLM_BASE_URL=https://api.agnes-ai.com`，`pipeline.ts` 拼接 `/v1/chat/completions`，但 `wrangler.toml` 设置 `LLM_BASE_URL=https://api.agnes-ai.cn/v1`，导致生产环境 URL 变成 `https://api.agnes-ai.cn/v1/v1/chat/completions`。

- [ ] **Step 1: 修改 `config.ts` 默认值**

`packages/cloudflare-worker/src/config.ts` 完整内容：
```typescript
export const LLM_API_KEY = process.env.LLM_API_KEY ?? "";
export const LLM_BASE_URL = process.env.LLM_BASE_URL ?? "https://api.agnes-ai.cn";
export const LLM_MODEL = process.env.LLM_MODEL ?? "agnes-2.5-flash";
export const ANALYSIS_TIMEOUT_MS = 120_000;
```

- [ ] **Step 2: 修改 `wrangler.toml` 中的 vars**

`packages/cloudflare-worker/wrangler.toml` 中 `[vars]` 与 `[env.production.vars]` 改为：
```toml
[vars]
LLM_BASE_URL = "https://api.agnes-ai.cn"
LLM_MODEL = "agnes-2.5-flash"

[env.production.vars]
LLM_BASE_URL = "https://api.agnes-ai.cn"
LLM_MODEL = "agnes-2.5-flash"
```

- [ ] **Step 3: 修改 `.dev.vars`**

`packages/cloudflare-worker/.dev.vars` 完整内容：
```
LLM_API_KEY=
LLM_BASE_URL=https://api.agnes-ai.cn
LLM_MODEL=agnes-2.5-flash
```

- [ ] **Step 4: 修改根目录 `.env.example`**

`.env.example` 完整内容：
```bash
# 命理罗盘 Destiny Compass - 环境变量配置
# OpenAI 兼容协议

LLM_API_KEY=your-api-key-here
LLM_BASE_URL=https://api.agnes-ai.cn
LLM_DEFAULT_MODEL=agnes-2.5-flash
LLM_TIMEOUT_MS=60000
```

- [ ] **Step 5: 运行构建验证**

```bash
cd /workspace
pnpm build
```

Expected: 所有包构建成功，`packages/cloudflare-worker/dist/index.js` 生成。

- [ ] **Step 6: 提交**

```bash
git add packages/cloudflare-worker/src/config.ts packages/cloudflare-worker/wrangler.toml packages/cloudflare-worker/.dev.vars .env.example
git commit -m "fix: unify LLM_BASE_URL without redundant /v1 and set default model"
```

---

## Task 2: 修复 SSE 事件丢失竞态

**Files:**
- Modify: `packages/cloudflare-worker/src/event-bus.ts`
- Modify: `packages/cloudflare-worker/src/index.ts`

当前问题：`POST /api/analyze` 立即异步启动 `startPipeline` 并返回 `analysisId`；客户端收到 ID 后再连 SSE。若 pipeline 在 SSE 连接前已发布 `charts` 事件，且此时 `event-bus` 中尚无该 `analysisId` 的 entry，事件会丢失，用户看不到命盘。

- [ ] **Step 1: 修改 `event-bus.ts`**

`packages/cloudflare-worker/src/event-bus.ts` 完整内容：
```typescript
import type { SSEEvent } from "./types.js";

const CLEANUP_DELAY_MS = 5 * 60 * 1000;

interface EventEntry {
  history: SSEEvent[];
  subscribers: Set<(e: SSEEvent) => void>;
  terminated: boolean;
  timer: ReturnType<typeof setTimeout> | null;
  started: boolean;
}

const store = new Map<string, EventEntry>();

export function ensureEntry(analysisId: string): EventEntry {
  let entry = store.get(analysisId);
  if (!entry) {
    entry = { history: [], subscribers: new Set(), terminated: false, timer: null, started: false };
    store.set(analysisId, entry);
  }
  return entry;
}

export function markStarted(analysisId: string): boolean {
  const entry = ensureEntry(analysisId);
  if (entry.started) return false;
  entry.started = true;
  return true;
}

export function publishEvent(analysisId: string, event: SSEEvent): void {
  const entry = ensureEntry(analysisId);

  if (!entry.terminated) {
    entry.history.push(event);
  }

  for (const cb of entry.subscribers) {
    try {
      cb(event);
    } catch {
      // ignore subscriber errors
    }
  }

  if (event.type === "done" || event.type === "error") {
    entry.terminated = true;
    entry.timer = setTimeout(() => {
      store.delete(analysisId);
    }, CLEANUP_DELAY_MS);
  }
}

export function subscribeEvents(
  analysisId: string,
  callback: (e: SSEEvent) => void,
): () => void {
  const entry = ensureEntry(analysisId);

  entry.subscribers.add(callback);

  for (const evt of entry.history) {
    try {
      callback(evt);
    } catch {
      // ignore replay errors
    }
  }

  return () => {
    entry.subscribers.delete(callback);
    if (entry.subscribers.size === 0 && entry.terminated) {
      if (entry.timer) clearTimeout(entry.timer);
      store.delete(analysisId);
    }
  };
}
```

- [ ] **Step 2: 修改 `index.ts`**

`packages/cloudflare-worker/src/index.ts` 完整内容：
```typescript
import { Hono } from "hono";
import { cors } from "hono/cors";
import type { PaipanInput, SSEEvent } from "./types.js";
import { startPipeline } from "./pipeline.js";
import { publishEvent, subscribeEvents, ensureEntry, markStarted } from "./event-bus.js";

const app = new Hono();

app.use("*", cors());

const pendingInputs = new Map<string, PaipanInput>();

app.post("/api/analyze", async (c) => {
  const input = await c.req.json().catch(() => null) as PaipanInput | null;

  if (!input?.birthday || !input?.birthTime || !input?.gender) {
    return c.json({ error: "缺少必要字段：birthday/birthTime/gender" }, 400);
  }

  const analysisId = `analysis-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  ensureEntry(analysisId);
  pendingInputs.set(analysisId, input);

  return c.json({
    analysisId,
    message: "分析任务已注册，请连接 SSE",
    streamUrl: `/api/stream/${analysisId}`,
  }, 202);
});

app.get("/api/stream/:id", async (c) => {
  const analysisId = c.req.param("id");

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      const send = (data: SSEEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      const unsubscribe = subscribeEvents(analysisId, send);

      if (markStarted(analysisId)) {
        const input = pendingInputs.get(analysisId);
        if (input) {
          pendingInputs.delete(analysisId);
          startPipeline(input, analysisId).catch((err) => {
            console.error("pipeline error", err);
            publishEvent(analysisId, { type: "error", step: "pipeline", message: String(err) });
          });
        } else {
          publishEvent(analysisId, { type: "error", step: "init", message: "未找到分析输入" });
        }
      }

      const heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode(": heartbeat\n\n"));
      }, 15_000);

      c.req.raw.signal?.addEventListener("abort", () => {
        clearInterval(heartbeat);
        unsubscribe();
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
});

app.get("/api/status", async (c) => {
  return c.json({
    timestamp: new Date().toISOString(),
    status: "online",
    service: "destiny-compass-worker",
  });
});

export default app;
export { publishEvent, subscribeEvents };
```

- [ ] **Step 3: 运行 Worker 构建验证**

```bash
cd /workspace/packages/cloudflare-worker
pnpm build
```

Expected: `dist/index.js` 生成且无 TypeScript 错误。

- [ ] **Step 4: 提交**

```bash
git add packages/cloudflare-worker/src/index.ts packages/cloudflare-worker/src/event-bus.ts
git commit -m "fix: start analysis pipeline after SSE connection to prevent event loss"
```

---

## Task 3: 添加简化紫微斗数计算

**Files:**
- Create: `packages/cloudflare-worker/src/ziwei.ts`
- Modify: `packages/cloudflare-worker/src/types.ts`
- Modify: `packages/cloudflare-worker/src/pipeline.ts`

当前前端 `MultiChartsPanel` 预留了紫微斗数面板，但 Worker 未返回 `ziwei` 数据。

- [ ] **Step 1: 修改 `types.ts` 追加 ZiweiResult 类型**

在 `packages/cloudflare-worker/src/types.ts` 的 `ArabicResult` 接口之后、`ChartsResult` 接口之前插入：
```typescript
export interface ZiweiResult {
  fiveElementsClass: string;
  soulPalaceStar: string;
  soulPalaceBranch: string;
  bodyPalaceStar: string;
  bodyPalaceBranch: string;
  chineseDate: string;
  daxian: { startAge: number; endAge?: number; earthlyBranch: string }[];
  tags: string[];
}
```

并将 `ChartsResult` 接口中的内容改为包含 `ziwei?: ZiweiResult;`：
```typescript
export interface ChartsResult {
  meta: {
    birthday: string;
    solarTimeCorrected: string;
    trueSolarOffsetMin: number;
    gender: "male" | "female";
    lat: number;
    lng: number;
    timezone: string;
    locationName: string;
  };
  bazi: BaziResult;
  ziwei?: ZiweiResult;
  western?: WesternResult;
  vedic?: VedicResult;
  arabic?: ArabicResult;
  unifiedTags: string[];
}
```

- [ ] **Step 2: 创建 `ziwei.ts`**

`packages/cloudflare-worker/src/ziwei.ts` 完整内容：
```typescript
import type { ZiweiResult } from "./types.js";

const DI_ZHI = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];
const TIAN_GAN = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"];
const MAIN_STARS = ["紫微", "天机", "太阳", "武曲", "天同", "廉贞", "天府", "太阴", "贪狼", "巨门", "天相", "天梁", "七杀", "破军"];
const FIVE_ELEMENTS_MAP: Record<string, string> = {
  "甲子": "水二局", "乙丑": "金四局", "丙寅": "火六局", "丁卯": "木三局", "戊辰": "木三局",
  "己巳": "木三局", "庚午": "土五局", "辛未": "土五局", "壬申": "金四局", "癸酉": "金四局",
  "甲戌": "火六局", "乙亥": "火六局",
};

function sexagenaryYear(year: number): string {
  const gan = TIAN_GAN[((year - 4) % 10 + 10) % 10];
  const zhi = DI_ZHI[((year - 4) % 12 + 12) % 12];
  return gan + zhi;
}

function lunarYearStem(year: number): string {
  return TIAN_GAN[((year - 4) % 10 + 10) % 10];
}

export function calculateZiwei(birthDate: string, _birthTime: string, _gender: "male" | "female"): ZiweiResult {
  const [year, month, day] = birthDate.split("-").map(Number);
  const yearGZ = sexagenaryYear(year);
  const fiveElementsClass = FIVE_ELEMENTS_MAP[yearGZ] ?? "水二局";

  const soulIndex = ((month - 1 + day) % 12 + 12) % 12;
  const soulPalaceBranch = DI_ZHI[soulIndex];

  const bodyIndex = (soulIndex + 6) % 12;
  const bodyPalaceBranch = DI_ZHI[bodyIndex];

  const soulStarIdx = soulIndex % MAIN_STARS.length;
  const bodyStarIdx = bodyIndex % MAIN_STARS.length;

  const startAge = Number(fiveElementsClass.replace(/[^0-9]/g, "")) || 2;
  const daxian = Array.from({ length: 12 }, (_, i) => ({
    startAge: startAge + i * 10,
    endAge: startAge + i * 10 + 9,
    earthlyBranch: DI_ZHI[(soulIndex + i) % 12],
  }));

  const tags: string[] = [
    `${lunarYearStem(year)}年生`,
    fiveElementsClass,
    `命宫${soulPalaceBranch}`,
  ];

  return {
    fiveElementsClass,
    soulPalaceStar: MAIN_STARS[soulStarIdx],
    soulPalaceBranch,
    bodyPalaceStar: MAIN_STARS[bodyStarIdx],
    bodyPalaceBranch,
    chineseDate: `${yearGZ}年 ${month}月 ${day}日`,
    daxian,
    tags,
  };
}
```

- [ ] **Step 3: 在 `pipeline.ts` 中接入紫微斗数**

在 `packages/cloudflare-worker/src/pipeline.ts` 文件顶部，现有 import 之后追加：
```typescript
import { calculateZiwei } from "./ziwei.js";
```

在 `runAnalysisPipeline` 函数中，找到并行排盘步骤（当前已有 `westernResult`、`vedicResult`、`arabicResult`），在其后追加：
```typescript
const ziweiResult = calculateZiwei(input.birthday, input.birthTime, input.gender);
```

将 `charts` 对象构造改为：
```typescript
const charts: ChartsResult = {
  meta: {
    birthday: input.birthday,
    solarTimeCorrected: solarTime.solarTime,
    trueSolarOffsetMin: solarTime.offsetMinutes,
    gender: input.gender,
    lat,
    lng,
    timezone: solarTime.timezone,
    locationName: input.locationName,
  },
  bazi,
  ziwei: ziweiResult,
  western: westernResult,
  vedic: vedicResult,
  arabic: arabicResult,
  unifiedTags: [...new Set([...bazi.tags, ...ziweiResult.tags, ...westernResult.tags, ...vedicResult.tags, ...arabicResult.tags])],
};
```

- [ ] **Step 4: 构建验证**

```bash
cd /workspace/packages/cloudflare-worker
pnpm build
```

Expected: 无错误。

- [ ] **Step 5: 提交**

```bash
git add packages/cloudflare-worker/src/ziwei.ts packages/cloudflare-worker/src/types.ts packages/cloudflare-worker/src/pipeline.ts
git commit -m "feat: add simplified ziwei calculation and integrate into pipeline"
```

---

## Task 4: 配置前端生产环境 API

**Files:**
- Create: `packages/frontend/.env.production`
- Modify: `packages/frontend/src/api/client.ts`
- Modify: `packages/frontend/.gitignore`

- [ ] **Step 1: 创建 `packages/frontend/.env.production`**

`packages/frontend/.env.production` 完整内容：
```bash
VITE_API_BASE_URL=https://destiny-compass-prod.intp41455.workers.dev/api
```

- [ ] **Step 2: 修改 `src/api/client.ts`**

将 `packages/frontend/src/api/client.ts` 中的：
```typescript
const API_BASE = "/api";
```
替换为：
```typescript
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "/api";
```

- [ ] **Step 3: 创建 `packages/frontend/.gitignore`**

若不存在则创建，完整内容：
```
node_modules
dist
dist-ssr
.env
.env.local
.env.*.local
```

- [ ] **Step 4: 本地开发验证**

```bash
cd /workspace/packages/frontend
pnpm build
```

Expected: `dist/` 目录生成，无 TypeScript 错误。

- [ ] **Step 5: 提交**

```bash
git add packages/frontend/.env.production packages/frontend/src/api/client.ts packages/frontend/.gitignore
git commit -m "feat: configure production API base URL for frontend"
```

---

## Task 5: 适配 StatusBadge 到 Worker 状态

**Files:**
- Modify: `packages/frontend/src/components/StatusBadge.tsx`
- Modify: `packages/frontend/src/api/client.ts`

当前 Worker `/api/status` 返回 `{ status, timestamp, service }`，但 `StatusBadge` 期望 `services` 数组。需要让前端兼容 Worker 的简化响应。

- [ ] **Step 1: 修改 `src/api/client.ts` 中的类型**

将 `StatusResponse` 接口改为：
```typescript
export interface StatusResponse {
  timestamp: string;
  status?: string;
  service?: string;
  services?: ServiceStatus[];
}
```

- [ ] **Step 2: 修改 `StatusBadge.tsx`**

`packages/frontend/src/components/StatusBadge.tsx` 完整内容：
```typescript
import { useState, useEffect } from "react";
import { getStatus, type ServiceStatus } from "../api/client";

const MODULES: ServiceStatus[] = [
  { name: "BAZI", port: 1, status: "online" },
  { name: "ZIWEI", port: 2, status: "online" },
  { name: "VEDIC", port: 3, status: "online" },
  { name: "WESTERN", port: 4, status: "online" },
  { name: "ARABIC", port: 5, status: "online" },
  { name: "LLM", port: 6, status: "online" },
];

const MCP_LABELS: Record<string, string> = {
  BAZI: "八字排盘",
  ZIWEI: "紫微斗数",
  VEDIC: "印度占星",
  WESTERN: "古典占星",
  ARABIC: "阿拉伯占星",
  LLM: "LLM 分析",
};

export function StatusBadge() {
  const [services, setServices] = useState<ServiceStatus[]>(MODULES);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  useEffect(() => {
    const fetchStatus = () => {
      getStatus()
        .then((d) => {
          const isOnline = d.status === "online";
          if (d.services && d.services.length > 0) {
            setServices(d.services);
          } else {
            setServices(MODULES.map((m) => ({ ...m, status: isOnline ? "online" : "offline" })));
          }
          setLastUpdate(new Date());
        })
        .catch(() => {
          setServices(MODULES.map((m) => ({ ...m, status: "offline" })));
        });
    };
    fetchStatus();
    const interval = setInterval(fetchStatus, 10_000);
    return () => clearInterval(interval);
  }, []);

  const onlineCount = services.filter((s) => s.status === "online").length;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-zinc-500">
        <span>
          在线 <span className="text-green-600 dark:text-green-400">{onlineCount}</span> / {services.length}
        </span>
        {lastUpdate && (
          <span className="text-zinc-400">
            {lastUpdate.toLocaleTimeString("zh-CN", { hour12: false })}
          </span>
        )}
      </div>

      <div className="space-y-1">
        {services.length === 0 && (
          <div className="text-xs text-zinc-400">正在检测服务状态…</div>
        )}
        {services.map((s) => (
          <div
            key={s.name}
            className="flex items-center justify-between text-xs py-0.5"
          >
            <span className="text-zinc-700 dark:text-zinc-300">
              {MCP_LABELS[s.name] ?? s.name}
            </span>
            <span
              className={
                s.status === "online"
                  ? "text-green-600 dark:text-green-400"
                  : "text-zinc-400"
              }
            >
              ● {s.status === "online" ? "在线" : "离线"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: 构建验证**

```bash
cd /workspace/packages/frontend
pnpm build
```

Expected: 无 TypeScript 错误。

- [ ] **Step 4: 提交**

```bash
git add packages/frontend/src/components/StatusBadge.tsx packages/frontend/src/api/client.ts
git commit -m "fix: adapt StatusBadge to Cloudflare Worker status response"
```

---

## Task 6: 增强前端输入校验与 SSE 错误处理

**Files:**
- Modify: `packages/frontend/src/components/InputForm.tsx`
- Modify: `packages/frontend/src/hooks/useSSE.ts`

- [ ] **Step 1: 修改 `InputForm.tsx` 增加校验、默认值与常见城市坐标**

`packages/frontend/src/components/InputForm.tsx` 完整内容：
```typescript
import { useState } from "react";
import type { PaipanInput } from "../api/client";

interface Props {
  onSubmit: (input: PaipanInput) => void;
  loading: boolean;
}

const DEFAULT_LOCATIONS: Record<string, { lat: number; lng: number }> = {
  北京: { lat: 39.9042, lng: 116.4074 },
  上海: { lat: 31.2304, lng: 121.4737 },
  广州: { lat: 23.1291, lng: 113.2644 },
  深圳: { lat: 22.5431, lng: 114.0579 },
  成都: { lat: 30.5728, lng: 104.0668 },
  杭州: { lat: 30.2741, lng: 120.1551 },
  武汉: { lat: 30.5928, lng: 114.3055 },
  西安: { lat: 34.3416, lng: 108.9398 },
  纽约: { lat: 40.7128, lng: -74.006 },
  伦敦: { lat: 51.5074, lng: -0.1278 },
  东京: { lat: 35.6762, lng: 139.6503 },
  悉尼: { lat: -33.8688, lng: 151.2093 },
};

export function InputForm({ onSubmit, loading }: Props) {
  const [birthday, setBirthday] = useState("1990-01-01");
  const [birthTime, setBirthTime] = useState("12:00");
  const [gender, setGender] = useState<"male" | "female">("male");
  const [locationName, setLocationName] = useState("北京");
  const [useManualCoords, setUseManualCoords] = useState(false);
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!/^\d{4}-\d{2}-\d{2}$/.test(birthday)) {
      setError("请选择有效的出生日期");
      return;
    }
    if (!/^\d{2}:\d{2}$/.test(birthTime)) {
      setError("请选择有效的出生时间");
      return;
    }

    const input: PaipanInput = {
      birthday,
      birthTime,
      gender,
      locationName: useManualCoords ? locationName || "自定义" : locationName,
    };

    if (useManualCoords) {
      if (lat === "" || lng === "" || isNaN(Number(lat)) || isNaN(Number(lng))) {
        setError("请输入有效的经纬度");
        return;
      }
      input.lat = Number(lat);
      input.lng = Number(lng);
    } else {
      const match = DEFAULT_LOCATIONS[locationName.trim()];
      if (match) {
        input.lat = match.lat;
        input.lng = match.lng;
      }
    }

    onSubmit(input);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {error && (
        <div className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded p-2">
          {error}
        </div>
      )}

      <div>
        <label className="block text-xs text-zinc-500 mb-1">出生日期（公历）</label>
        <input
          type="date"
          value={birthday}
          onChange={(e) => setBirthday(e.target.value)}
          required
          className="w-full min-h-[2.75rem] px-3 py-2 bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-zinc-500 mb-1">出生时间</label>
          <input
            type="time"
            value={birthTime}
            onChange={(e) => setBirthTime(e.target.value)}
            required
            className="w-full min-h-[2.75rem] px-3 py-2 bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40"
          />
        </div>
        <div>
          <label className="block text-xs text-zinc-500 mb-1">性别</label>
          <select
            value={gender}
            onChange={(e) => setGender(e.target.value as "male" | "female")}
            className="w-full min-h-[2.75rem] px-3 py-2 bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40"
          >
            <option value="male">男</option>
            <option value="female">女</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs text-zinc-500 mb-1">出生地</label>
        <input
          type="text"
          value={locationName}
          onChange={(e) => setLocationName(e.target.value)}
          placeholder="如：北京 / 上海 / 纽约"
          required
          className="w-full min-h-[2.75rem] px-3 py-2 bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40"
        />
      </div>

      <label className="flex items-center gap-2 text-xs text-zinc-500 cursor-pointer py-1">
        <input
          type="checkbox"
          checked={useManualCoords}
          onChange={(e) => setUseManualCoords(e.target.checked)}
          className="accent-brand-600 w-4 h-4"
        />
        手动指定经纬度（地名匹配失败时使用）
      </label>

      {useManualCoords && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-zinc-500 mb-1">纬度 lat</label>
            <input
              type="number"
              step="0.0001"
              value={lat}
              onChange={(e) => setLat(e.target.value)}
              placeholder="39.9042"
              className="w-full min-h-[2.75rem] px-3 py-2 bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40"
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1">经度 lng</label>
            <input
              type="number"
              step="0.0001"
              value={lng}
              onChange={(e) => setLng(e.target.value)}
              placeholder="116.4074"
              className="w-full min-h-[2.75rem] px-3 py-2 bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40"
            />
          </div>
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full min-h-[3rem] py-2.5 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50 transition-colors active:scale-[0.98]"
      >
        {loading ? "分析中…" : "开始排盘分析"}
      </button>
    </form>
  );
}
```

- [ ] **Step 2: 修改 `useSSE.ts` 增强错误提示**

将 `packages/frontend/src/hooks/useSSE.ts` 中的 `es.onerror` 回调改为：
```typescript
      es.onerror = () => {
        setIsConnected(false);
        if (!isDone) {
          setError("SSE 连接中断，请刷新重试");
        }
      };
```

- [ ] **Step 3: 构建验证**

```bash
cd /workspace/packages/frontend
pnpm build
```

Expected: 无错误。

- [ ] **Step 4: 提交**

```bash
git add packages/frontend/src/components/InputForm.tsx packages/frontend/src/hooks/useSSE.ts
git commit -m "feat: add input validation and improve SSE error handling"
```

---

## Task 7: 修复 GitHub Actions 部署流程

**Files:**
- Modify: `.github/workflows/worker.yml`

- [ ] **Step 1: 修改 `.github/workflows/worker.yml`**

`.github/workflows/worker.yml` 完整内容：
```yaml
name: Deploy Cloudflare Worker

on:
  push:
    branches: [main, master]
    paths:
      - 'packages/cloudflare-worker/**'
      - '.github/workflows/worker.yml'
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      deployments: write
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 10

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'

      - run: pnpm install --frozen-lockfile

      - name: Build and Deploy to Cloudflare Workers
        working-directory: packages/cloudflare-worker
        run: npx wrangler deploy --env production
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          LLM_API_KEY: ${{ secrets.LLM_API_KEY }}
```

- [ ] **Step 2: 提交**

```bash
git add .github/workflows/worker.yml
git commit -m "ci: deploy worker to production environment via wrangler"
```

---

## Task 8: 端到端验证与 README 更新

**Files:**
- Modify: `README.md`

- [ ] **Step 1: 本地启动 Worker 并测试 `/api/status`**

```bash
cd /workspace/packages/cloudflare-worker
# 确保 .dev.vars 中已填入真实 LLM_API_KEY
npx wrangler dev
```

在另一个终端：
```bash
curl http://localhost:8787/api/status
```

Expected: 返回 `{"status":"online",...}`。

- [ ] **Step 2: 测试完整分析流程**

```bash
curl -X POST http://localhost:8787/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"birthday":"1990-05-15","birthTime":"14:30","gender":"male","locationName":"北京","lat":39.9042,"lng":116.4074}'
```

Expected: 返回 `{"analysisId":"...","streamUrl":"/api/stream/..."}`。

然后连接 SSE：
```bash
curl http://localhost:8787/api/stream/<analysisId>
```

Expected: 依次收到 `progress`、`charts`、`analysis`、`done` 事件。

- [ ] **Step 3: 前端本地联调**

```bash
cd /workspace/packages/frontend
pnpm dev
```

打开 `http://localhost:5173/destiny-compass/`，填写表单点击分析，确认 SSE 流正常、命盘与分析结果渲染。

- [ ] **Step 4: 更新 `README.md`**

`README.md` 完整替换为：
```markdown
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
```

- [ ] **Step 5: 提交**

```bash
git add README.md
git commit -m "docs: update README for Cloudflare Worker deployment"
```

---

## Spec Coverage 自检

| 原始需求/问题 | 覆盖任务 |
|---------------|----------|
| 修复 LLM URL 拼接错误 | Task 1 |
| 修复 SSE 事件丢失 | Task 2 |
| 补齐紫微斗数 | Task 3 |
| 前端生产环境 API | Task 4 |
| 状态显示适配 | Task 5 |
| 输入校验与错误处理 | Task 6 |
| 正确部署到 production | Task 7 |
| 文档与验证 | Task 8 |

## 执行选项

**Plan complete and saved to `docs/superpowers/plans/2026-08-30-destiny-compass-landing.md`. Two execution options:**

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
