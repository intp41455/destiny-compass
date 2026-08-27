import { Hono } from "hono";
import { cors } from "hono/cors";
import type { SSEEvent } from "./types.js";
import { startPipeline } from "./pipeline.js";
import { publishEvent, subscribeEvents } from "./event-bus.js";

const app = new Hono();

app.use("*", cors());

// POST /api/analyze - 启动分析任务
app.post("/api/analyze", async (c) => {
  const input = await c.req.json().catch(() => null);

  if (!input?.birthday || !input?.birthTime || !input?.gender) {
    return c.json({ error: "缺少必要字段：birthday/birthTime/gender" }, 400);
  }

  const analysisId = `analysis-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  // 异步启动流水线
  startPipeline(input, analysisId).catch(console.error);

  return c.json({
    analysisId,
    message: "分析任务已启动",
    streamUrl: `/api/stream/${analysisId}`,
  }, 202);
});

// GET /api/stream/:id - SSE 流
app.get("/api/stream/:id", async (c) => {
  const analysisId = c.req.param("id");

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      const send = (data: SSEEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      // 回放历史事件
      const history: SSEEvent[] = [];
      for (const evt of history) {
        send(evt);
      }

      // 订阅新事件
      const unsubscribe = subscribeEvents(analysisId, send);

      // 心跳
      const heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode(": heartbeat\n\n"));
      }, 15_000);

      // 客户端断开时清理
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

// GET /api/status - 健康检查
app.get("/api/status", async (c) => {
  return c.json({
    timestamp: new Date().toISOString(),
    status: "online",
    service: "destiny-compass-worker",
  });
});

export default app;
export { publishEvent, subscribeEvents };
