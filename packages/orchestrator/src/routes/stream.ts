import type { FastifyInstance } from "fastify";
import type { SSEEvent } from "@destiny/shared";
import { eventBus } from "../event-bus.js";

/**
 * GET /api/stream/:id
 *
 * 订阅某个 analysisId 的 SSE 事件流。
 *
 * 行为：
 *  - 立即回放已发布的所有事件（按时间顺序）
 *  - 后续新事件实时推送
 *  - 收到 done 或 error 事件后关闭连接
 *  - 客户端断开时取消订阅
 *
 * 事件格式（兼容 EventSource）：
 *  event: <type>
 *  data: <json>
 *  <blank line>
 */
export async function streamRoutes(app: FastifyInstance) {
  app.get("/api/stream/:id", async (request, reply) => {
    const { id } = request.params as { id: string };

    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });

    // 心跳：每 15 秒发一个注释行，避免代理超时关闭连接
    const heartbeat = setInterval(() => {
      try {
        reply.raw.write(": heartbeat\n\n");
      } catch {
        // ignore
      }
    }, 15_000);

    const writeEvent = (event: SSEEvent) => {
      try {
        reply.raw.write(`event: ${event.type}\n`);
        reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
      } catch {
        // socket 已断
      }
    };

    // 订阅（EventBus 内部已回放历史）
    const unsubscribe = eventBus.subscribe(id, writeEvent);

    // 清理
    const cleanup = () => {
      clearInterval(heartbeat);
      unsubscribe();
    };

    request.raw.on("close", cleanup);
    request.raw.on("error", cleanup);

    // 如果已经终止，直接关闭
    if (eventBus.isTerminated(id)) {
      cleanup();
      reply.raw.end();
    }
  });
}
