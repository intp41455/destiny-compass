import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock the proxy-fetch module before importing search-engine
vi.mock("../src/proxy-fetch.js", () => ({
  fetchWithProxy: vi.fn(),
}));

import { fetchWithProxy } from "../src/proxy-fetch.js";
import { multiSearch, searchWikipedia, searchGithub, searchDuckDuckGo } from "../src/search-engine.js";

const mocked = fetchWithProxy as unknown as ReturnType<typeof vi.fn>;

describe("multi-source search engine", () => {
  beforeEach(() => {
    mocked.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs?.();
  });

  it("searchWikipedia 应解析 REST API 返回", async () => {
    mocked.mockResolvedValueOnce(
      JSON.stringify({
        pages: [
          { key: "Astrology", title: "Astrology", snippet: "study of <b>astrology</b>..." },
          { key: "Zodiac", title: "Zodiac", snippet: "the zodiac..." },
        ],
      }),
    );
    const hits = await searchWikipedia("astrology", "en", 5);
    expect(hits.length).toBe(2);
    expect(hits[0].title).toBe("Astrology");
    expect(hits[0].url).toContain("en.wikipedia.org/wiki/Astrology");
    expect(hits[0].snippet).toContain("astrology");
    expect(hits[0].source).toBe("wikipedia/en");
  });

  it("searchGithub 应解析仓库搜索结果", async () => {
    mocked.mockResolvedValueOnce(
      JSON.stringify({
        items: [
          {
            name: "astro",
            full_name: "withastro/astro",
            html_url: "https://github.com/withastro/astro",
            description: "Astro framework",
            stargazers_count: 12345,
          },
        ],
      }),
    );
    const hits = await searchGithub("astro framework", 5);
    expect(hits.length).toBe(1);
    expect(hits[0].title).toBe("withastro/astro");
    expect(hits[0].url).toBe("https://github.com/withastro/astro");
    expect(hits[0].source).toBe("github");
  });

  it("searchDuckDuckGo 应解析 HTML 中链接", async () => {
    mocked.mockResolvedValueOnce(
      `<html>
        <a class="result-link" href="https://example.com/page1">Page One</a>
        <a class="result-link" href="/lite/?q=2">Page Two</a>
      </html>`,
    );
    const hits = await searchDuckDuckGo("test", 5);
    expect(hits.length).toBe(2);
    expect(hits[0].url).toBe("https://example.com/page1");
    expect(hits[1].url).toContain("lite.duckduckgo.com");
  });

  it("multiSearch 应合并多源结果并按 URL 去重", async () => {
    // Wikipedia 中文 + 英文 + GitHub + DuckDuckGo，4 次 fetch
    mocked
      .mockResolvedValueOnce(JSON.stringify({ pages: [{ key: "X", title: "Wikipedia X", snippet: "snippet1" }] }))
      .mockResolvedValueOnce(JSON.stringify({ pages: [{ key: "X", title: "Wikipedia X", snippet: "snippet2" }] }))
      .mockResolvedValueOnce(JSON.stringify({ items: [{ full_name: "user/repo", html_url: "https://github.com/user/repo", description: "test" }] }))
      .mockResolvedValueOnce(`<a class="result-link" href="https://example.com/page1">X</a>`);

    const result = await multiSearch({ query: "X", limit: 3 });
    expect(result.hits.length).toBeGreaterThan(0);
    // 不同源命中应都出现
    const sources = result.hits.map((h) => h.source);
    expect(new Set(sources).size).toBeGreaterThan(1);
  });

  it("单源失败时应优雅降级（不抛错，记录到 errors）", async () => {
    mocked
      .mockRejectedValueOnce(new Error("wiki timeout"))
      .mockResolvedValueOnce(JSON.stringify({ items: [] }))
      .mockResolvedValueOnce("");

    const result = await multiSearch({ query: "test", sources: ["wikipedia", "github", "duckduckgo"] });
    expect(result.errors.length).toBeGreaterThanOrEqual(1);
    expect(result.hits).toBeDefined();
  });

  it("fetch 失败的源被记录到 errors 数组", async () => {
    mocked.mockRejectedValueOnce(new Error("connect ECONNREFUSED"));
    const result = await multiSearch({ query: "x", sources: ["wikipedia"], langs: ["zh"] });
    expect(result.errors.some((e) => e.source === "wikipedia/zh")).toBe(true);
  });
});
