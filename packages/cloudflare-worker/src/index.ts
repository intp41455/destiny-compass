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
