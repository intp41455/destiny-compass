import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { normalizeBaseUrl, resolveLLMConfig, validateBaseUrl } from "../src/config.js";

describe("normalizeBaseUrl", () => {
  it("为纯域名补全 /v1", () => {
    expect(normalizeBaseUrl("https://api.openai.com")).toBe("https://api.openai.com/v1");
  });

  it("去掉尾部斜杠后补全 /v1", () => {
    expect(normalizeBaseUrl("https://api.openai.com/")).toBe("https://api.openai.com/v1");
  });

  it("已含 /v1 时保持不变", () => {
    expect(normalizeBaseUrl("https://api.openai.com/v1")).toBe("https://api.openai.com/v1");
  });

  it("已含 /v1/ 时去掉尾部斜杠", () => {
    expect(normalizeBaseUrl("https://api.openai.com/v1/")).toBe("https://api.openai.com/v1");
  });

  it("误填完整 chat/completions 路径时回退到 /v1", () => {
    expect(normalizeBaseUrl("https://api.openai.com/v1/chat/completions")).toBe(
      "https://api.openai.com/v1"
    );
  });

  it("识别非 v1 的版本号路径，不再重复追加", () => {
    expect(normalizeBaseUrl("https://open.bigmodel.cn/api/paas/v4")).toBe(
      "https://open.bigmodel.cn/api/paas/v4"
    );
  });

  it("忽略首尾空白", () => {
    expect(normalizeBaseUrl("  https://api.agnes-ai.cn  ")).toBe("https://api.agnes-ai.cn/v1");
  });
});

describe("resolveLLMConfig", () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    process.env.LLM_API_KEY = "server-key";
    process.env.LLM_BASE_URL = "https://server.example.com";
    process.env.LLM_MODEL = "server-model";
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("无覆盖配置时全部回退到环境变量", () => {
    const cfg = resolveLLMConfig();
    expect(cfg.baseUrl).toBe("https://server.example.com/v1");
    expect(cfg.apiKey).toBe("server-key");
    expect(cfg.model).toBe("server-model");
  });

  it("前端传入的配置优先于环境变量", () => {
    const cfg = resolveLLMConfig({
      baseUrl: "https://api.deepseek.com/v1",
      apiKey: "user-key",
      model: "deepseek-chat",
    });
    expect(cfg.baseUrl).toBe("https://api.deepseek.com/v1");
    expect(cfg.apiKey).toBe("user-key");
    expect(cfg.model).toBe("deepseek-chat");
  });

  it("空字符串与空白字符串视为未提供，回退到服务端默认值", () => {
    const cfg = resolveLLMConfig({ baseUrl: "", apiKey: "   ", model: "" });
    expect(cfg.baseUrl).toBe("https://server.example.com/v1");
    expect(cfg.apiKey).toBe("server-key");
    expect(cfg.model).toBe("server-model");
  });

  it("两者皆空时 apiKey 为空字符串，用于判定未配置", () => {
    process.env.LLM_API_KEY = "";
    const cfg = resolveLLMConfig();
    expect(cfg.apiKey).toBe("");
  });
});

describe("validateBaseUrl", () => {
  it("接受合法公网 https 地址", () => {
    expect(validateBaseUrl("https://api.openai.com/v1").ok).toBe(true);
    expect(validateBaseUrl("https://dashscope.aliyuncs.com/compatible-mode/v1").ok).toBe(true);
  });

  it("拒绝非 http/https 协议", () => {
    const r = validateBaseUrl("file:///etc/passwd");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("http");
  });

  it("拒绝格式非法的地址", () => {
    expect(validateBaseUrl("not-a-url").ok).toBe(false);
  });

  it.each([
    "http://localhost:8080/v1",
    "http://127.0.0.1/v1",
    "http://10.0.0.5/v1",
    "http://192.168.1.1/v1",
    "http://172.16.0.1/v1",
    "http://172.31.255.255/v1",
    "http://169.254.169.254/latest/meta-data",
    "http://[::1]/v1",
    "http://metadata.internal/v1",
  ])("拒绝内网/环回地址 %s", (url) => {
    const r = validateBaseUrl(url);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("内网");
  });

  it("不误伤公网 172.32.x.x（私有段之外）", () => {
    expect(validateBaseUrl("https://172.32.0.1/v1").ok).toBe(true);
  });
});
