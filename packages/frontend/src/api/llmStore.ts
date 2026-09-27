import type { LLMConfig } from "./client";

const STORAGE_KEY = "destiny-compass.llm-config";

/** 常用 OpenAI 兼容服务商预设 */
export const LLM_PRESETS: { label: string; baseUrl: string; model: string }[] = [
  { label: "Agnes AI", baseUrl: "https://api.agnes-ai.cn", model: "agnes-2.5-flash" },
  { label: "OpenAI", baseUrl: "https://api.openai.com/v1", model: "gpt-4o-mini" },
  { label: "DeepSeek", baseUrl: "https://api.deepseek.com/v1", model: "deepseek-chat" },
  { label: "通义千问", baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1", model: "qwen-plus" },
  { label: "智谱 GLM", baseUrl: "https://open.bigmodel.cn/api/paas/v4", model: "glm-4-flash" },
  { label: "Moonshot", baseUrl: "https://api.moonshot.cn/v1", model: "moonshot-v1-8k" },
];

/** 从 localStorage 读取用户配置；解析失败时返回空对象并清理脏数据 */
export function loadLLMConfig(): LLMConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as LLMConfig;
    return {
      baseUrl: typeof parsed.baseUrl === "string" ? parsed.baseUrl : undefined,
      apiKey: typeof parsed.apiKey === "string" ? parsed.apiKey : undefined,
      model: typeof parsed.model === "string" ? parsed.model : undefined,
    };
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return {};
  }
}

/** 写入 localStorage；全部为空时直接清除，避免留下空壳 */
export function saveLLMConfig(config: LLMConfig): void {
  const cleaned: LLMConfig = {
    baseUrl: config.baseUrl?.trim() || undefined,
    apiKey: config.apiKey?.trim() || undefined,
    model: config.model?.trim() || undefined,
  };
  if (!cleaned.baseUrl && !cleaned.apiKey && !cleaned.model) {
    localStorage.removeItem(STORAGE_KEY);
    return;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned));
}

export function clearLLMConfig(): void {
  localStorage.removeItem(STORAGE_KEY);
}

/** 是否已具备可用的模型配置（至少要有 apiKey） */
export function isLLMReady(config: LLMConfig): boolean {
  return Boolean(config.apiKey?.trim());
}

/** 脱敏展示：sk-abc...xyz */
export function maskApiKey(apiKey: string): string {
  const key = apiKey.trim();
  if (key.length <= 8) return "••••";
  return `${key.slice(0, 4)}••••${key.slice(-4)}`;
}
