import { useMemo } from "react";
import { EventCard } from "./EventCard";

interface DailyEvent {
  category?: string;
  probability?: number;
  people?: string[];
  risks?: string[];
  opportunities?: string[];
  description?: string;
  suggestion?: string;
}

interface DailyFortune {
  window?: string;
  overallScore?: number;
  summary?: string;
  keyNotes?: string[];
  events?: DailyEvent[];
  precautions?: string[];
  // fallback 字段
  error?: string;
  message?: string;
  dayOffset?: number;
}

interface Props {
  /** 编排层将 7 个每日 JSON 拼成数组字符串：[json1, json2, ...] */
  content: string;
}

function tryParseArray(content: string): DailyFortune[] | null {
  try {
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) {
      return parsed as DailyFortune[];
    }
    // 单个对象（兜底）
    return [parsed as DailyFortune];
  } catch {
    return null;
  }
}

export function DailyFortuneList({ content }: Props) {
  const days = useMemo(() => tryParseArray(content), [content]);

  if (!days || days.length === 0) {
    return (
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5">
        <h3 className="font-medium mb-2">未来 7 天每日运势</h3>
        <div className="text-sm text-zinc-500">暂无数据</div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5">
      <h3 className="font-medium mb-3">未来 7 天每日事件级运势</h3>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {days.map((d, i) => {
          if (d.error) {
            return (
              <div
                key={i}
                className="border border-amber-200 dark:border-amber-900/50 rounded-lg p-3 bg-amber-50 dark:bg-amber-900/10"
              >
                <div className="text-xs text-amber-700 dark:text-amber-400 mb-1">
                  第 {i + 1} 天 {d.window ? `· ${d.window}` : ""}
                </div>
                <div className="text-xs text-zinc-600 dark:text-zinc-400">
                  {d.error}：{d.message}
                </div>
              </div>
            );
          }
          return (
            <div
              key={i}
              className="border border-zinc-200 dark:border-zinc-700 rounded-lg p-3"
            >
              <div className="flex items-center justify-between mb-2">
                <div>
                  <div className="text-xs text-zinc-500">第 {i + 1} 天</div>
                  {d.window && (
                    <div className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                      {d.window}
                    </div>
                  )}
                </div>
                {d.overallScore != null && (
                  <div className="text-xs">
                    <span
                      className={
                        d.overallScore >= 70
                          ? "text-green-600 dark:text-green-400"
                          : d.overallScore >= 40
                            ? "text-amber-600 dark:text-amber-400"
                            : "text-red-600 dark:text-red-400"
                      }
                    >
                      {d.overallScore}/100
                    </span>
                  </div>
                )}
              </div>
              {d.summary && (
                <div className="text-xs text-zinc-600 dark:text-zinc-400 mb-2 leading-relaxed">
                  {d.summary}
                </div>
              )}
              {d.events && d.events.length > 0 && (
                <div className="space-y-2">
                  {d.events.map((e, j) => (
                    <EventCard key={j} event={e} index={j} />
                  ))}
                </div>
              )}
              {d.precautions && d.precautions.length > 0 && (
                <div className="text-xs mt-2 text-red-600 dark:text-red-400">
                  ⚠ {d.precautions.join("；")}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
