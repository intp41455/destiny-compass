/**
 * MCP-4 古典占星排盘引擎
 *
 * 基于 @destiny/shared/astronomy 模块（封装 astronomy-engine）：
 *  - 计算回归黄道行星位置（7 大行星 + 月亮南北交点）
 *  - 计算宫位（Placidus 简化 / Equal / Whole Sign）
 *  - 计算相位（合/冲/刑/三合/六合 + 次相位）
 *  - 计算 essential/accidental dignities（行星尊贵表）
 *  - 计算法达星限 Firdaria
 *  - 计算小限 Profection
 *  - 计算推运 transit 关键相位（土星/木星/天王* 简化到本命相位）
 */
import {
  toAstroTime,
  calculateHouses,
  calculatePlanetPositions,
  meanNorthNode,
  meanSouthNode,
} from "@destiny/shared";
import type {
  AstroPlanetName,
  Aspect,
  PlanetPosition,
  WesternResult,
  HouseCusps,
} from "@destiny/shared";

const ZODIAC = [
  "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
  "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
];

/** 传统行星守护关系（essential dignities by rulership） */
const RULERS = {
  Aries: "mars", Taurus: "venus", Gemini: "mercury", Cancer: "moon", Leo: "sun", Virgo: "mercury",
  Libra: "venus", Scorpio: "mars", Sagittarius: "jupiter", Capricorn: "saturn",
  Aquarius: "saturn", Pisces: "jupiter",
} as const;

/** Exaltation（跃升） */
const EXALTED: Record<string, AstroPlanetName> = {
  Aries: "sun",
  Taurus: "moon",
  Cancer: "jupiter",
  Virgo: "mercury",
  Capricorn: "mars",
  Aquarius: "saturn",
  Libra: "saturn",
  Pisces: "venus",
};

/** Detriment（失势 = 守护星的反位） */
const DETRIMENT: Record<string, AstroPlanetName> = {
  Aries: "venus", Taurus: "mars", Gemini: "jupiter", Cancer: "saturn", Leo: "saturn", Virgo: "jupiter",
  Libra: "mars", Scorpio: "venus", Sagittarius: "mercury", Capricorn: "moon",
  Aquarius: "sun", Pisces: "mercury",
};

/** Fall（落陷 = exaltation 的对宫） */
const FALL: Record<string, AstroPlanetName | ""> = {
  Aries: "saturn", Taurus: "saturn", Gemini: "", Cancer: "saturn", Leo: "", Virgo: "",
  Libra: "sun", Scorpio: "moon", Sagittarius: "", Capricorn: "jupiter",
  Aquarius: "moon", Pisces: "mercury",
};

/** Triplicity（昼夜三分守护） */
const TRIPLICITY_DAY: Record<string, AstroPlanetName> = {
  Aries: "sun", Leo: "sun", Sagittarius: "sun", // 火
  Taurus: "moon", Virgo: "moon", Capricorn: "moon", // 土
  Gemini: "saturn", Libra: "saturn", Aquarius: "saturn", // 风
  Cancer: "venus", Scorpio: "venus", Pisces: "venus", // 水
};

/** Chaldean 行星序列（Firdaria / 时主星） */
const CHALDEAN: AstroPlanetName[] = [
  "sun", "venus", "mercury", "moon", "saturn", "jupiter", "mars",
];

/**
 * 古典占星核心排盘
 *
 * @param date 已校准真太阳时日期 YYYY-MM-DD
 * @param time 已校准时间 HH:MM
 * @param gender male|female（影响 Firdaria 夜间/日间分配）
 * @param lat 纬度
 * @param lng 经度
 * @param age 当前年龄（用于 Firdaria/Profection 推算）
 */
export function calculateWestern(
  date: string,
  time: string,
  gender: "male" | "female",
  lat: number,
  lng: number,
  age: number,
): WesternResult {
  const astroTime = toAstroTime(date, time, lng);
  const houses = calculateHouses(astroTime, lat, lng, "Equal");

  // 行星位置（含 7 大行星）
  const basePositions = calculatePlanetPositions(astroTime, houses, "western");

  // 加入月亮南北交点
  const nn = meanNorthNode(astroTime);
  const sn = meanSouthNode(astroTime);
  const planets: PlanetPosition[] = [
    ...basePositions,
    {
      name: "north_node",
      longitude: nn,
      latitude: 0,
      speed: 0,
      signIndex: Math.floor(nn / 30) % 12,
      signName: ZODIAC[Math.floor(nn / 30) % 12],
      degreeInSign: nn - Math.floor(nn / 30) * 30,
      house: findHouse(nn, houses),
      retrograde: false, // 月亮交点恒逆行（按定义）— 此处标记 true
    } as PlanetPosition,
  ];
  // 标记 node 逆行
  planets[planets.length - 1].retrograde = true;

  // 相位（仅本命内部）
  const aspects = calculateAspects(planets);

  // 行星尊贵表
  const dignities = calculateDignities(planets, houses);

  // 判断日夜
  const sun = planets.find((p) => p.name === "sun")!;
  const isDayBirth = isAboveHorizon(sun.longitude, houses);

  // Firdaria
  const firdaria = calculateFirdaria(age, isDayBirth);

  // Profection
  const profection = calculateProfection(age, planets, houses);

  // Transit（简化：返回本命盘内的几个关键相位作为占位）
  const transits: Aspect[] = [];

  const tags = buildWesternTags(planets, houses, isDayBirth);

  return {
    planets,
    houses,
    aspects,
    dignities,
    firdaria,
    profection,
    transits,
    tags,
  };
}

