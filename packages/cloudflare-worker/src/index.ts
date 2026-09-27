import { Hono } from "hono";
import { cors } from "hono/cors";
import type { AnalyzeRequest, LLMConfig, PaipanInput, SSEEvent } from "./types.js";
import { startPipeline } from "./pipeline.js";
import { publishEvent, subscribeEvents, ensureEntry, markStarted } from "./event-bus.js";
import {
  LLM_VERIFY_TIMEOUT_MS,
  normalizeBaseUrl,
  resolveLLMConfig,
  serverLLMApiKey,
  serverLLMBaseUrl,
  serverLLMModel,
  validateBaseUrl,
} from "./config.js";

const app = new Hono();

app.use("*", cors());

interface PendingJob {
  input: PaipanInput;
  llm?: LLMConfig;
}

const pendingJobs = new Map<string, PendingJob>();

app.post("/api/analyze", async (c) => {
  const body = await c.req.json().catch(() => null) as AnalyzeRequest | null;

  if (!body?.birthday || !body?.birthTime || !body?.gender) {
    return c.json({ error: "缺少必要字段：birthday/birthTime/gender" }, 400);
  }

  // 仅接受三项白名单字段，避免前端把任意内容透传进上游请求
  const llm: LLMConfig | undefined = body.llm
    ? {
        baseUrl: typeof body.llm.baseUrl === "string" ? body.llm.baseUrl : undefined,
        apiKey: typeof body.llm.apiKey === "string" ? body.llm.apiKey : undefined,
        model: typeof body.llm.model === "string" ? body.llm.model : undefined,
      }
    : undefined;

  if (llm?.baseUrl?.trim()) {
    const check = validateBaseUrl(normalizeBaseUrl(llm.baseUrl));
    if (!check.ok) {
      return c.json({ error: check.reason }, 400);
    }
  }

  const { llm: _omit, ...input } = body;
  void _omit;

  const analysisId = `analysis-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  ensureEntry(analysisId);
  pendingJobs.set(analysisId, { input, llm });

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
        const job = pendingJobs.get(analysisId);
        if (job) {
          pendingJobs.delete(analysisId);
          startPipeline(job.input, analysisId, job.llm).catch((err) => {
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
    llm: {
      baseUrl: normalizeBaseUrl(serverLLMBaseUrl()),
      model: serverLLMModel(),
      hasServerKey: Boolean(serverLLMApiKey()),
    },
  });
});

/** 返回服务端默认模型配置，供前端首次打开设置面板时预填。绝不返回 apiKey。 */
app.get("/api/llm/config", async (c) => {
  return c.json({
    baseUrl: normalizeBaseUrl(serverLLMBaseUrl()),
    model: serverLLMModel(),
    hasServerKey: Boolean(serverLLMApiKey()),
  });
});

/** 校验一份 OpenAI 兼容配置是否可用：发起一次最小 chat completion 请求 */
app.post("/api/llm/verify", async (c) => {
  const body = await c.req.json().catch(() => null) as LLMConfig | null;
  const llm = resolveLLMConfig(body);

  const check = validateBaseUrl(llm.baseUrl);
  if (!check.ok) {
    return c.json({ ok: false, baseUrl: llm.baseUrl, model: llm.model, error: check.reason }, 400);
  }

  if (!llm.apiKey) {
    return c.json({ ok: false, error: "缺少 API Key", baseUrl: llm.baseUrl, model: llm.model }, 400);
  }

  const startedAt = Date.now();
  try {
    const res = await fetch(`${llm.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${llm.apiKey}`,
      },
      body: JSON.stringify({
        model: llm.model,
        messages: [{ role: "user", content: "ping" }],
        max_tokens: 1,
      }),
      signal: AbortSignal.timeout(LLM_VERIFY_TIMEOUT_MS),
    });

    const latencyMs = Date.now() - startedAt;

    if (!res.ok) {
      const text = await res.text();
      return c.json({
        ok: false,
        baseUrl: llm.baseUrl,
        model: llm.model,
        latencyMs,
        status: res.status,
        error: text.slice(0, 300),
      });
    }

    return c.json({ ok: true, baseUrl: llm.baseUrl, model: llm.model, latencyMs });
  } catch (err) {
    return c.json({
      ok: false,
      baseUrl: llm.baseUrl,
      model: llm.model,
      latencyMs: Date.now() - startedAt,
      error: (err as Error).message,
    });
  }
});

export default app;
export { publishEvent, subscribeEvents };
