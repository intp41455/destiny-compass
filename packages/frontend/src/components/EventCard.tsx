interface PredictionEvent {
  category?: string;
  probability?: number;
  people?: string[];
  risks?: string[];
  opportunities?: string[];
  description?: string;
  suggestion?: string;
}

const CATEGORY_STYLES: Record<string, string> = {
  事业: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300",
  财运: "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300",
  感情: "bg-pink-100 text-pink-700 dark:bg-pink-900/50 dark:text-pink-300",
  健康: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300",
  人际: "bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300",
  学业: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/50 dark:text-cyan-300",
  出行: "bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300",
  法律: "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300",
  其他: "bg-zinc-100 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300",
};

function getProbColor(prob?: number): string {
  if (prob == null) return "text-zinc-400";
  if (prob >= 0.7) return "text-red-600 dark:text-red-400";
  if (prob >= 0.4) return "text-amber-600 dark:text-amber-400";
  return "text-zinc-500";
}

function getProbLabel(prob?: number): string {
  if (prob == null) return "";
  if (prob >= 0.7) return "高概率";
  if (prob >= 0.4) return "中概率";
  return "低概率";
}

export function EventCard({ event, index }: { event: PredictionEvent; index: number }) {
  const cat = event.category ?? "其他";
  const catStyle = CATEGORY_STYLES[cat] ?? CATEGORY_STYLES.其他;

  return (
    <div className="border border-zinc-200 dark:border-zinc-700 rounded-lg p-3 bg-white dark:bg-zinc-900/50">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-400">#{index + 1}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full ${catStyle}`}>
            {cat}
          </span>
        </div>
        {event.probability != null && (
          <div className="flex items-center gap-1.5 text-xs">
            <span className={getProbColor(event.probability)}>
              {getProbLabel(event.probability)} {Math.round(event.probability * 100)}%
            </span>
            <div className="w-12 h-1 bg-zinc-200 dark:bg-zinc-700 rounded">
              <div
                className={`h-full rounded ${
                  event.probability >= 0.7
                    ? "bg-red-500"
                    : event.probability >= 0.4
                      ? "bg-amber-500"
                      : "bg-zinc-400"
                }`}
                style={{ width: `${Math.round(event.probability * 100)}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {event.description && (
        <div className="text-sm text-zinc-800 dark:text-zinc-200 mb-2 leading-relaxed">
          {event.description}
        </div>
      )}

      {event.people && event.people.length > 0 && (
        <div className="text-xs mb-1.5">
          <span className="text-zinc-500 mr-1">人物：</span>
          {event.people.map((p, i) => (
            <span
              key={i}
              className="inline-block bg-zinc-100 dark:bg-zinc-800 rounded px-1.5 py-0.5 mr-1 mb-1 text-zinc-700 dark:text-zinc-300"
            >
              {p}
            </span>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
        {event.risks && event.risks.length > 0 && (
          <div className="text-xs">
            <div className="text-red-600 dark:text-red-400 mb-1">⚠ 风险</div>
            <ul className="space-y-0.5 text-zinc-700 dark:text-zinc-300">
              {event.risks.map((r, i) => (
                <li key={i} className="pl-2 border-l border-red-300 dark:border-red-700">{r}</li>
              ))}
            </ul>
          </div>
        )}
        {event.opportunities && event.opportunities.length > 0 && (
          <div className="text-xs">
            <div className="text-green-600 dark:text-green-400 mb-1">✓ 机会</div>
            <ul className="space-y-0.5 text-zinc-700 dark:text-zinc-300">
              {event.opportunities.map((o, i) => (
                <li key={i} className="pl-2 border-l border-green-300 dark:border-green-700">{o}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {event.suggestion && (
        <div className="text-xs mt-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
          <span className="text-brand-700 dark:text-brand-300 mr-1">建议：</span>
          <span className="text-zinc-700 dark:text-zinc-300">{event.suggestion}</span>
        </div>
      )}
    </div>
  );
}
