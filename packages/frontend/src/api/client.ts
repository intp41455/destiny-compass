export const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "/api";

export interface PaipanInput {
  birthday: string;
  birthTime: string;
  gender: "male" | "female";
  locationName: string;
  lat?: number;
  lng?: number;
  timezone?: string;
}

/** OpenAI 兼容的模型接入配置 */
export interface LLMConfig {
  baseUrl?: string;
  apiKey?: string;
  model?: string;
}

export interface StartAnalysisResponse {
  analysisId: string;
  message: string;
  streamUrl: string;
}

export interface ServiceStatus {
  name: string;
  port: number;
  status: "online" | "offline";
}

export interface LLMInfo {
  baseUrl: string;
  model: string;
  hasServerKey: boolean;
}

export interface StatusResponse {
  timestamp: string;
  status?: string;
  service?: string;
  services?: ServiceStatus[];
  llm?: LLMInfo;
}

export interface VerifyLLMResponse {
  ok: boolean;
  baseUrl: string;
  model: string;
  latencyMs?: number;
  status?: number;
  error?: string;
}

export async function startAnalysis(
  input: PaipanInput,
  llm?: LLMConfig
): Promise<StartAnalysisResponse> {
  const res = await fetch(`${API_BASE}/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(llm ? { ...input, llm } : input),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`analyze 启动失败 ${res.status}: ${text}`);
  }
  return res.json();
}

export async function getStatus(): Promise<StatusResponse> {
  const res = await fetch(`${API_BASE}/status`);
  if (!res.ok) throw new Error(`status ${res.status}`);
  return res.json();
}

/** 读取服务端默认模型配置（不含 apiKey），用于首次打开设置面板时预填 */
export async function getLLMInfo(): Promise<LLMInfo> {
  const res = await fetch(`${API_BASE}/llm/config`);
  if (!res.ok) throw new Error(`llm config ${res.status}`);
  return res.json();
}

/** 测试一份 OpenAI 兼容配置是否可用 */
export async function verifyLLM(llm: LLMConfig): Promise<VerifyLLMResponse> {
  const res = await fetch(`${API_BASE}/llm/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(llm),
  });
  return res.json();
}
