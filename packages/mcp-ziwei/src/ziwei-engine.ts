// iztro 是 ES Module，可直接命名导入
import { astro } from "iztro";
import type { ZiweiResult, ZiweiPalace } from "@destiny/shared";

/**
 * 紫微斗数排盘核心函数
 *
 * @param date 公历日期 YYYY-MM-DD（已校准为真太阳时）
 * @param time 出生时间 HH:MM（已校准）
 * @param gender male | female
 */
export function calculateZiwei(
  date: string,
  time: string,
  gender: "male" | "female",
): ZiweiResult {
  const [hour] = time.split(":").map(Number);
  const timeIndex = hourToTimeIndex(hour);
  const iztroGender = gender === "male" ? "male" : "female";

  const astrolabe = astro.bySolar(date, timeIndex, iztroGender, true, "zh-CN");

  // 将 iztro palace 结构映射为我们的 ZiweiPalace
  const palaces: ZiweiPalace[] = (astrolabe.palaces ?? []).map((p: any) => {
    const majorStars = (p.majorStars ?? [])
      .filter((s: any) => s.scope === "origin")
      .map((s: any) => s.name);
    const minorStars = (p.minorStars ?? [])
      .filter((s: any) => s.scope === "origin")
      .map((s: any) => s.name);
    const adjectiveStars = (p.adjectiveStars ?? [])
      .filter((s: any) => s.scope === "origin")
      .map((s: any) => s.name);
    const sihua = (p.majorStars ?? [])
      .map((s: any) => s.mutagen)
      .filter((m: string) => m && m.length > 0);

    const decadal = p.decadal ?? { range: [0, 0] };
    const [startAge, endAge] = (decadal.range as [number, number]) ?? [0, 0];

    return {
      index: p.index,
      name: p.name,
      isSoulPalace: p.name === "命宫",
      isBodyPalace: !!p.isBodyPalace,
      heavenlyStem: p.heavenlyStem,
      earthlyBranch: p.earthlyBranch,
      majorStars,
      minorStars,
      adjectiveStars,
      sihua: sihua.length > 0 ? sihua : undefined,
      changsheng12: p.changsheng12,
      boshi12: p.boshi12,
      daxian: { startAge, endAge },
      ages: p.ages ?? [],
    };
  });

  // 大限列表（每个宫位的 decadal.range 即一条大限档）
  const daxian = (astrolabe.palaces ?? [])
    .filter((p: any) => p.decadal && Array.isArray(p.decadal.range))
    .map((p: any) => ({
      startAge: p.decadal.range[0],
      palace: p.name,
      heavenlyStem: p.decadal.heavenlyStem ?? p.heavenlyStem,
      earthlyBranch: p.decadal.earthlyBranch ?? p.earthlyBranch,
    }));

  // 命身宫主星
  const soulPalace = palaces.find((p) => p.isSoulPalace) ?? palaces[0];
  const bodyPalace = palaces.find((p) => p.isBodyPalace);
  const soulPalaceStar = soulPalace?.majorStars[0] ?? "（无主星）";
  const bodyPalaceStar = bodyPalace?.majorStars[0] ?? "（无主星）";

  // 特征标签
  const tags = buildZiweiTags(astrolabe, palaces, soulPalace);

  return {
    soulPalaceStar,
    bodyPalaceStar,
    fiveElementsClass: (astrolabe as any).fiveElementsClass ?? "",
    solarDate: (astrolabe as any).solarDate ?? date,
    lunarDate: (astrolabe as any).lunarDate ?? "",
    chineseDate: (astrolabe as any).chineseDate ?? "",
    time: (astrolabe as any).time ?? "",
    timeRange: (astrolabe as any).timeRange ?? "",
    sign: (astrolabe as any).sign ?? "",
    zodiac: (astrolabe as any).zodiac ?? "",
    soulPalaceBranch: (astrolabe as any).earthlyBranchOfSoulPalace ?? "",
    bodyPalaceBranch: (astrolabe as any).earthlyBranchOfBodyPalace ?? "",
    palaces,
    daxian,
    tags,
  };
}

