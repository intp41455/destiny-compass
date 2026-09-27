import type { LLMConfig } from "./types.js";

/**
 * 服务端默认值统一在调用时读取 process.env。
 * 不在模块顶层缓存，否则单测无法覆盖环境变量，运行时也无法感知后期注入的配置。
 */
export function serverLLMApiKey(): string {
  return process.env.LLM_API_KEY ?? "";
}

export function serverLLMBaseUrl(): string {
  return process.env.LLM_BASE_URL ?? "https://api.agnes-ai.cn";
}

export function serverLLMModel(): string {
  return process.env.LLM_MODEL ?? "agnes-2.5-flash";
}

export const ANALYSIS_TIMEOUT_MS = 120_000;
export const LLM_VERIFY_TIMEOUT_MS = 20_000;

/** 解析后的模型接入配置，三项均为必填 */
export interface ResolvedLLMConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

/**
 * 规范化 baseUrl，兼容用户各种填法：
 *  - `https://api.openai.com`                  → `https://api.openai.com/v1`
 *  - `https://api.openai.com/`                 → `https://api.openai.com/v1`
 *  - `https://api.openai.com/v1`               → `https://api.openai.com/v1`
 *  - `https://api.openai.com/v1/`              → `https://api.openai.com/v1`
 *  - `https://api.openai.com/v1/chat/completions` → `https://api.openai.com/v1`
 */
export function normalizeBaseUrl(raw: string): string {
  let url = raw.trim().replace(/\/+$/, "");
  url = url.replace(/\/chat\/completions$/, "").replace(/\/+$/, "");
  if (!/\/v\d+$/.test(url)) {
    url = `${url}/v1`;
  }
  return url;
}

/** 合并前端传入的配置与服务端默认值，前端未提供的项回退到环境变量 */
export function resolveLLMConfig(override?: LLMConfig | null): ResolvedLLMConfig {
  return {
    baseUrl: normalizeBaseUrl(override?.baseUrl?.trim() || serverLLMBaseUrl()),
    apiKey: override?.apiKey?.trim() || serverLLMApiKey(),
    model: override?.model?.trim() || serverLLMModel(),
  };
}

/** 内网 / 保留网段，禁止用户把 Worker 当成访问这些地址的代理 */
const BLOCKED_HOST_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^0\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^169\.254\./,
  /^\[?::1\]?$/,
  /^\[?f[cd][0-9a-f]{2}:/i,
  /\.local$/i,
  /\.internal$/i,
];

/**
 * 校验用户提交的 baseUrl。
 * 仅允许 http(s)，并拒绝环回地址、私有网段与内部域名，避免 SSRF。
 */
export function validateBaseUrl(raw: string): { ok: true } | { ok: false; reason: string } {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return { ok: false, reason: "Base URL 格式不合法，需要形如 https://api.example.com/v1" };
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return { ok: false, reason: "Base URL 仅支持 http/https 协议" };
  }

  const host = parsed.hostname;
  if (BLOCKED_HOST_PATTERNS.some((re) => re.test(host))) {
    return { ok: false, reason: `Base URL 不允许指向内网或本机地址：${host}` };
  }

  return { ok: true };
}
