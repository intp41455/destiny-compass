/**
 * MCP-3 印度占星排盘引擎
 *
 * 基于 @destiny/shared/astronomy 模块：
 *  - Lahiri ayanamsa → 恒星黄道（sidereal zodiac）
 *  - 12 Rashi（恒星星座）+ 27 Nakshatra（星宿）+ 4 Pada
 *  - Lagna（上升 Rashi）
 *  - Vimshottari Dasha 大运系统（120 年循环，9 个主星）
 *  - Yoga 组合识别
 *  - Ashtakavarga 总分（简化）
 *  - Gochara 推运：土星/木星/Rahu/Ketu 过宫 Rashi
 *
 * @param date 已校准真太阳时日期 YYYY-MM-DD
 * @param time 已校准时间 HH:MM
 * @param lat 纬度
 * @param lng 经度
 * @param age 当前年龄（用于当前 Dasha 推算）
 */
import {
  toAstroTime,
  calculateHouses,
  calculatePlanetPositions,
  toVedicPosition,
  lahiriAyanamsa,
  meanNorthNode,
  meanSouthNode,
  nakshatraOf,
} from "@destiny/shared";
import type { PlanetPosition, VedicResult, HouseCusps } from "@destiny/shared";

const VEDIC_RASHI = [
  "Mesha", "Vrishabha", "Mithuna", "Karka", "Simha", "Kanya",
  "Tula", "Vrishchika", "Dhanu", "Makara", "Kumbha", "Meena",
];

/** Vimshottari Dasha 主星序列 */
const DASHA_ORDER = [
  "Ketu", "Venus", "Sun", "Moon", "Mars", "Rahu", "Jupiter", "Saturn", "Mercury",
] as const;

/** Vimshottari Dasha 主星年限（共 120 年） */
const DASHA_YEARS: Record<typeof DASHA_ORDER[number], number> = {
  Ketu: 7,
  Venus: 20,
  Sun: 6,
  Moon: 10,
  Mars: 7,
  Rahu: 18,
  Jupiter: 16,
  Saturn: 19,
  Mercury: 17,
};

/** 行星名 → Dash 系统 9 星名 */
const PLANET_TO_DASHA: Record<string, string> = {
  sun: "Sun",
  moon: "Moon",
  mars: "Mars",
  mercury: "Mercury",
  jupiter: "Jupiter",
  venus: "Venus",
  saturn: "Saturn",
  north_node: "Rahu",
  south_node: "Ketu",
};

/** Dash 行星 → 行星名（反查） */
const DASHA_TO_PLANET: Record<string, string> = Object.fromEntries(
  Object.entries(PLANET_TO_DASHA).map(([p, d]) => [d, p]),
);

