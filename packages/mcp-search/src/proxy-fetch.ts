/**
 * 代理感知的 fetch 实现
 *
 * 自动识别 HTTP_PROXY / HTTPS_PROXY / lowercase 变体，
 * 通过 Node 内置 ProxyAgent（undici）走代理。
 *
 * 在远程沙箱中，外网可能仅通过代理可达。
 */
import type { Agent } from "undici";

export interface SearchHit {
  title: string;
  url: string;
  snippet: string;
  source: string;
}

export interface FetchOptions {
  headers?: Record<string, string>;
  method?: string;
  body?: string;
  timeoutMs?: number;
}

/**
 * 读取代理 URL
 */
function getProxyUrl(target: string): string | undefined {
  try {
    const u = new URL(target);
    const isHttps = u.protocol === "https:";
    const env = process.env;
    const direct = env.NO_PROXY ?? env.no_proxy;
    if (direct) {
      for (const entry of direct.split(",")) {
        if (entry.trim() && u.hostname.endsWith(entry.trim())) return undefined;
      }
    }
    if (isHttps) {
      return env.HTTPS_PROXY ?? env.https_proxy ?? env.ALL_PROXY ?? env.all_proxy;
    }
    return env.HTTP_PROXY ?? env.http_proxy ?? env.ALL_PROXY ?? env.all_proxy;
  } catch {
    return undefined;
  }
}

/**
 * fetch with optional proxy
 */
export async function fetchWithProxy(
  url: string,
  opts: FetchOptions = {},
): Promise<string> {
  const proxyUrl = getProxyUrl(url);
  // 动态加载 undici ProxyAgent 以避免无代理时的额外开销
  let dispatcher: Agent | undefined;
  if (proxyUrl) {
    const { ProxyAgent } = await import("undici");
    dispatcher = new ProxyAgent({ uri: proxyUrl }) as unknown as Agent;
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 8000);
  try {
    const response = await fetch(url, {
      method: opts.method ?? "GET",
      headers: opts.headers ?? {},
      body: opts.body,
      signal: controller.signal,
      // @ts-expect-error: undici dispatcher on global fetch
      dispatcher,
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }
    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}
