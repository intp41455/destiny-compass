import { useState } from "react";
import {
  verifyLLM,
  getLLMInfo,
  type LLMConfig,
} from "../api/client";
import { LLM_PRESETS, maskApiKey } from "../api/llmStore";

interface Props {
  config: LLMConfig;
  onChange: (config: LLMConfig) => void;
  onClear: () => void;
}

type TestState =
  | { kind: "idle" }
  | { kind: "testing" }
  | { kind: "ok"; baseUrl: string; model: string; latencyMs?: number }
  | { kind: "fail"; message: string };

export function LLMSettings({ config, onChange, onClear }: Props) {
  const [open, setOpen] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [test, setTest] = useState<TestState>({ kind: "idle" });

  const configured = Boolean(config.apiKey?.trim());

  const update = (patch: Partial<LLMConfig>) => {
    setTest({ kind: "idle" });
    onChange({ ...config, ...patch });
  };

  const applyPreset = async (label: string) => {
    const preset = LLM_PRESETS.find((p) => p.label === label);
    if (!preset) return;
    update({ baseUrl: preset.baseUrl, model: preset.model });
  };

  const handleFillServerDefault = async () => {
    try {
      const info = await getLLMInfo();
      update({ baseUrl: info.baseUrl, model: info.model });
    } catch {
      setTest({ kind: "fail", message: "读取服务端默认配置失败" });
    }
  };

  const handleTest = async () => {
    setTest({ kind: "testing" });
    try {
      const res = await verifyLLM(config);
      if (res.ok) {
        setTest({ kind: "ok", baseUrl: res.baseUrl, model: res.model, latencyMs: res.latencyMs });
      } else {
        setTest({ kind: "fail", message: res.error ?? `HTTP ${res.status ?? "未知"}` });
      }
    } catch (err) {
      setTest({ kind: "fail", message: (err as Error).message });
    }
  };

  const handleReset = () => {
    onClear();
    setTest({ kind: "idle" });
  };

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
      >
        <span className="flex items-center gap-2 min-w-0">
          <span className="font-medium text-sm shrink-0">模型接入</span>
          {configured ? (
            <span className="text-xs text-green-600 dark:text-green-400 truncate">
              ● 已配置 {config.model?.trim() ? config.model : ""}
            </span>
          ) : (
            <span className="text-xs text-amber-600 dark:text-amber-400 truncate">
              ● 未配置，仅排盘
            </span>
          )}
        </span>
        <span className="text-xs text-zinc-400 shrink-0 ml-2">{open ? "收起" : "展开"}</span>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-zinc-200 dark:border-zinc-800 pt-3">
          <p className="text-xs text-zinc-500 leading-relaxed">
            填写任意 <span className="font-medium">OpenAI 兼容</span> 接口即可启用 AI 分析。
            配置仅保存在本机浏览器 localStorage，不会上传到服务器留存；API 请求由后端转发到你所填的地址。
          </p>

          <div>
            <label className="block text-xs text-zinc-500 mb-1">服务商预设</label>
            <div className="flex flex-wrap gap-1.5">
              {LLM_PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => applyPreset(p.label)}
                  className="px-2 py-1 text-xs rounded-md border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:border-brand-500 hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs text-zinc-500 mb-1">Base URL</label>
            <input
              type="text"
              value={config.baseUrl ?? ""}
              onChange={(e) => update({ baseUrl: e.target.value })}
              placeholder="https://api.openai.com/v1"
              className="w-full min-h-[2.5rem] px-3 py-2 bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40"
            />
            <p className="text-[11px] text-zinc-400 mt-1">
              可填到域名或 <code>/v1</code>，后端会自动补全为 <code>/v1/chat/completions</code>
            </p>
          </div>

          <div>
            <label className="block text-xs text-zinc-500 mb-1">API Key</label>
            <div className="flex gap-2">
              <input
                type={showKey ? "text" : "password"}
                value={config.apiKey ?? ""}
                onChange={(e) => update({ apiKey: e.target.value })}
                placeholder="sk-..."
                autoComplete="off"
                spellCheck={false}
                className="flex-1 min-w-0 min-h-[2.5rem] px-3 py-2 bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40"
              />
              <button
                type="button"
                onClick={() => setShowKey((v) => !v)}
                className="px-3 min-h-[2.5rem] text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
              >
                {showKey ? "隐藏" : "显示"}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs text-zinc-500 mb-1">模型名称</label>
            <input
              type="text"
              value={config.model ?? ""}
              onChange={(e) => update({ model: e.target.value })}
              placeholder="gpt-4o-mini"
              spellCheck={false}
              className="w-full min-h-[2.5rem] px-3 py-2 bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40"
            />
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={handleTest}
              disabled={test.kind === "testing" || !configured}
              className="px-3 min-h-[2.5rem] text-xs rounded-lg bg-brand-600 text-white font-medium hover:bg-brand-700 disabled:opacity-40 transition-colors"
            >
              {test.kind === "testing" ? "测试中…" : "测试连接"}
            </button>
            <button
              type="button"
              onClick={handleFillServerDefault}
              className="px-3 min-h-[2.5rem] text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
            >
              使用服务端默认
            </button>
            <button
              type="button"
              onClick={handleReset}
              disabled={!configured && !config.baseUrl && !config.model}
              className="px-3 min-h-[2.5rem] text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-40"
            >
              清除
            </button>
          </div>

          {test.kind === "ok" && (
            <div className="text-xs text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-900/20 rounded p-2 space-y-0.5">
              <div>连接成功</div>
              <div className="text-[11px] opacity-80 break-all">
                {test.baseUrl} · {test.model}
                {test.latencyMs != null && ` · ${test.latencyMs}ms`}
              </div>
            </div>
          )}
          {test.kind === "fail" && (
            <div className="text-xs text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/20 rounded p-2 space-y-0.5">
              <div>连接失败</div>
              <div className="text-[11px] opacity-80 break-all">{test.message}</div>
            </div>
          )}

          {configured && (
            <div className="text-[11px] text-zinc-400">
              当前 Key：{maskApiKey(config.apiKey ?? "")}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
