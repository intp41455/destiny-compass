/**
 * 多术数排盘总览面板
 *
 * 展示紫微斗数 / 印度占星 / 古典占星 / 阿拉伯占星 的核心信息，
 * 以及跨术数命主信息汇总（unifiedTags）。
 *
 * 单个术数缺失时不显示对应区块，避免空白噪音。
 */

interface ZiweiData {
  fiveElementsClass: string;
  soulPalaceStar: string;
  soulPalaceBranch: string;
  bodyPalaceStar: string;
  bodyPalaceBranch: string;
  chineseDate: string;
  daxian: { startAge: number; endAge?: number; earthlyBranch: string }[];
  tags: string[];
}

interface VedicData {
  lagna: string;
  moonRashi: string;
  sunRashi: string;
  moonNakshatra: string;
  moonPada: number;
  currentDasha: { maha: string; antar: string };
  yogas: string[];
  gochara: { saturn: string; jupiter: string };
  tags: string[];
}

interface WesternData {
  planets: { name: string; signName: string; degreeInSign: number; house: number }[];
  houses: { ascendant: number; midheaven: number };
  firdaria: { ruler: string; subRuler?: string };
  profection: { house: number; ruler: string };
  aspects: { planetA: string; planetB: string; type: string; orb: number }[];
  tags: string[];
}

interface ArabicData {
  parts: { name: string; sign: string; house: number; formula: string }[];
  northNode: { sign: string; house: number };
  southNode: { sign: string; house: number };
  dayRuler: string;
  hourRuler: string;
  tags: string[];
}

interface Props {
  ziwei?: ZiweiData;
  vedic?: VedicData;
  western?: WesternData;
  arabic?: ArabicData;
  unifiedTags: string[];
}

const ZODIAC = [
  "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
  "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
];

const ZH_ZODIAC: Record<string, string> = {
  Aries: "白羊座", Taurus: "金牛座", Gemini: "双子座", Cancer: "巨蟹座",
  Leo: "狮子座", Virgo: "处女座", Libra: "天秤座", Scorpio: "天蝎座",
  Sagittarius: "射手座", Capricorn: "摩羯座", Aquarius: "水瓶座", Pisces: "双鱼座",
};

function PanelCard({
  title,
  accent,
  children,
}: {
  title: string;
  accent: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`rounded-lg border border-zinc-200 dark:border-zinc-700 p-3 ${accent}`}>
      <div className="text-xs font-medium text-zinc-700 dark:text-zinc-200 mb-2 flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60" />
        {title}
      </div>
      <div className="space-y-1.5 text-xs text-zinc-600 dark:text-zinc-300">
        {children}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-1.5">
      <span className="text-zinc-400 dark:text-zinc-500 shrink-0">{label}：</span>
      <span className="text-zinc-700 dark:text-zinc-200">{value}</span>
    </div>
  );
}

function TagPill({ tag }: { tag: string }) {
  return (
    <span className="px-1.5 py-0.5 bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-200 rounded text-[10px]">
      {tag}
    </span>
  );
}