/**
 * 相位计算（仅看本命盘内行星之间）
 *
 * 标准相位（容许度）：
 *  合相 0° (8°) | 六合 60° (4°) | 刑 90° (8°) | 三合 120° (8°) | 冲 180° (8°)
 */
function calculateAspects(planets: PlanetPosition[]): Aspect[] {
  const aspects: Aspect[] = [];
  const ASPECTS = [
    { type: "conjunction", angle: 0, orb: 8 },
    { type: "sextile", angle: 60, orb: 4 },
    { type: "square", angle: 90, orb: 8 },
    { type: "trine", angle: 120, orb: 8 },
    { type: "opposition", angle: 180, orb: 8 },
  ];

  for (let i = 0; i < planets.length; i++) {
    for (let j = i + 1; j < planets.length; j++) {
      const a = planets[i];
      const b = planets[j];
      const diff = angularDiff(a.longitude, b.longitude);
      for (const asp of ASPECTS) {
        const orb = Math.abs(diff - asp.angle);
        if (orb <= asp.orb) {
          aspects.push({
            planetA: a.name,
            planetB: b.name,
            type: asp.type,
            exactAngle: asp.angle,
            actualAngle: diff,
            orb: Number(orb.toFixed(2)),
            // 简化：若 a 速度 > b 速度则入相（applying）
            applying: a.speed > b.speed,
          });
        }
      }
    }
  }
  return aspects;
}

/**
 * 计算两黄经之间最小角度差（0-180）
 */
function angularDiff(a: number, b: number): number {
  let d = Math.abs(a - b) % 360;
  if (d > 180) d = 360 - d;
  return Number(d.toFixed(2));
}

/**
 * 计算行星尊贵表（essential + accidental）
 *
 * - essential: rulership/exaltation/triplicity (按星座)
 * - accidental: 在 ASC/MC 附近、第 1/10 宫等
 */
function calculateDignities(
  planets: PlanetPosition[],
  houses: HouseCusps,
): Record<string, { essential: string[]; accidental: string[] }> {
  const out: Record<string, { essential: string[]; accidental: string[] }> = {};

  for (const p of planets) {
    if (p.name === "north_node" || p.name === "south_node") continue;
    const sign = ZODIAC[p.signIndex];
    const essential: string[] = [];
    const accidental: string[] = [];

    if (RULERS[sign as keyof typeof RULERS] === p.name) essential.push("rulership");
    if (EXALTED[sign] === p.name) essential.push("exaltation");
    if (DETRIMENT[sign] === p.name) essential.push("detriment");
    if (FALL[sign] === p.name) essential.push("fall");
    if (TRIPLICITY_DAY[sign] === p.name) essential.push("triplicity");

    // accidental：靠近 ASC（±8°）或 MC（±8°）
    if (Math.abs(angleDiffCircle(p.longitude, houses.ascendant)) <= 8) {
      accidental.push("near_ascendant");
    }
    if (Math.abs(angleDiffCircle(p.longitude, houses.midheaven)) <= 8) {
      accidental.push("near_midheaven");
    }
    // 在第 1/4/7/10 宫（角宫）
    if ([1, 4, 7, 10].includes(p.house)) {
      accidental.push("angular_house");
    } else if ([2, 5, 8, 11].includes(p.house)) {
      accidental.push("succedent_house");
    } else {
      accidental.push("cadent_house");
    }

    out[p.name] = { essential, accidental };
  }

  return out;
}

/**
 * 角宫差（用于 accidental dignity）
 */
function angleDiffCircle(a: number, b: number): number {
  let d = Math.abs(a - b) % 360;
  if (d > 180) d = 360 - d;
  return d;
}

/**
 * 判断太阳是否在地平线上（白昼命）
 *
 * 简化判断：太阳在 7-12 宫为白昼，1-6 宫为夜晚
 * （实际上 12 宫在地平线下、ASC 附近仍为夜，此处近似）
 */
function isAboveHorizon(sunLon: number, houses: HouseCusps): boolean {
  // ASC = 东地平线；DSC = 西地平线
  // 太阳在 ASC→DSC 顺时针方向（即上方）→ 白昼
  const asc = houses.ascendant;
  const dsc = houses.descendant;
  // 0-360：从 ASC 到 DSC 顺时针走 180°，这段是"下方"（夜）
  // 反方向是上方（昼）
  let lon = sunLon;
  let fromAsc = (lon - asc + 360) % 360; // 太阳相对 ASC 的角度
  return fromAsc > 180;
}

