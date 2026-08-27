/**
 * MCP-7 多源搜索服务
 *
 * 整合：
 *  - Wikipedia REST API（中英文）
 *  - GitHub Code Search API（公开库）
 *  - DuckDuckGo HTML Lite（兜底）
 *
 * 所有调用都通过 fetch + 代理（识别 HTTP_PROXY/HTTPS_PROXY 环境变量）。
 * 网络失败时优雅降级，不阻塞主管线。
 */
import { fetchWithProxy as fetchProxy, type SearchHit } from "./proxy-fetch.js";

const TIMEOUT_MS = Number(process.env.SEARCH_TIMEOUT_MS ?? 8000);
const GITHUB_TOKEN = process.env.GITHUB_TOKEN ?? "";

export interface MultiSearchQuery {
  query: string;
  /** 同时查询的语言，默认 ["zh", "en"] */
  langs?: ("zh" | "en")[];
  /** 每个源返回的最大条目数 */
  limit?: number;
  /** 启用的源，默认 ["wikipedia","github","duckduckgo"] */
  sources?: ("wikipedia" | "github" | "duckduckgo")[];
}

export interface MultiSearchResult {
  query: string;
  hits: SearchHit[];
  errors: { source: string; message: string }[];
}

/**
 * 多源搜索主入口
 */
export async function multiSearch(q: MultiSearchQuery): Promise<MultiSearchResult> {
  const langs = q.langs ?? ["zh", "en"];
  const limit = q.limit ?? 5;
  const sources = q.sources ?? ["wikipedia", "github", "duckduckgo"];

  const tasks: Promise<SearchHit[]>[] = [];
  for (const src of sources) {
    if (src === "wikipedia") {
      for (const lang of langs) {
        tasks.push(searchWikipedia(q.query, lang, limit).catch((e) => {
          errors.push({ source: `wikipedia/${lang}`, message: (e as Error).message });
          return [];
        }));
      }
    } else if (src === "github") {
      tasks.push(searchGithub(q.query, limit).catch((e) => {
        errors.push({ source: "github", message: (e as Error).message });
        return [];
      }));
    } else if (src === "duckduckgo") {
      tasks.push(searchDuckDuckGo(q.query, limit).catch((e) => {
        errors.push({ source: "duckduckgo", message: (e as Error).message });
        return [];
      }));
    }
  }

  const errors: { source: string; message: string }[] = [];
  const allHits = await Promise.all(tasks);

  // 合并 + 去重（按 URL）
  const seen = new Set<string>();
  const hits: SearchHit[] = [];
  for (const arr of allHits) {
    for (const h of arr) {
      if (h.url && !seen.has(h.url)) {
        seen.add(h.url);
        hits.push(h);
      }
    }
  }

  // 截断
  return { query: q.query, hits: hits.slice(0, limit * 3), errors };
}

/**
 * Wikipedia REST 搜索
 *
 * 中文端点：https://zh.wikipedia.org/w/rest.php/v1/search/page?q=xxx&limit=5
 * 英文端点：https://en.wikipedia.org/w/rest.php/v1/search/page?q=xxx&limit=5
 */
export async function searchWikipedia(query: string, lang: "zh" | "en", limit: number): Promise<SearchHit[]> {
  const base = lang === "zh" ? "https://zh.wikipedia.org" : "https://en.wikipedia.org";
  const url = `${base}/w/rest.php/v1/search/page?q=${encodeURIComponent(query)}&limit=${limit}`;
  const data = await fetchProxy(url, {
    headers: { "User-Agent": "DestinyCompass/0.1 (educational use)" },
    timeoutMs: TIMEOUT_MS,
  });
  const json = JSON.parse(data) as { pages?: Array<{ key?: string; title: string; snippet?: string; excerpt?: string }> };
  return (json.pages ?? []).map((p) => {
    const slug = encodeURIComponent(String(p.key ?? p.title).replace(/ /g, "_"));
    return {
      title: p.title,
      url: `${base}/wiki/${slug}`,
      snippet: (p.snippet ?? p.excerpt ?? "").replace(/<[^>]+>/g, "").slice(0, 300),
      source: `wikipedia/${lang}`,
    };
  });
}

/**
 * GitHub 代码 / 仓库搜索
 *
 * 使用 REST API v3 search/repositories，按相关度排序。
 * 带个人 token 时 30 req/min；不带 token 时 10 req/min，IP 限流。
 */
export async function searchGithub(query: string, limit: number): Promise<SearchHit[]> {
  const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=stars&order=desc&per_page=${limit}`;
  const headers: Record<string, string> = {
    "User-Agent": "DestinyCompass/0.1",
    "Accept": "application/vnd.github+json",
  };
  if (GITHUB_TOKEN) headers["Authorization"] = `Bearer ${GITHUB_TOKEN}`;
  const data = await fetchProxy(url, { headers, timeoutMs: TIMEOUT_MS });
  const json = JSON.parse(data) as {
    items?: Array<{
      name: string;
      full_name: string;
      html_url: string;
      description: string | null;
      stargazers_count?: number;
    }>;
  };
  return (json.items ?? []).map((r) => ({
    title: r.full_name,
    url: r.html_url,
    snippet: r.description ?? `★${r.stargazers_count ?? 0}`,
    source: "github",
  }));
}

/**
 * DuckDuckGo Lite HTML 搜索（兜底）
 *
 * 端点：https://lite.duckduckgo.com/lite/?q=xxx
 * 解析返回 HTML 表格中的链接与摘要
 */
export async function searchDuckDuckGo(query: string, limit: number): Promise<SearchHit[]> {
  const url = `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}`;
  const html = await fetchProxy(url, {
    headers: { "User-Agent": "DestinyCompass/0.1" },
    timeoutMs: TIMEOUT_MS,
  });
  // DuckDuckGo Lite 返回 HTML，最简的解析：抓 <a class="result-link" href="..."> 与随后的 snippet
  const hits: SearchHit[] = [];
  // 提取所有 <a class="result-link" href="URL">title</a>
  const re = /<a[^>]*class="result-link"[^>]*href="([^"]+)"[^>]*>([^<]*)<\/a>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) && hits.length < limit) {
    const [, url2, title] = m;
    hits.push({
      title: title.trim(),
      url: url2.startsWith("http") ? url2 : `https://lite.duckduckgo.com${url2}`,
      snippet: "",
      source: "duckduckgo",
    });
  }
  return hits;
}
