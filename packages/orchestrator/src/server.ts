import Fastify from "fastify";
import cors from "@fastify/cors";
import { analyzeRoutes } from "./routes/analyze.js";
import { streamRoutes } from "./routes/stream.js";
import { statusRoutes } from "./routes/status.js";
import { ORCHESTRATOR_PORT } from "./config.js";

async function start() {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? "info",
    },
  });
  await app.register(cors, { origin: true });

  await app.register(analyzeRoutes);
  await app.register(streamRoutes);
  await app.register(statusRoutes);

  app.get("/", async () => ({
    service: "destiny-compass-orchestrator",
    version: "0.1.0",
    endpoints: {
      "POST /api/analyze": "启动命理分析流水线",
      "GET  /api/stream/:id": "订阅分析进度 SSE",
      "GET  /api/status": "查看 MCP 服务健康状态",
    },
  }));

  try {
    await app.listen({ port: ORCHESTRATOR_PORT, host: "0.0.0.0" });
    app.log.info(`Orchestrator listening on http://0.0.0.0:${ORCHESTRATOR_PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
