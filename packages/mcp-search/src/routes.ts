import type { FastifyInstance } from "fastify";
import { multiSearch, type MultiSearchQuery } from "./search-engine.js";

/**
 * MCP-7 多源搜索服务路由
 *
 * 暴露：
 *  POST /search       多源搜索（query/langs/limit/sources）
 *  GET  /health       健康检查
 */
export async function searchRoutes(app: FastifyInstance) {
  app.post("/search", async (request, reply) => {
    const q = (request.body as MultiSearchQuery) ?? {};
    if (!q.query || typeof q.query !== "string" || q.query.trim().length === 0) {
      return reply.code(400).send({ error: "缺少 query 字段" });
    }
    const result = await multiSearch({
      query: q.query,
      langs: q.langs,
      limit: q.limit ?? 5,
      sources: q.sources,
    });
    return result;
  });

  app.get("/health", async () => ({ status: "ok", service: "mcp-search" }));
}
