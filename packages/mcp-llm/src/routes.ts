import type { FastifyInstance } from "fastify";
import {
  chatCompletion,
  chatCompletionStream,
  getProviderConfig,
  type ChatRequest,
} from "./llm-adapter.js";

/**
 * MCP-8 LLM 网关路由
 * 暴露：
 *  POST /llm/chat     调用 LLM（stream=true 时返回 SSE）
 *  GET  /health       健康检查 + 配置可见性
 */
export async function llmRoutes(app: FastifyInstance) {
  app.post("/llm/chat", async (request, reply) => {
    const req = request.body as ChatRequest;
    if (!req?.messages || !Array.isArray(req.messages) || req.messages.length === 0) {
      return reply.code(400).send({ error: "messages 不能为空" });
    }

    try {
      if (req.stream) {
        const stream = await chatCompletionStream(req);
        // Fastify 支持 ReadableStream 作为 reply body
        reply.raw.setHeader("Content-Type", "text/event-stream");
        reply.raw.setHeader("Cache-Control", "no-cache");
        reply.raw.setHeader("Connection", "keep-alive");
        // 将 Web ReadableStream 管道到 raw response
        const reader = stream.getReader();
        const writer = reply.raw;
        // 处理后端关闭
        reply.raw.on("close", () => reader.cancel().catch(() => {}));
        try {
          // eslint-disable-next-line no-constant-condition
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value) writer.write(Buffer.from(value));
          }
        } finally {
          writer.end();
        }
        return reply;
      }
      const content = await chatCompletion(req);
      return { content };
    } catch (err) {
      const config = getProviderConfig();
      return reply.code(503).send({
        error: "LLM调用失败",
        message: (err as Error).message,
        configured: config.apiKey !== null,
      });
    }
  });

  app.get("/health", async () => {
    const config = getProviderConfig();
    return {
      status: "ok",
      service: "mcp-llm",
      configured: config.apiKey !== null,
      baseUrl: config.baseUrl,
      defaultModel: config.defaultModel,
      timeoutMs: config.timeoutMs,
    };
  });
}