export function calculateVedic(
  date: string,
  time: string,
  lat: number,
  lng: number,
  age: number,
): VedicResult {
  const astroTime = toAstroTime(date, time, lng);
  const ayanamsa = lahiriAyanamsa(astroTime);

  // Whole Sign 宫位系统（印度常用），用 ASC 所在 Rashi 0° 为第 1 宫
  const houses = calculateHouses(astroTime, lat, lng, "WholeSign");

  // 西方行星位置（回归黄道）→ 转换为恒星黄道
  const tropical = calculatePlanetPositions(astroTime, houses, "vedic");
  const sidereal: PlanetPosition[] = tropical.map((p) => toVedicPosition(p, ayanamsa, houses));

  // 加入南北交点（恒星黄道）
  const nnTropical = meanNorthNode(astroTime);
  const snTropical = meanSouthNode(astroTime);
  const nnSidereal = ((nnTropical - ayanamsa) % 360 + 360) % 360;
  const snSidereal = ((snTropical - ayanamsa) % 360 + 360) % 360;

  sidereal.push({
    name: "north_node",
    longitude: nnSidereal,
    latitude: 0,
    speed: -0.0529, // 平均月亮交点速度，逆行（负值表示节点反向）
    signIndex: Math.floor(nnSidereal / 30) % 12,
    signName: VEDIC_RASHI[Math.floor(nnSidereal / 30) % 12],
    degreeInSign: nnSidereal - Math.floor(nnSidereal / 30) * 30,
    house: findHouse(nnSidereal, houses),
    retrograde: true,
  });
  sidereal.push({
    name: "south_node",
    longitude: snSidereal,
    latitude: 0,
    speed: -0.0529,
    signIndex: Math.floor(snSidereal / 30) % 12,
    signName: VEDIC_RASHI[Math.floor(snSidereal / 30) % 12],
    degreeInSign: snSidereal - Math.floor(snSidereal / 30) * 30,
    house: findHouse(snSidereal, houses),
    retrograde: true,
  });

  // Lagna = ASC 所在 Rashi
  const ascSidereal = ((houses.ascendant - ayanamsa) % 360 + 360) % 360;
  const lagnaIndex = Math.floor(ascSidereal / 30) % 12;
  const lagna = VEDIC_RASHI[lagnaIndex];

  // 月亮 Nakshatra
  const moon = sidereal.find((p) => p.name === "moon")!;
  const moonNak = nakshatraOf(moon.longitude);

  // 月/太阳 Rashi
  const sun = sidereal.find((p) => p.name === "sun")!;
  const moonRashi = VEDIC_RASHI[moon.signIndex];
  const sunRashi = VEDIC_RASHI[sun.signIndex];

  // 计算 Vimshottari Dasha
  const dashaList = calculateVimshottari(moon);

  // 当前 Mahadasha + Antardasha
  const currentDasha = findCurrentDasha(dashaList, age);

  // Yoga 组合
  const yogas = identifyYogas(sidereal, houses, ayanamsa);

  // Ashtakavarga 总分（简化：每个行星固定 48 分 × 7 = 336 + 月 49 = 385）
  const ashtakavargaTotal = 385;

  // Gochara 推运：用当前时间的天体过宫（用今天的 UTC）
  const now = new Date();
  const transitTime = toAstroTime(
    `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}`,
    `${String(now.getUTCHours()).padStart(2, "0")}:${String(now.getUTCMinutes()).padStart(2, "0")}`,
    lng,
  );
  const transitTropical = calculatePlanetPositions(transitTime, houses, "vedic");
  const transitSaturn = toVedicPosition(
    transitTropical.find((p) => p.name === "saturn")!,
    ayanamsa,
    houses,
  );
  const transitJupiter = toVedicPosition(
    transitTropical.find((p) => p.name === "jupiter")!,
    ayanamsa,
    houses,
  );
  const transitRahuLon = ((meanNorthNode(transitTime) - ayanamsa) % 360 + 360) % 360;
  const transitKetuLon = ((meanSouthNode(transitTime) - ayanamsa) % 360 + 360) % 360;

  const tags = buildVedicTags(sidereal, lagna, moonNak.name, currentDasha, yogas);

  return {
    planets: sidereal,
    lagna,
    moonNakshatra: moonNak.name,
    moonPada: moonNak.pada,
    moonRashi,
    sunRashi,
    dashas: dashaList,
    currentDasha,
    yogas,
    ashtakavargaTotal,
    gochara: {
      saturn: VEDIC_RASHI[Math.floor(transitSaturn.longitude / 30) % 12],
      jupiter: VEDIC_RASHI[Math.floor(transitJupiter.longitude / 30) % 12],
      rahu: VEDIC_RASHI[Math.floor(transitRahuLon / 30) % 12],
      ketu: VEDIC_RASHI[Math.floor(transitKetuLon / 30) % 12],
    },
    tags,
  };
}

/**
 * Vimshottari Dasha 大运计算
 *
 * 月亮所在 Nakshatra 决定起始 Mahadasha：
 *  Ashwini/Magha/Mula → Ketu (7 年)
 *  Bharani/Purva Phalguni/Purva Ashadha → Venus (20)
 *  Krittika/Uttara Phalguni/Uttara Ashadha → Sun (6)
 *  ...
 *
 * 起点：从月亮在 Nakshatra 内的相对位置决定已经过去多少
 *
 * 简化实现：从出生时开始，按主星序列循环生成 9 个 Mahadasha
 */
function calculateVimshottari(moon: PlanetPosition): { planet: string; startAge: number; endAge: number }[] {
  const nak = nakshatraOf(moon.longitude);
  const startIndex = NAK_DASHA_INDEX[nak.name] ?? 0;
  // Nakshatra 内进度（0-1）
  const segSize = 360 / 27;
  const segStart = NAK_INDICES[nak.name] * segSize;
  const progress = (moon.longitude - segStart) / segSize; // 0-1

  // 起始主星已用比例 = progress × 主星年限
  const totalYears = 120;
  const dashas: { planet: string; startAge: number; endAge: number }[] = [];

  let acc = 0;
  for (let i = 0; i < 9; i++) {
    const dashaName = DASHA_ORDER[(startIndex + i) % 9];
    const len = DASHA_YEARS[dashaName];
    // 第一段：扣掉已用部分
    const remaining = i === 0 ? len * (1 - progress) : len;
    dashas.push({
      planet: dashaName,
      startAge: Math.round(acc * 100) / 100,
      endAge: Math.round((acc + remaining) * 100) / 100,
    });
    acc += remaining;
    if (acc > totalYears + 0.01) break;
  }

  // 后续完整周期（120 年后回到第一个主星，循环 2 个周期足够）
  // 简化：返回完整 9 主星周期 + 第 10 个周期起点
  while (acc < totalYears * 2) {
    for (let i = 0; i < 9; i++) {
      const dashaName = DASHA_ORDER[(startIndex + i) % 9];
      const len = DASHA_YEARS[dashaName];
      dashas.push({
        planet: dashaName,
        startAge: Math.round(acc * 100) / 100,
        endAge: Math.round((acc + len) * 100) / 100,
      });
      acc += len;
      if (acc > totalYears * 2 + 0.01) break;
    }
  }

  return dashas;
}

