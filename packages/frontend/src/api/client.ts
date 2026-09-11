const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "/api";

export interface PaipanInput {
  birthday: string;
  birthTime: string;
  gender: "male" | "female";
  locationName: string;
  lat?: number;
  lng?: number;
  timezone?: string;
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

export interface StatusResponse {
  timestamp: string;
  status?: string;
  service?: string;
  services?: ServiceStatus[];
}

export async function startAnalysis(
  input: PaipanInput
): Promise<StartAnalysisResponse> {
  const res = await fetch(`${API_BASE}/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
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