/**
 * 将小时(0-23)转换为 iztro 的时辰序号(0-12)
 *
 * iztro 时辰序号约定：
 *  0  早子时 (00:00-01:00)
 *  1  丑时   (01:00-03:00)
 *  2  寅时   (03:00-05:00)
 *  3  卯时   (05:00-07:00)
 *  4  辰时   (07:00-09:00)
 *  5  巳时   (09:00-11:00)
 *  6  午时   (11:00-13:00)
 *  7  未时   (13:00-15:00)
 *  8  申时   (15:00-17:00)
 *  9  酉时   (17:00-19:00)
 *  10 戌时   (19:00-21:00)
 *  11 亥时   (21:00-23:00)
 *  12 晚子时 (23:00-24:00)
 */
function hourToTimeIndex(hour: number): number {
  if (hour === 0) return 0; // 0点 → 早子时
  if (hour === 23) return 12; // 23点 → 晚子时
  return Math.floor((hour + 1) / 2);
}

/**
 * 构造紫微斗数特征标签
 *
 * 用于后续 RAG 检索与 LLM 综合分析。每个标签都是命理学经典断语或格局。
 */
function buildZiweiTags(astrolabe: any, palaces: ZiweiPalace[], soul: ZiweiPalace | undefined): string[] {
  const tags: string[] = [];

  // 1. 命宫主星 + 五行局
  if (soul) {
    tags.push(`命宫:${soul.majorStars.join("/")}`);
    tags.push(`命宫地支:${soul.earthlyBranch}`);
  }
  const fiveElements = (astrolabe as any).fiveElementsClass ?? "";
  if (fiveElements) tags.push(`五行局:${fiveElements}`);

  // 2. 身宫主星 + 落点宫位
  const body = palaces.find((p) => p.isBodyPalace);
  if (body) {
    tags.push(`身宫:${body.name}`);
    if (body.majorStars.length > 0) tags.push(`身宫主星:${body.majorStars.join("/")}`);
  }

  // 3. 主星组合格局识别（杀破狼/机月同梁/紫府相/府相朝垣等）
  const soulMajors = new Set(soul?.majorStars ?? []);
  const allMajors = palaces.flatMap((p) => p.majorStars);
  const hasKillBreak = ["七杀", "破军", "贪狼"].some((s) => allMajors.includes(s));
  const hasJiYueTong = ["天机", "太阴", "天同", "天梁"].some((s) => allMajors.includes(s));
  if (hasKillBreak) tags.push("杀破狼格");
  if (hasJiYueTong) tags.push("机月同梁格");

  // 4. 紫微落点宫位
  const ziweiPalace = palaces.find((p) => p.majorStars.includes("紫微"));
  if (ziweiPalace) tags.push(`紫微在${ziweiPalace.earthlyBranch}`);

  // 5. 四化禄权科忌分布
  const sihuaMap: Record<string, string[]> = { 禄: [], 权: [], 科: [], 忌: [] };
  for (const p of palaces) {
    if (!p.sihua) continue;
    for (const m of p.sihua) {
      if (sihuaMap[m]) sihuaMap[m].push(p.name);
    }
  }
  for (const [key, ps] of Object.entries(sihuaMap)) {
    if (ps.length > 0) tags.push(`${key}在:${ps.join("/")}`);
  }

  // 6. 空宫/命宫三方四正汇总
  if (soul) {
    const soulIdx = soul.index;
    const triple = [soulIdx, (soulIdx + 4) % 12, (soulIdx + 8) % 12];
    const tripleNames = triple.map((i) => palaces[i]?.name).filter(Boolean);
    tags.push(`三方:${tripleNames.join("/")}`);
  }

  return tags;
}