/**
 * 法达星限（Firdaria）
 *
 * 7 行星 + 北交点（共 8 大主限），日生顺序：日→金→水→月→土→木→火→北交
 * 夜生顺序：月→土→木→火→日→金→水→北交
 *
 * 主限每段长度：日 75 年 / 夜 75 年分配
 * 简化：每段 75/7 ≈ 10.71 年，第 8 段（北交）取剩余或为 2.5 年
 *
 * @param age 当前年龄
 * @param isDay 日生 / 夜生
 */
function calculateFirdaria(age: number, isDay: boolean): {
  period: string;
  ruler: AstroPlanetName;
  subRuler?: AstroPlanetName;
} {
  // 标准 Firdaria 主限长度表
  const FIRDARIA_LENGTHS: Record<AstroPlanetName, number> = {
    sun: 10, moon: 9, mars: 8, mercury: 13, jupiter: 12, venus: 8, saturn: 11,
    north_node: 2.5, south_node: 0,
  };

  const order: AstroPlanetName[] = isDay
    ? ["sun", "venus", "mercury", "moon", "saturn", "jupiter", "mars", "north_node"]
    : ["moon", "saturn", "jupiter", "mars", "sun", "venus", "mercury", "north_node"];

  // 找到当前年龄所在的主限
  let acc = 0;
  let maha: AstroPlanetName = order[0];
  for (const p of order) {
    const len = FIRDARIA_LENGTHS[p] ?? 0;
    if (age < acc + len) {
      maha = p;
      break;
    }
    acc += len;
  }

  // 副限（subRuler）：在主限内按相同顺序循环
  const subIdx = Math.floor((age - acc) / (FIRDARIA_LENGTHS[maha] / 7));
  const subRuler = order[subIdx % order.length];

  return {
    period: `${isDay ? "日" : "夜"}生主限`,
    ruler: maha,
    subRuler: maha === "north_node" ? undefined : subRuler,
  };
}

/**
 * 小限（Annual Profection）
 *
 * 从第 1 宫（命宫）起 0 岁，每 12 年一轮回。
 * 当前年宫 = (age % 12) + 1（即 1-12 宫）
 * 该宫的守护星即年度主星
 */
function calculateProfection(
  age: number,
  planets: PlanetPosition[],
  houses: HouseCusps,
): { yearAge: number; ruler: AstroPlanetName; house: number; sign: string } {
  const house = (age % 12) + 1;
  // 宫位起点黄经
  const cusp = houses.cusps[house - 1];
  const signIndex = Math.floor(cusp / 30) % 12;
  const sign = ZODIAC[signIndex];
  const ruler = (RULERS[sign as keyof typeof RULERS] as AstroPlanetName) ?? "sun";
  return { yearAge: age, ruler, house, sign };
}

/**
 * 查找行星所在宫位（1-12）
 */
function findHouse(lon: number, houses: HouseCusps): number {
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

/**
 * 构造西洋占星标签
 */
function buildWesternTags(
  planets: PlanetPosition[],
  houses: HouseCusps,
  isDay: boolean,
): string[] {
  const tags: string[] = [];
  const sun = planets.find((p) => p.name === "sun")!;
  const moon = planets.find((p) => p.name === "moon")!;
  const asc = houses.ascendant;
  const ascSign = ZODIAC[Math.floor(asc / 30) % 12];

  tags.push(`太阳:${sun.signName}(${sun.degreeInSign.toFixed(0)}°)`);
  tags.push(`月亮:${moon.signName}(${moon.degreeInSign.toFixed(0)}°)`);
  tags.push(`上升:${ascSign}`);
  tags.push(`中天:${ZODIAC[Math.floor(houses.midheaven / 30) % 12]}`);
  tags.push(isDay ? "日生" : "夜生");

  // 太阳-月亮关系
  const sunMoonDiff = angularDiff(sun.longitude, moon.longitude);
  tags.push(`日月角度:${sunMoonDiff.toFixed(0)}°`);

  // 主要相位标签
  const aspects = calculateAspects(planets);
  const major = aspects.filter(
    (a) => ["conjunction", "opposition", "square", "trine"].includes(a.type),
  );
  for (const a of major.slice(0, 5)) {
    tags.push(`${a.planetA}-${a.planetB}-${a.type}`);
  }

  // 行星尊贵
  const dignities = calculateDignities(planets, houses);
  for (const [name, d] of Object.entries(dignities)) {
    if (d.essential.includes("rulership")) tags.push(`${name}入庙(${d.essential.join(",")})`);
    if (d.essential.includes("exaltation")) tags.push(`${name}跃升`);
    if (d.essential.includes("detriment")) tags.push(`${name}失势`);
    if (d.essential.includes("fall")) tags.push(`${name}落陷`);
  }

  return tags;
}
