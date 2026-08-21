import type { FastifyInstance } from "fastify";
import { MCP_PORTS, MCP_HEALTH_TIMEOUT_MS, type McpName } from "../config.js";
import { checkMcpHealth } from "../mcp-client/index.js";

/**
 * GET /api/status
 *
 * 返回所有 MCP 服务的健康状态。前端可用此接口判断当前可用能力。
 */
export async function statusRoutes(app: FastifyInstance) {
  app.get("/api/status", async () => {
    const entries = Object.entries(MCP_PORTS) as [McpName, number][];

    const services = await Promise.all(
      entries.map(async ([name, port]) => {
        const healthy = await checkMcpHealth(port);
        return {
          name,
          port,
          status: healthy ? "online" : "offline",
        };
      }),
    );

    return {
      timestamp: new Date().toISOString(),
      healthCheckTimeoutMs: MCP_HEALTH_TIMEOUT_MS,
      services,
    };
  });
}
