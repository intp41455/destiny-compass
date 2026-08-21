import { mcpUrl, MCP_CALL_TIMEOUT_MS } from "../config.js";
import type { ChartsResult, PaipanInput } from "@destiny/shared";
import type { ChatRequest } from "./types.js";

export * from "./types.js";

/**
 * 调用 MCP-Bazi 排盘：真太阳时校准 + 八字四柱
 */
export async function callBaziPaipan(
  input: PaipanInput,
): Promise<ChartsResult> {
  const response = await fetch(`${mcpUrl("BAZI")}/paipan`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(MCP_CALL_TIMEOUT_MS),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Bazi MCP ${response.status}: ${err.slice(0, 200)}`);
  }
  return response.json() as Promise<ChartsResult>;
}

/**
 * 调用 MCP-LLM 对话（非流式）
 */
export async function callLLM(req: ChatRequest): Promise<string> {
  const response = await fetch(`${mcpUrl("LLM")}/llm/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
    signal: AbortSignal.timeout(MCP_CALL_TIMEOUT_MS * 2),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`LLM MCP ${response.status}: ${err.slice(0, 200)}`);
  }

  const data = (await response.json()) as { content?: string };
  return data.content || "";
}

/**
 * 检查 MCP 服务健康状态
 */
export async function checkMcpHealth(
  port: number,
  host: string = "localhost",
): Promise<boolean> {
  try {
    const response = await fetch(`http://${host}:${port}/health`, {
      signal: AbortSignal.timeout(2000),
    });
    return response.ok;
  } catch {
    return false;
  }
}
