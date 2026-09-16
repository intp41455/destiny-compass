import { mcpUrl, MCP_CALL_TIMEOUT_MS } from "../config.js";
import type {
  ChartsResult,
  PaipanInput,
  ZiweiResult,
  VedicResult,
  WesternResult,
  ArabicResult,
} from "@destiny/shared";
import type { ChatRequest } from "./types.js";

export * from "./types.js";

interface McpPaipanResponse<T> {
  meta: ChartsResult["meta"];
  bazi?: ChartsResult["bazi"];
  ziwei?: ZiweiResult;
  vedic?: VedicResult;
  western?: WesternResult;
  arabic?: ArabicResult;
}

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
 * 调用 MCP-Ziwei 紫微斗数排盘
 */
export async function callZiweiPaipan(
  input: PaipanInput,
): Promise<McpPaipanResponse<ZiweiResult>> {
  const response = await fetch(`${mcpUrl("ZIWEI")}/paipan`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(MCP_CALL_TIMEOUT_MS),
  });
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Ziwei MCP ${response.status}: ${err.slice(0, 200)}`);
  }
  return response.json() as Promise<McpPaipanResponse<ZiweiResult>>;
}

/**
 * 调用 MCP-Vedic 印度占星排盘
 *
 * 注意：vedic/arabic 服务需要 age 参数；编排层会从 birthday 推算
 */
export async function callVedicPaipan(
  input: PaipanInput,
  age: number,
): Promise<McpPaipanResponse<VedicResult>> {
  const response = await fetch(`${mcpUrl("VEDIC")}/paipan`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...input, age }),
    signal: AbortSignal.timeout(MCP_CALL_TIMEOUT_MS),
  });
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Vedic MCP ${response.status}: ${err.slice(0, 200)}`);
  }
  return response.json() as Promise<McpPaipanResponse<VedicResult>>;
}

/**
 * 调用 MCP-Western 古典占星排盘
 */
export async function callWesternPaipan(
  input: PaipanInput,
  age: number,
): Promise<McpPaipanResponse<WesternResult>> {
  const response = await fetch(`${mcpUrl("WESTERN")}/paipan`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...input, age }),
    signal: AbortSignal.timeout(MCP_CALL_TIMEOUT_MS),
  });
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Western MCP ${response.status}: ${err.slice(0, 200)}`);
  }
  return response.json() as Promise<McpPaipanResponse<WesternResult>>;
}

/**
 * 调用 MCP-Arabic 阿拉伯占星排盘
 */
export async function callArabicPaipan(
  input: PaipanInput,
): Promise<McpPaipanResponse<ArabicResult>> {
  const response = await fetch(`${mcpUrl("ARABIC")}/paipan`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(MCP_CALL_TIMEOUT_MS),
  });
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Arabic MCP ${response.status}: ${err.slice(0, 200)}`);
  }
  return response.json() as Promise<McpPaipanResponse<ArabicResult>>;
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
 * 调用 MCP-RAG 知识库 Top-K 检索
 */
export async function callRagSearch(
  tags: string[],
  opts?: { system?: string; topK?: number },
): Promise<{
  total: number;
  hits: Array<{
    entry: {
      id: string;
      system: string;
      tags: string[];
      title: string;
      text: string;
      source: string;
    };
    score: number;
    matchedTags: string[];
  }>;
}> {
  const response = await fetch(`${mcpUrl("RAG")}/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      tags,
      system: opts?.system,
      topK: opts?.topK ?? 6,
    }),
    signal: AbortSignal.timeout(MCP_CALL_TIMEOUT_MS),
  });
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`RAG MCP ${response.status}: ${err.slice(0, 200)}`);
  }
  return response.json();
}

/**
 * 调用 MCP-Search 多源搜索
 */
export async function callMultiSearch(
  query: string,
  opts?: { limit?: number; sources?: Array<"wikipedia" | "github" | "duckduckgo">; langs?: Array<"zh" | "en"> },
): Promise<{
  query: string;
  hits: Array<{ title: string; url: string; snippet: string; source: string }>;
  errors: Array<{ source: string; message: string }>;
}> {
  const response = await fetch(`${mcpUrl("SEARCH")}/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query,
      limit: opts?.limit ?? 5,
      sources: opts?.sources,
      langs: opts?.langs,
    }),
    signal: AbortSignal.timeout(MCP_CALL_TIMEOUT_MS * 2),
  });
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Search MCP ${response.status}: ${err.slice(0, 200)}`);
  }
  return response.json();
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
