import { describe, it, expect, beforeEach } from "vitest";
import { buildChatRequest, getProviderConfig } from "../src/llm-adapter.js";

describe("buildChatRequest", () => {
  beforeEach(() => {
    process.env.LLM_API_KEY = "test-key";
    process.env.LLM_BASE_URL = "https://api.openai.com";
    process.env.LLM_DEFAULT_MODEL = "gpt-4o";
  });

  it("应构建OpenAI兼容格式的请求", () => {
    const req = buildChatRequest({
      model: "gpt-4o",
      messages: [{ role: "user", content: "你好" }],
      temperature: 0.7,
    });
    expect(req.url).toContain("/v1/chat/completions");
    expect(req.body.model).toBe("gpt-4o");
    expect(req.body.messages).toHaveLength(1);
    expect(req.body.temperature).toBe(0.7);
  });

  it("应支持stream参数", () => {
    const req = buildChatRequest({
      model: "gpt-4o",
      messages: [],
      temperature: 0.5,
      stream: true,
    });
    expect(req.body.stream).toBe(true);
  });

  it("无model时回退到默认模型", () => {
    const req = buildChatRequest({
      model: "",
      messages: [],
    });
    expect(req.body.model).toBe("gpt-4o");
  });

  it("apiKey存在时应携带Authorization头", () => {
    const req = buildChatRequest({
      model: "gpt-4o",
      messages: [],
    });
    expect(req.headers.Authorization).toBe("Bearer test-key");
  });
});

describe("getProviderConfig", () => {
  beforeEach(() => {
    delete process.env.LLM_API_KEY;
    delete process.env.LLM_BASE_URL;
    delete process.env.LLM_DEFAULT_MODEL;
  });

  it("应从环境变量读取配置", () => {
    process.env.LLM_API_KEY = "test-key";
    process.env.LLM_BASE_URL = "https://api.openai.com";
    process.env.LLM_DEFAULT_MODEL = "gpt-4o-mini";
    const config = getProviderConfig();
    expect(config.apiKey).toBe("test-key");
    expect(config.baseUrl).toBe("https://api.openai.com");
    expect(config.defaultModel).toBe("gpt-4o-mini");
  });

  it("缺少API Key应返回null apiKey", () => {
    const config = getProviderConfig();
    expect(config.apiKey).toBeNull();
    // 应有默认 baseUrl
    expect(config.baseUrl).toBeDefined();
    expect(config.defaultModel).toBeDefined();
  });
});
