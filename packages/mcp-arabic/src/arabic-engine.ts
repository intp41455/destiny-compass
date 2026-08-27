/**
 * MCP-5 阿拉伯占星排盘引擎
 *
 * 阿拉伯占星核心特色：
 *  - Arabic Parts / Lots（公式：ASC + X - Y 形式）
 *  - 月亮南北交点（沿用西方天文学）
 *  - 时主星（Chaldean Hour Ruler）：日主星 + 时主星
 *  - 日主星按周循环（周日=Sun, 周一=Moon...）
 *
 * 共用 @destiny/shared/astronomy 模块。
 */
import {
  toAstroTime,
  calculateHouses,
  calculatePlanetPositions,
  meanNorthNode,
  meanSouthNode,
} from "@destiny/shared";
import type { AstroPlanetName, ArabicPart, PlanetPosition, ArabicResult } from "@destiny/shared";

const ZODIAC = [
  "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
  "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
];

const WEEKDAY_RULERS: AstroPlanetName[] = [
  "sun",    // 周日
  "moon",   // 周一
  "mars",   // 周二
  "mercury",// 周三
  "jupiter",// 周四
  "venus",  // 周五
  "saturn", // 周六
];

/** Chaldean 行星序列（用于时主星循环） */
const CHALDEAN: AstroPlanetName[] = [
  "saturn", "jupiter", "mars", "sun", "venus", "mercury", "moon",
];

/** 阿拉伯 Parts（Lots）定义：
 *  公式统一表示为 ASC + X - Y（按 Bonatti 标准集合的常用部分）
 */
interface PartDef {
  name: string;
  /** "X" 在公式 ASC + X - Y 中的部分 */
  x: AstroPlanetName | "sun_day" | "moon_day" | "asc_degree";
  y: AstroPlanetName | "sun_day" | "moon_day" | "asc_degree";
  /** 若公式倒置（Y - X 在夜间使用），则使用夜生公式 */
  nocturnalFlip: boolean;
}

const PART_DEFS: PartDef[] = [
  { name: "Part of Fortune", x: "moon", y: "sun", nocturnalFlip: true },
  { name: "Part of Spirit", x: "sun", y: "moon", nocturnalFlip: true },
  { name: "Part of Eros", x: "venus", y: "mars", nocturnalFlip: true },
  { name: "Part of Necessity", x: "saturn", y: "mercury", nocturnalFlip: true },
  { name: "Part of Vocation", x: "mercury", y: "moon", nocturnalFlip: false },
  { name: "Part of Marriage", x: "jupiter", y: "saturn", nocturnalFlip: false },
  { name: "Part of Death", x: "saturn", y: "jupiter", nocturnalFlip: false },
  { name: "Part of Father", x: "sun", y: "saturn", nocturnalFlip: false },
  { name: "Part of Mother", x: "moon", y: "saturn", nocturnalFlip: false },
  { name: "Part of Brothers", x: "jupiter", y: "saturn", nocturnalFlip: false },
];

export function calculateArabic(
  date: string,
  time: string,
  lat: number,
  lng: number,
): ArabicResult {
  const astroTime = toAstroTime(date, time, lng);
  const houses = calculateHouses(astroTime, lat, lng, "Equal");

  const planets = calculatePlanetPositions(astroTime, houses, "western");

  // 判断日生 / 夜生（按太阳是否在 7-12 宫为日生）
  const sun = planets.find((p) => p.name === "sun")!;
  const isDayBirth = sun.house >= 7 && sun.house <= 12;

  // 计算阿拉伯 Parts
  const asc = houses.ascendant;
  const parts: ArabicPart[] = PART_DEFS.map((def) => {
    let lonX = getPointValue(def.x, planets, asc);
    let lonY = getPointValue(def.y, planets, asc);

    // 夜生公式翻转（Fortune / Spirit / Eros / Necessity 等需要 nocturnal flip）
    if (isDayBirth) {
      // 日生公式 ASC + X - Y
    } else if (def.nocturnalFlip) {
      // 夜生公式 ASC + Y - X（即 X 与 Y 互换）
      [lonX, lonY] = [lonY, lonX];
    }

    let lon = (asc + lonX - lonY + 720) % 360;
    const signIdx = Math.floor(lon / 30) % 12;
    const house = findHouse(lon, houses);
    return {
      name: def.name,
      formula: isDayBirth || !def.nocturnalFlip
        ? `ASC + ${labelOf(def.x)} - ${labelOf(def.y)}`
        : `ASC + ${labelOf(def.y)} - ${labelOf(def.x)} (夜生翻转)`,
      longitude: Number(lon.toFixed(4)),
      sign: ZODIAC[signIdx],
      house,
    };
  });

  // 月亮南北交点
  const nn = meanNorthNode(astroTime);
  const sn = meanSouthNode(astroTime);
  const northNode = {
    longitude: nn,
    sign: ZODIAC[Math.floor(nn / 30) % 12],
    house: findHouse(nn, houses),
  };
  const southNode = {
    longitude: sn,
    sign: ZODIAC[Math.floor(sn / 30) % 12],
    house: findHouse(sn, houses),
  };

  // 日主星 + 时主星
  const birthDate = new Date(`${date}T${time}:00Z`);
  const weekday = birthDate.getUTCDay(); // 0=Sun ... 6=Sat
  const dayRuler = String(WEEKDAY_RULERS[weekday]);
  const hourRuler = String(computeHourRuler(astroTime, weekday));

  const tags = buildArabicTags(parts, northNode, southNode, dayRuler, hourRuler, isDayBirth);

  return {
    parts,
    northNode,
    southNode,
    dayRuler,
    hourRuler,
    planets,
    tags,
  };
}

