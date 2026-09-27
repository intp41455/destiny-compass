import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { runAnalysisPipeline } from "../src/pipeline.js";
import type { PaipanInput, SSEEvent } from "../src/types.js";

const INPUT: PaipanInput = {
  birthday: "1990-01-01",
  birthTime: "12:00",
  gender: "male",
  locationName: "北京",
  lat: 39.9042,
  lng: 116.4074,
};

interface CapturedCall {
  url: string;
  authorization: string | undefined;
  body: { model: string; messages: Array<{ role: string; content: string }> };
}

/**
 * 用假的 fetch 替换全局实现，捕获 pipeline 实际发出的请求。
 * 返回一段合法 JSON 字符串，模拟 OpenAI 兼容接口的响应体。
 */
function stubFetch(captured: CapturedCall[], reply = '{"ok":true}') {
  const mock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    captured.push({
      url: String(url),
      authorization: headers.get("Authorization") ?? undefined,
      body: JSON.parse(String(init?.body)),
    });
    return new Response(
      JSON.stringify({ choices: [{ message: { content: reply } }] }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  });
  vi.stubGlobal("fetch", mock);
  return mock;
}

/** 人生总分析 + 年度 + 月度 + 未来 7 天每日 = 10 次调用 */
const EXPECTED_LLM_CALLS = 10;

describe("runAnalysisPipeline 的模型接入行为", () => {
  let captured: CapturedCall[];

  beforeEach(() => {
    captured = [];
    process.env.LLM_API_KEY = "";
    process.env.LLM_BASE_URL = "https://server.example.com";
    process.env.LLM_MODEL = "server-model";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("无 API Key 时跳过全部 LLM 调用，只推送排盘结果与提示", async () => {
    const mock = stubFetch(captured);
    const events: SSEEvent[] = [];

    await runAnalysisPipeline(INPUT, "test-no-key", (e) => events.push(e), null);

    expect(mock).not.toHaveBeenCalled();
    expect(events.some((e) => e.type === "charts")).toBe(true);

    const err = events.find((e) => e.type === "error");
    expect(err).toBeDefined();
    expect(err && "step" in err && err.step).toBe("llm");
    expect(events.some((e) => e.type === "analysis")).toBe(false);
    expect(events.some((e) => e.type === "done")).toBe(false);
  });

  it("使用前端传入的 baseUrl / apiKey / model 发起请求", async () => {
    stubFetch(captured);
    const events: SSEEvent[] = [];

    await runAnalysisPipeline(INPUT, "test-override", (e) => events.push(e), {
      baseUrl: "https://api.deepseek.com",
      apiKey: "user-key-123",
      model: "deepseek-chat",
    });

    expect(captured.length).toBe(EXPECTED_LLM_CALLS);

    for (const call of captured) {
      expect(call.url).toBe("https://api.deepseek.com/v1/chat/completions");
      expect(call.authorization).toBe("Bearer user-key-123");
      expect(call.body.model).toBe("deepseek-chat");
    }
  });

  it("前端只提供 apiKey 时，baseUrl 与 model 回退到服务端默认值", async () => {
    stubFetch(captured);

    await runAnalysisPipeline(INPUT, "test-partial", () => {}, { apiKey: "only-key" });

    expect(captured.length).toBeGreaterThan(0);
    expect(captured[0].url).toBe("https://server.example.com/v1/chat/completions");
    expect(captured[0].body.model).toBe("server-model");
    expect(captured[0].authorization).toBe("Bearer only-key");
  });

  it("把模型返回的内容作为 analysis 事件推送，并以 done 收尾", async () => {
    stubFetch(captured, '{"summary":"测试结果"}');
    const events: SSEEvent[] = [];

    await runAnalysisPipeline(INPUT, "test-events", (e) => events.push(e), {
      apiKey: "k",
      baseUrl: "https://api.openai.com/v1",
      model: "gpt-4o-mini",
    });

    const analyses = events.filter((e) => e.type === "analysis");
    expect(analyses.length).toBe(EXPECTED_LLM_CALLS);

    const life = analyses.find((e) => e.type === "analysis" && e.section === "人生总分析");
    expect(life && "content" in life && life.content).toBe('{"summary":"测试结果"}');

    const done = events.find((e) => e.type === "done");
    expect(done).toBeDefined();
    expect(done && "analysisId" in done && done.analysisId).toBe("test-events");
  });

  it("上游返回错误时降级为占位内容，不中断整个流程", async () => {
    vi.stubGlobal("fetch", vi.fn(async () =>
      new Response("rate limited", { status: 429 })
    ));
    const events: SSEEvent[] = [];

    await runAnalysisPipeline(INPUT, "test-upstream-error", (e) => events.push(e), {
      apiKey: "k",
    });

    // 排盘结果仍然产出
    expect(events.some((e) => e.type === "charts")).toBe(true);

    const life = events.find((e) => e.type === "analysis" && e.section === "人生总分析");
    expect(life).toBeDefined();
    const parsed = JSON.parse((life as { content: string }).content);
    expect(parsed.error).toBe("LLM不可用");
    expect(parsed.message).toContain("429");

    // 后续年度/月度流程照常推进，最终仍以 done 收尾
    expect(events.some((e) => e.type === "done")).toBe(true);
  });
});
