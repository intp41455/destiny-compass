import type { SSEEvent } from "../hooks/useSSE";

interface Props {
  events: SSEEvent[];
  isDone: boolean;
}

/**
 * 流水线进度时间线
 *
 * 渲染所有 progress / done / error 事件，让用户看到当前流水线在哪一步。
 * charts 与 analysis 事件不在此处展示（它们有专属渲染区）。
 */
export function ProgressTimeline({ events, isDone }: Props) {
  const timelineEvents = events.filter(
    (e) => e.type === "progress" || e.type === "done" || e.type === "error"
  );

  if (timelineEvents.length === 0) return null;

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
          分析进度
        </h3>
        {isDone && (
          <span className="text-xs text-green-600 dark:text-green-400">已完成</span>
        )}
      </div>
      <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
        {timelineEvents.map((e, i) => {
          const isErr = e.type === "error";
          const isDoneEvt = e.type === "done";
          return (
            <div key={i} className="flex items-start gap-2 text-xs">
              <div
                className={`mt-0.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                  isErr
                    ? "bg-red-500"
                    : isDoneEvt
                      ? "bg-green-500"
                      : "bg-brand-500"
                }`}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  {typeof e.step === "string" && (
                    <span className="text-zinc-500">{e.step}</span>
                  )}
                  <span
                    className={
                      isErr
                        ? "text-red-600 dark:text-red-400"
                        : isDoneEvt
                          ? "text-green-600 dark:text-green-400"
                          : "text-zinc-700 dark:text-zinc-300"
                    }
                  >
                    {typeof e.message === "string" ? e.message : ""}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
