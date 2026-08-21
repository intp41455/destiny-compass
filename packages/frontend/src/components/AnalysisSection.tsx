import { useMemo } from "react";
import { EventCard } from "./EventCard";

interface AnalysisSectionProps {
  section: string;
  content: string;
}

interface FortuneData {
  window?: string;
  overallScore?: number;
  summary?: string;
  keyNotes?: string[];
  events?: Array<Record<string, unknown>>;
  precautions?: string[];
}

interface LifeData {
  personality?: string[];
  talents?: string[];
  career?: string[];
  wealth?: string[];
  relationship?: string[];
  health?: string[];
  lifeThemes?: string[];
  strengths?: string[];
  weaknesses?: string[];
  luckyElements?: string;
  tabooElements?: string;
  // fallback 字段
  error?: string;
  message?: string;
  baziSummary?: unknown;
}

/**
 * 解析 LLM 输出的 JSON，失败时回退到纯文本展示
 */
function tryParse(content: string): unknown | null {
  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
}

function ScoreRing({ score }: { score: number }) {
  const clamped = Math.max(0, Math.min(100, score));
  const color =
    clamped >= 70
      ? "text-green-500"
      : clamped >= 40
        ? "text-amber-500"
        : "text-red-500";
  return (
    <div className="flex items-center gap-2 text-xs">
      <div className="w-16 h-2 bg-zinc-200 dark:bg-zinc-700 rounded">
        <div
          className={`h-full rounded ${
            clamped >= 70 ? "bg-green-500" : clamped >= 40 ? "bg-amber-500" : "bg-red-500"
          }`}
          style={{ width: `${clamped}%` }}
        />
      </div>
      <span className={color}>{clamped} / 100</span>
    </div>
  );
}

export function AnalysisSection({ section, content }: AnalysisSectionProps) {
  const parsed = useMemo(() => tryParse(content), [content]);
  const isLife = section === "人生总分析";

  // fallback JSON：显示明显错误状态
  if (parsed && typeof parsed === "object" && "error" in parsed) {
    const err = parsed as { error: string; message?: string; baziSummary?: unknown };
    return (
      <div className="bg-white dark:bg-zinc-900 border border-amber-200 dark:border-amber-900/50 rounded-xl p-5">
        <h3 className="font-medium text-amber-700 dark:text-amber-400 mb-2">
          {section}
        </h3>
        <div className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded p-2 mb-2">
          {err.error}：{err.message}
        </div>
        {Boolean(err.baziSummary) && (
          <details className="text-xs text-zinc-600 dark:text-zinc-400">
            <summary className="cursor-pointer">查看排盘数据</summary>
            <pre className="mt-2 p-2 bg-zinc-50 dark:bg-zinc-800 rounded overflow-x-auto text-[10px]">
              {JSON.stringify(err.baziSummary, null, 2)}
            </pre>
          </details>
        )}
      </div>
    );
  }

  // 人生总分析
  if (isLife && parsed && typeof parsed === "object") {
    const data = parsed as LifeData;
    const groups: Array<{ label: string; items?: string[] }> = [
      { label: "性格特点", items: data.personality },
      { label: "天赋才能", items: data.talents },
      { label: "事业方向", items: data.career },
      { label: "财源特征", items: data.wealth },
      { label: "感情模式", items: data.relationship },
      { label: "健康提示", items: data.health },
      { label: "人生主题", items: data.lifeThemes },
      { label: "命局优势", items: data.strengths },
      { label: "命局弱点", items: data.weaknesses },
    ];
    return (
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5">
        <h3 className="font-medium mb-3 text-zinc-900 dark:text-zinc-100">
          {section}
        </h3>
        <div className="flex flex-wrap gap-2 mb-4">
          {data.luckyElements && (
            <span className="text-xs px-2 py-1 bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 rounded-full">
              喜用：{data.luckyElements}
            </span>
          )}
          {data.tabooElements && (
            <span className="text-xs px-2 py-1 bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 rounded-full">
              忌神：{data.tabooElements}
            </span>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {groups.map((g) =>
            g.items && g.items.length > 0 ? (
              <div
                key={g.label}
                className="bg-zinc-50 dark:bg-zinc-800/50 rounded-lg p-3"
              >
                <div className="text-xs text-brand-700 dark:text-brand-300 mb-1.5">
                  {g.label}
                </div>
                <ul className="text-sm text-zinc-700 dark:text-zinc-300 space-y-1">
                  {g.items.map((item, i) => (
                    <li key={i} className="flex gap-1.5">
                      <span className="text-zinc-400">·</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null
          )}
        </div>
      </div>
    );
  }

  // 运势类（年/月/日）
  if (parsed && typeof parsed === "object") {
    const data = parsed as FortuneData;
    return (
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-medium text-zinc-900 dark:text-zinc-100">
            {section}
          </h3>
          {data.overallScore != null && <ScoreRing score={data.overallScore} />}
        </div>

        {data.window && (
          <div className="text-xs text-zinc-500 mb-1">时间窗口：{data.window}</div>
        )}

        {data.summary && (
          <div className="text-sm text-zinc-700 dark:text-zinc-300 mb-3 leading-relaxed">
            {data.summary}
          </div>
        )}

        {data.keyNotes && data.keyNotes.length > 0 && (
          <div className="text-xs mb-3 bg-brand-50 dark:bg-brand-900/20 rounded p-2">
            <div className="text-brand-700 dark:text-brand-300 mb-1">关键提示</div>
            <ul className="space-y-0.5 text-zinc-700 dark:text-zinc-300">
              {data.keyNotes.map((n, i) => (
                <li key={i}>• {n}</li>
              ))}
            </ul>
          </div>
        )}

        {data.events && data.events.length > 0 && (
          <div className="mb-3">
            <div className="text-xs text-zinc-500 mb-2">事件级预测（共 {data.events.length} 项）</div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
              {data.events.map((e, i) => (
                <EventCard key={i} event={e} index={i} />
              ))}
            </div>
          </div>
        )}

        {data.precautions && data.precautions.length > 0 && (
          <div className="text-xs bg-red-50 dark:bg-red-900/20 rounded p-2">
            <div className="text-red-600 dark:text-red-400 mb-1">⚠ 注意事项</div>
            <ul className="space-y-0.5 text-zinc-700 dark:text-zinc-300">
              {data.precautions.map((p, i) => (
                <li key={i}>• {p}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  // LLM 直接返回非 JSON 文本
  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5">
      <h3 className="font-medium mb-3 text-zinc-900 dark:text-zinc-100">
        {section}
      </h3>
      <pre className="text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap font-sans leading-relaxed">
        {content}
      </pre>
    </div>
  );
}