/**
 * 解析 Part 定义中的"X/Y"为黄经度数
 *
 * - sun_day / moon_day：使用日主星/月主星占星循环的"sun"/"moon" 行星位置
 *   （此处简化为直接取太阳/月亮黄经）
 * - asc_degree：使用 ASC 黄经
 */
function getPointValue(
  ref: AstroPlanetName | "sun_day" | "moon_day" | "asc_degree",
  planets: PlanetPosition[],
  asc: number,
): number {
  if (ref === "asc_degree") return asc;
  if (ref === "sun_day") {
    return planets.find((p) => p.name === "sun")!.longitude;
  }
  if (ref === "moon_day") {
    return planets.find((p) => p.name === "moon")!.longitude;
  }
  return planets.find((p) => p.name === ref)!.longitude;
}

function labelOf(ref: AstroPlanetName | "sun_day" | "moon_day" | "asc_degree"): string {
  if (ref === "asc_degree") return "ASC";
  if (ref === "sun_day") return "Sun";
  if (ref === "moon_day") return "Moon";
  return ref.charAt(0).toUpperCase() + ref.slice(1);
}

/**
 * 计算时主星
 *
 * 1. 当日升起时的日主星（按周日=Sun 起算）
 * 2. 从日主星起的第一个"小时"（按 Chaldean 序列回退）
 * 3. 从日出（≈ 6:00）到当前时间经过的小时数（取模 7）找到时主星
 */
function computeHourRuler(time: ReturnType<typeof toAstroTime>, weekday: number): AstroPlanetName {
  // 日主星对应 Chaldean 索引
  const dayRuler = WEEKDAY_RULERS[weekday];
  // Chaldean 序列：[saturn, jupiter, mars, sun, venus, mercury, moon]
  const startIdx = CHALDEAN.indexOf(dayRuler);
  // 取 UTC 小时数（整数小时，简化）
  const hour = time.date.getUTCHours();
  const hourIdx = (startIdx + hour) % 7;
  return CHALDEAN[hourIdx];
}

function findHouse(lon: number, houses: { cusps: number[] }): number {
  for (let i = 0; i < 12; i++) {
    const start = houses.cusps[i];
    const end = houses.cusps[(i + 1) % 12];
    if (start <= end) {
      if (lon >= start && lon < end) return i + 1;
    } else {
      if (lon >= start || lon < end) return i + 1;
    }
  }
  return 1;
}

function buildArabicTags(
  parts: ArabicPart[],
  nn: { sign: string; house: number },
  sn: { sign: string; house: number },
  dayRuler: string,
  hourRuler: string,
  isDay: boolean,
): string[] {
  const tags: string[] = [];
  tags.push(`日主星:${dayRuler}`);
  tags.push(`时主星:${hourRuler}`);
  tags.push(isDay ? "日生" : "夜生");
  tags.push(`北交点:${nn.sign}(宫${nn.house})`);
  tags.push(`南交点:${sn.sign}(宫${sn.house})`);
  // Part of Fortune 是最重要的
  const pof = parts.find((p) => p.name === "Part of Fortune");
  if (pof) tags.push(`福点:${pof.sign}(宫${pof.house})`);
  const pos = parts.find((p) => p.name === "Part of Spirit");
  if (pos) tags.push(`灵点:${pos.sign}(宫${pos.house})`);
  return tags;
}
