/**
 * MCP 服务端口与编排层配置
 *
 * 端口约定（与 docker-compose 一致）：
 *  3000  orchestrator  编排层
 *  3011  mcp-bazi       八字排盘
 *  3012  mcp-ziwei      紫微斗数（Phase 2）
 *  3013  mcp-vedic      印度占星（Phase 2）
 *  3014  mcp-western    古典占星（Phase 2）
 *  3015  mcp-arabic     阿拉伯占星（Phase 2）
 *  3016  mcp-rag        命理 RAG 库（Phase 2）
 *  3017  mcp-search     多源搜索（维基/GitHub/Web）（Phase 2）
 *  3018  mcp-llm        LLM 网关
 */
export const MCP_PORTS = {
  BAZI: 3011,
  ZIWEI: 3012,
  VEDIC: 3013,
  WESTERN: 3014,
  ARABIC: 3015,
  RAG: 3016,
  SEARCH: 3017,
  LLM: 3018,
} as const;

export type McpName = keyof typeof MCP_PORTS;

export const ORCHESTRATOR_PORT = Number(process.env.PORT ?? 3000);

/** 单个 MCP 服务健康检查超时（毫秒） */
export const MCP_HEALTH_TIMEOUT_MS = 2000;

/** MCP HTTP 调用超时（毫秒） */
export const MCP_CALL_TIMEOUT_MS = 30_000;

/**
 * 获取某个 MCP 服务的 base URL。
 *
 * 支持环境变量覆盖：MCP_HOST_<NAME>（用于 docker / k8s 跨主机部署）
 * 例如 MCP_HOST_BAZI=bazi-svc.default.svc.cluster.local
 */
export function mcpUrl(name: McpName): string {
  const override = process.env[`MCP_HOST_${name}`];
  if (override) {
    return override.startsWith("http") ? override : `http://${override}`;
  }
  return `http://localhost:${MCP_PORTS[name]}`;
}
