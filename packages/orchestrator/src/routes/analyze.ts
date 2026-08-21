import type { FastifyInstance } from "fastify";
import type { PaipanInput } from "@destiny/shared";
import { startPipeline } from "../pipeline/index.js";

/**
 * POST /api/analyze
 *
 * 启动一次命理分析流水线。
 * 客户端拿到 analysisId 后，通过 GET /api/stream/:id 订阅 SSE 结果。
 *
 * Body: PaipanInput
 *   {
 *     "birthday": "1995-06-15",
 *     "birthTime": "14:30",
 *     "gender": "male",
 *     "locationName": "北京",
 *     "lat": 39.9,        // 可选，缺失时按 locationName 查表
 *     "lng": 116.4
 *   }
 */
export async function analyzeRoutes(app: FastifyInstance) {
  app.post("/api/analyze", async (request, reply) => {
    const input = request.body as PaipanInput;

    if (!input?.birthday || !input?.birthTime || !input?.gender || !input?.locationName) {
      return reply.code(400).send({
        error: "缺少必填字段",
        required: ["birthday", "birthTime", "gender", "locationName"],
      });
    }

    if (input.gender !== "male" && input.gender !== "female") {
      return reply.code(400).send({
        error: "gender 必须为 male 或 female",
      });
    }

    const analysisId = `analysis-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    // 异步启动流水线，事件通过 EventBus 发布
    startPipeline(input, analysisId).catch((err) => {
      // 已通过 EventBus 内的 error 事件通知订阅者
      app.log.error({ err, analysisId }, "pipeline failed");
    });

    return reply.code(202).send({
      analysisId,
      message: "分析已启动，请连接 GET /api/stream/:analysisId 获取结果",
      streamUrl: `/api/stream/${analysisId}`,
    });
  });
}
