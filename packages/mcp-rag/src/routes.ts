import type { FastifyInstance } from "fastify";
import { ragStore, type RagQuery, type RagHit } from "./rag-engine.js";
import type { KnowledgeEntry } from "./seed-knowledge.js";

/**
 * MCP-6 RAG 知识库服务路由
 *
 * 暴露：
 *  POST /search      Top-K 检索（query.tags / query.system / query.topK）
 *  POST /documents   新增 / 替换知识条目
 *  GET  /documents    列出所有条目
 *  DELETE /documents/:id  删除条目
 *  GET  /health      健康检查
 */
export async function ragRoutes(app: FastifyInstance) {
  app.post("/search", async (request, reply) => {
    const q = (request.body as RagQuery) ?? {};
    if (!q?.tags || !Array.isArray(q.tags) || q.tags.length === 0) {
      return reply.code(400).send({ error: "缺少 tags 字段或为空数组" });
    }
    const hits: RagHit[] = ragStore.query({
      tags: q.tags,
      system: q.system,
      topK: q.topK ?? 5,
    });
    return {
      total: hits.length,
      hits,
    };
  });

  app.post("/documents", async (request, reply) => {
    const e = request.body as KnowledgeEntry;
    if (!e?.id || !e?.system || !e?.text) {
      return reply.code(400).send({ error: "缺少 id/system/text 字段" });
    }
    if (!Array.isArray(e.tags)) {
      return reply.code(400).send({ error: "tags 必须为数组" });
    }
    ragStore.add(e);
    return { status: "ok", id: e.id, total: ragStore.size() };
  });

  app.get("/documents", async () => ({
    total: ragStore.size(),
    entries: ragStore.list(),
  }));

  app.delete("/documents/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const removed = ragStore.remove(id);
    if (!removed) return reply.code(404).send({ error: `未找到 id=${id}` });
    return { status: "ok", id, total: ragStore.size() };
  });

  app.get("/health", async () => ({
    status: "ok",
    service: "mcp-rag",
    entries: ragStore.size(),
  }));
}