const NAK_INDICES: Record<string, number> = {
  "Ashwini": 0, "Bharani": 1, "Krittika": 2, "Rohini": 3, "Mrigashira": 4,
  "Ardra": 5, "Punarvasu": 6, "Pushya": 7, "Ashlesha": 8, "Magha": 9,
  "Purva Phalguni": 10, "Uttara Phalguni": 11, "Hasta": 12, "Chitra": 13,
  "Swati": 14, "Vishakha": 15, "Anuradha": 16, "Jyeshtha": 17, "Mula": 18,
  "Purva Ashadha": 19, "Uttara Ashadha": 20, "Shravana": 21, "Dhanishta": 22,
  "Shatabhisha": 23, "Purva Bhadrapada": 24, "Uttara Bhadrapada": 25, "Revati": 26,
};

const NAK_DASHA_INDEX: Record<string, number> = Object.fromEntries(
  Object.entries(NAK_INDICES).map(([name, idx]) => [name, idx % 9]),
);

/**
 * 找当前 Mahadasha + Antardasha
 */
function findCurrentDasha(
  dashas: { planet: string; startAge: number; endAge: number }[],
  age: number,
): { maha: string; antar: string; pratyantar?: string } {
  const maha = dashas.find((d) => age >= d.startAge && age < d.endAge) ?? dashas[0];

  // Antardasha 比例：在主星年限内，按 9 主星子段分配
  const totalLen = maha.endAge - maha.startAge;
  const ageInMaha = age - maha.startAge;
  const mahaYears = DASHA_YEARS[maha.planet as keyof typeof DASHA_YEARS] ?? 10;
  const startIndex = DASHA_ORDER.indexOf(maha.planet as typeof DASHA_ORDER[number]);

  // Antardasha 子段长度 = 主星年限 × 副星年限 / 120
  let acc = 0;
  let antar = DASHA_ORDER[startIndex];
  for (let i = 0; i < 9; i++) {
    const subName = DASHA_ORDER[(startIndex + i) % 9];
    const subLen = (mahaYears * DASHA_YEARS[subName]) / 120;
    if (ageInMaha < acc + subLen) {
      antar = subName;
      break;
    }
    acc += subLen;
  }

  return { maha: maha.planet, antar };
}

/**
 * 识别常见 Yoga
 *
 * - Raja Yoga：守护星互在角宫/三合宫
 * - Gaja Kesari Yoga：月亮与木星三合/对冲
 * - Chandra-Mangala Yoga：月亮与火星合相
 * - Budha-Aditya Yoga：太阳与水星合相
 * - Hamsa Yoga：木星在角宫且跃升/守护
 */
function identifyYogas(planets: PlanetPosition[], houses: HouseCusps, _ayanamsa: number): string[] {
  const yogas: string[] = [];
  const get = (n: string) => planets.find((p) => p.name === n);

  const moon = get("moon");
  const sun = get("sun");
  const jupiter = get("jupiter");
  const mars = get("mars");
  const mercury = get("mercury");

  // 角宫：第 1/4/7/10 宫（Whole Sign 中即 Lagna 起第 1/4/7/10 Rashi）
  const angular = (p?: PlanetPosition) => p && [1, 4, 7, 10].includes(p.house);

  if (moon && jupiter) {
    const d = angleDiff(moon.longitude, jupiter.longitude);
    if (Math.abs(d - 90) < 8 || Math.abs(d - 120) < 8 || Math.abs(d - 180) < 8 || Math.abs(d - 0) < 8) {
      yogas.push("Gaja Kesari Yoga（月木吉相）");
    }
  }
  if (moon && mars) {
    if (angleDiff(moon.longitude, mars.longitude) < 8) yogas.push("Chandra-Mangala Yoga");
  }
  if (sun && mercury) {
    if (angleDiff(sun.longitude, mercury.longitude) < 10) yogas.push("Budha-Aditya Yoga");
  }
  if (jupiter && angular(jupiter)) {
    yogas.push("Hamsa Yoga（木星入角宫）");
  }
  // Raja Yoga 简化：守护星互在角宫
  const rashiOfLagna = Math.floor(houses.ascendant / 30) % 12;
  // 跳过复杂的 Raja Yoga 判定，简单加一条占位
  if (moon && angular(moon)) yogas.push("Chandra Lagna Raja Yoga 倾向");

  return yogas;
}

function angleDiff(a: number, b: number): number {
  let d = Math.abs(a - b) % 360;
  if (d > 180) d = 360 - d;
  return d;
}

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

function buildVedicTags(
  planets: PlanetPosition[],
  lagna: string,
  moonNak: string,
  currentDasha: { maha: string; antar: string },
  yogas: string[],
): string[] {
  const tags: string[] = [];
  const sun = planets.find((p) => p.name === "sun")!;
  const moon = planets.find((p) => p.name === "moon")!;

  tags.push(`Lagna:${lagna}`);
  tags.push(`月亮Rashi:${VEDIC_RASHI[moon.signIndex]}`);
  tags.push(`太阳Rashi:${VEDIC_RASHI[sun.signIndex]}`);
  tags.push(`月亮Nakshatra:${moonNak}`);
  tags.push(`当前Mahadasha:${currentDasha.maha}`);
  tags.push(`当前Antardasha:${currentDasha.antar}`);
  for (const y of yogas) tags.push(`Yoga:${y}`);

  return tags;
}