export function MultiChartsPanel({ ziwei, vedic, western, arabic, unifiedTags }: Props) {
  const hasAny = ziwei || vedic || western || arabic;
  if (!hasAny) return null;

  const sun = western?.planets.find((p) => p.name === "sun");
  const moon = western?.planets.find((p) => p.name === "moon");

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-zinc-900 dark:text-zinc-100 text-sm">
          多术数排盘总览
        </h3>
        <span className="text-[10px] text-zinc-400">
          紫微 · 印度 · 西洋 · 阿拉伯
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {ziwei && (
          <PanelCard title="紫微斗数" accent="bg-purple-50 dark:bg-purple-900/20">
            <Row label="五行局" value={ziwei.fiveElementsClass} />
            <Row
              label="命宫"
              value={`${ziwei.soulPalaceStar}（${ziwei.soulPalaceBranch}）`}
            />
            <Row
              label="身宫"
              value={`${ziwei.bodyPalaceStar}（${ziwei.bodyPalaceBranch}）`}
            />
            <Row label="大限" value={
              ziwei.daxian.slice(0, 4).map((d) => `${d.startAge}岁起 ${d.earthlyBranch}`).join("；") || "—"
            } />
            <div className="flex flex-wrap gap-1 pt-1">
              {ziwei.tags.map((t, i) => <TagPill key={i} tag={t} />)}
            </div>
          </PanelCard>
        )}

        {vedic && (
          <PanelCard title="印度占星 Jyotish" accent="bg-orange-50 dark:bg-orange-900/20">
            <Row label="Lagna" value={vedic.lagna} />
            <Row label="月亮 Rashi" value={vedic.moonRashi} />
            <Row label="太阳 Rashi" value={vedic.sunRashi} />
            <Row label="月宿" value={`${vedic.moonNakshatra}（pada ${vedic.moonPada}）`} />
            <Row label="当前 Dasha" value={`${vedic.currentDasha.maha} / ${vedic.currentDasha.antar}`} />
            <Row label="Gochara" value={`土星过 ${vedic.gochara.saturn}，木星过 ${vedic.gochara.jupiter}`} />
            {vedic.yogas.length > 0 && (
              <Row label="Yoga" value={vedic.yogas.join("、")} />
            )}
            <div className="flex flex-wrap gap-1 pt-1">
              {vedic.tags.map((t, i) => <TagPill key={i} tag={t} />)}
            </div>
          </PanelCard>
        )}

        {western && (
          <PanelCard title="古典占星" accent="bg-blue-50 dark:bg-blue-900/20">
            {sun && (
              <Row label="太阳" value={`${sun.signName} ${sun.degreeInSign.toFixed(0)}°（第 ${sun.house} 宫）`} />
            )}
            {moon && (
              <Row label="月亮" value={`${moon.signName} ${moon.degreeInSign.toFixed(0)}°（第 ${moon.house} 宫）`} />
            )}
            <Row label="上升" value={ZODIAC[Math.floor(western.houses.ascendant / 30) % 12]} />
            <Row label="中天" value={ZODIAC[Math.floor(western.houses.midheaven / 30) % 12]} />
            <Row label="Firdaria" value={`${western.firdaria.ruler}（副 ${western.firdaria.subRuler ?? "无"}）`} />
            <Row label="Profection" value={`第 ${western.profection.house} 宫（守护 ${western.profection.ruler}）`} />
            {western.aspects.length > 0 && (
              <Row label="相位" value={western.aspects.slice(0, 5).map((a) => `${a.planetA}-${a.planetB}-${a.type}`).join("、")} />
            )}
            <div className="flex flex-wrap gap-1 pt-1">
              {western.tags.map((t, i) => <TagPill key={i} tag={t} />)}
            </div>
          </PanelCard>
        )}

        {arabic && (
          <PanelCard title="阿拉伯占星" accent="bg-emerald-50 dark:bg-emerald-900/20">
            {(() => {
              const pof = arabic.parts.find((p) => p.name === "Part of Fortune");
              const pos = arabic.parts.find((p) => p.name === "Part of Spirit");
              return (
                <>
                  {pof && <Row label="福点" value={`${ZH_ZODIAC[pof.sign] ?? pof.sign}（第 ${pof.house} 宫）`} />}
                  {pos && <Row label="灵点" value={`${ZH_ZODIAC[pos.sign] ?? pos.sign}（第 ${pos.house} 宫）`} />}
                </>
              );
            })()}
            <Row label="北交点" value={`${ZH_ZODIAC[arabic.northNode.sign] ?? arabic.northNode.sign}（第 ${arabic.northNode.house} 宫）`} />
            <Row label="南交点" value={`${ZH_ZODIAC[arabic.southNode.sign] ?? arabic.southNode.sign}（第 ${arabic.southNode.house} 宫）`} />
            <Row label="日主星" value={arabic.dayRuler} />
            <Row label="时主星" value={arabic.hourRuler} />
            <div className="flex flex-wrap gap-1 pt-1">
              {arabic.tags.map((t, i) => <TagPill key={i} tag={t} />)}
            </div>
          </PanelCard>
        )}
      </div>

      {unifiedTags.length > 0 && (
        <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-lg p-3">
          <div className="text-xs text-zinc-500 mb-2">跨术数汇总标签</div>
          <div className="flex flex-wrap gap-1.5">
            {unifiedTags.map((t, i) => (
              <span
                key={i}
                className="px-2 py-0.5 bg-zinc-100 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200 rounded-full text-xs"
              >
                {t}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
