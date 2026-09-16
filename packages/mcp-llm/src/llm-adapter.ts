/**
 * MCP-8 LLM 网关适配器
 *
 * 设计为 OpenAI Chat Completions 兼容协议，可对接：
 *  - OpenAI 官方 (https://api.openai.com)
 *  - Azure OpenAI（通过 base_url + key）
 *  - 国产兼容服务：Moonshot / DeepSeek / 通义千问 / 智谱 GLM
 *  - 本地 Ollama / vLLM (http://localhost:11434/v1)
 *
 * 环境变量：
 *  - LLM_API_KEY        API Key（缺失时 health 标记 configured=false，调用返回明确错误）
 *  - LLM_BASE_URL       Base URL（默认 OpenAI 官方）
 *  - LLM_DEFAULT_MODEL  默认模型（默认 gpt-4o）
 *  - LLM_TIMEOUT_MS     请求超时毫秒（默认 60_000）
 */

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatRequest {
  model?: string;
  messages: ChatMessage[];
  temperature?: number;
  /** 控制输出确定性：top_p、max_tokens 等 OpenAI 兼容参数 */
  topP?: number;
  maxTokens?: number;
  stream?: boolean;
  /** JSON 模式：让模型输出受约束的 JSON */
  responseFormat?: { type: "json_object" | "text" };
}

export interface ProviderConfig {
  apiKey: string | null;
  baseUrl: string;
  defaultModel: string;
  timeoutMs: number;
}

export interface BuiltRequest {
  url: string;
  body: Record<string, unknown>;
  headers: Record<string, string>;
}

export function getProviderConfig(): ProviderConfig {
  const timeoutMs = Number(process.env.LLM_TIMEOUT_MS ?? 60_000);
  return {
    apiKey: process.env.LLM_API_KEY || null,
    baseUrl: (process.env.LLM_BASE_URL || "https://api.openai.com").replace(/\/+$/, ""),
    defaultModel: process.env.LLM_DEFAULT_MODEL || "gpt-4o",
    timeoutMs: Number.isFinite(timeoutMs) ? timeoutMs : 60_000,
  };
}

export function buildChatRequest(req: ChatRequest): BuiltRequest {
  const config = getProviderConfig();
  const body: Record<string, unknown> = {
    model: req.model && req.model.length > 0 ? req.model : config.defaultModel,
    messages: req.messages,
    temperature: req.temperature ?? 0.7,
    stream: req.stream ?? false,
  };
  if (req.topP !== undefined) body.top_p = req.topP;
  if (req.maxTokens !== undefined) body.max_tokens = req.maxTokens;
  if (req.responseFormat) body.response_format = req.responseFormat;

  // 智能拼接：baseUrl 已含 /v1 时不再重复追加
  const chatPath = config.baseUrl.endsWith("/v1")
    ? "/chat/completions"
    : "/v1/chat/completions";

  return {
    url: `${config.baseUrl}${chatPath}`,
    body,
    headers: {
      "Content-Type": "application/json",
      ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
    },
  };
}

/**
 * 调用 LLM（非流式），返回完整文本
 */
export async function chatCompletion(req: ChatRequest): Promise<string> {
  const config = getProviderConfig();
  if (!config.apiKey) {
    throw new Error("LLM_API_KEY 未配置，无法调用 LLM");
  }

  const { url, body, headers } = buildChatRequest({ ...req, stream: false });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`LLM API error ${response.status}: ${errText.slice(0, 500)}`);
    }

    const data = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    return data.choices?.[0]?.message?.content || "";
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 调用 LLM（流式）— 返回 ReadableStream<Uint8Array>
 * 上游格式为 OpenAI SSE：每个事件 `data: {...}\n\n`，结尾 `data: [DONE]`
 */
export async function chatCompletionStream(
  req: ChatRequest,
): Promise<ReadableStream<Uint8Array>> {
  const config = getProviderConfig();
  if (!config.apiKey) {
    throw new Error("LLM_API_KEY 未配置，无法调用 LLM");
  }

  const { url, body, headers } = buildChatRequest({ ...req, stream: true });
  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`LLM API error ${response.status}: ${errText.slice(0, 500)}`);
  }

  if (!response.body) {
    throw new Error("LLM API 返回了空响应体");
  }
  return response.body as ReadableStream<Uint8Array>;
}
