interface BaziData {
  pillars: { year: string; month: string; day: string; hour: string };
  dayMaster: string;
  tenGods: Record<string, string>;
  hiddenStems: Record<string, string[]>;
  nayin: string;
  dayun: { startAge: number; endAge?: number; stems: string[] }[];
  shensha: string[];
  tags: string[];
}

interface Meta {
  birthday: string;
  solarTimeCorrected: string;
  trueSolarOffsetMin: number;
  gender: "male" | "female";
  lat: number;
  lng: number;
  timezone: string;
  locationName: string;
}

interface Props {
  data: BaziData;
  meta?: Meta;
}

export function BaziChart({ data, meta }: Props) {
  const pillars = [
    { label: "年柱", value: data.pillars.year, god: data.tenGods.year, hidden: data.hiddenStems.year ?? [] },
    { label: "月柱", value: data.pillars.month, god: data.tenGods.month, hidden: data.hiddenStems.month ?? [] },
    { label: "日柱", value: data.pillars.day, god: "日主", hidden: data.hiddenStems.day ?? [] },
    { label: "时柱", value: data.pillars.hour, god: data.tenGods.hour, hidden: data.hiddenStems.hour ?? [] },
  ];

  return (
    <div className="space-y-4">
      {meta && (
        <div className="text-xs text-zinc-500 flex flex-wrap gap-x-3 gap-y-1">
          <span>真太阳时：<span className="text-brand-700 dark:text-brand-300">{meta.solarTimeCorrected}</span></span>
          <span>校准偏移：{meta.trueSolarOffsetMin} 分钟</span>
          <span>出生地：{meta.locationName}</span>
          <span>{meta.lat.toFixed(4)}, {meta.lng.toFixed(4)}</span>
          <span>{meta.timezone}</span>
        </div>
      )}

      <div className="grid grid-cols-4 gap-2">
        {pillars.map((p) => (
          <div
            key={p.label}
            className="bg-gradient-to-b from-zinc-50 to-zinc-100 dark:from-zinc-800/80 dark:to-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg p-3 text-center"
          >
            <div className="text-xs text-zinc-500 mb-1">{p.label}</div>
            <div className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100 mb-1">
              {p.value}
            </div>
            <div className="text-xs text-brand-700 dark:text-brand-300">{p.god}</div>
            {p.hidden.length > 0 && (
              <div className="text-[10px] text-zinc-400 mt-1">藏：{p.hidden.join("")}</div>
            )}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {data.tags.map((tag, i) => (
          <span
            key={i}
            className="px-2 py-0.5 bg-brand-100 dark:bg-brand-900/50 text-brand-700 dark:text-brand-200 rounded-full text-xs"
          >
            {tag}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
        <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-lg p-3">
          <div className="text-xs text-zinc-500 mb-1">纳音</div>
          <div>{data.nayin}</div>
        </div>
        {data.shensha.length > 0 && (
          <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-lg p-3">
            <div className="text-xs text-zinc-500 mb-1">神煞</div>
            <div className="flex flex-wrap gap-1">
              {data.shensha.map((s, i) => (
                <span key={i} className="text-xs px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-700 rounded">
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {data.dayun.length > 0 && (
        <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-lg p-3">
          <div className="text-xs text-zinc-500 mb-2">大运（起止年龄 / 干支）</div>
          <div className="flex flex-wrap gap-2">
            {data.dayun.map((d, i) => (
              <div
                key={i}
                className="text-xs px-2 py-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded"
              >
                <div className="font-medium">{d.stems.join("")}</div>
                <div className="text-zinc-500">
                  {d.startAge}–{d.endAge ?? "?"} 岁
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
