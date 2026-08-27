/**
 * 共享星历模块（astronomy-engine 封装）
 *
 * 提供给 MCP-3/4/5 印度/西洋/阿拉伯占星共用的：
 *  - 本地日期时间 → UTC AstroTime 转换
 *  - 行星地心黄经/黄纬/速度
 *  - 月亮南北交点（mean node）
 *  - 宫位 cusps（ASC/MC/IC/DSC + 12宫）
 *  - Lahiri ayanamsa（恒星黄道换算）
 */
import * as Astronomy from "astronomy-engine";
import type { AstroPlanetName, HouseCusps, PlanetPosition } from "../schemas/charts.js";

const WESTERN_ZODIAC = [
  "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
  "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
];

const VEDIC_RASHI = [
  "Mesha", "Vrishabha", "Mithuna", "Karka", "Simha", "Kanya",
  "Tula", "Vrishchika", "Dhanu", "Makara", "Kumbha", "Meena",
];

const BODY_MAP: Record<Exclude<AstroPlanetName, "north_node" | "south_node">, Astronomy.Body> = {
  sun: Astronomy.Body.Sun,
  moon: Astronomy.Body.Moon,
  mercury: Astronomy.Body.Mercury,
  venus: Astronomy.Body.Venus,
  mars: Astronomy.Body.Mars,
  jupiter: Astronomy.Body.Jupiter,
  saturn: Astronomy.Body.Saturn,
};

const PLANET_NAMES: Exclude<AstroPlanetName, "north_node" | "south_node">[] = [
  "sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn",
];

/**
 * 把本地民历时间 + 经度 → UTC AstroTime
 *
 * 标准时区经度 = round(lng/15)*15，所以 UTC = localTime - tzOffset
 * 其中 tzOffset = round(lng/15) 小时
 *
 * @param date YYYY-MM-DD（本地民历日期）
 * @param time HH:MM（本地民历时间，已由 calculateSolarTime 校准为真太阳时）
 * @param lng  出生地经度
 */
export function toAstroTime(date: string, time: string, lng: number): Astronomy.AstroTime {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  // 本地民历时间（以标准时区为基准）对应的 UTC
  const tzOffsetHours = Math.round(lng / 15);
  const localMs = Date.UTC(y, m - 1, d, hh, mm, 0);
  const utcMs = localMs - tzOffsetHours * 3600 * 1000;
  return new Astronomy.AstroTime(new Date(utcMs));
}

/**
 * 计算黄赤交角 ε
 *
 * ε = 23° 26' 21.448" - 46.815" T - 0.00059" T^2 + 0.001813" T^3
 * 其中 T 为从 J2000 起的儒略世纪
 */
export function obliquity(time: Astronomy.AstroTime): number {
  // time.tt = 相对 J2000.0 (JD 2451545.0) 的天数；T 为儒略世纪
  const T = time.tt / 36525.0;
  // 标准 IAU 公式（度）
  const epsArcSec = 23.439291111 - 0.013004167 * T - 1.64e-7 * T * T + 5.04e-7 * T * T * T;
  return epsArcSec;
}

/**
 * 计算本地恒星时 LST（单位：度，[0, 360)）
 *
 * GMST 由 SiderealTime(time) 返回（小时），
 * LST = GMST + 经度（度）
 */
export function localSiderealTime(time: Astronomy.AstroTime, lng: number): number {
  const gmstHours = Astronomy.SiderealTime(time);
  let lst = (gmstHours * 15 + lng) % 360;
  if (lst < 0) lst += 360;
  return lst;
}

/**
 * 计算中天 MC（黄经）
 *
 * MC 的赤经等于 LST，将 RA → ecliptic longitude：
 *   tan(λ) = tan(α) / cos(ε)
 */
export function midheaven(time: Astronomy.AstroTime, lng: number): number {
  const lst = localSiderealTime(time, lng); // 度
  const eps = (obliquity(time) * Math.PI) / 180;
  const ra = (lst * Math.PI) / 180;
  // arctan2 处理四象限
  let mcRad = Math.atan2(Math.sin(ra) / Math.cos(eps), Math.cos(ra));
  mcRad = ((mcRad % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  return (mcRad * 180) / Math.PI;
}

/**
 * 计算上升点 ASC（黄经）
 *
 *   ASC = arctan2(
 *     -cos(LST),
 *     sin(LST)*cos(ε) + tan(纬度)*sin(ε)
 *   )
 */
export function ascendant(time: Astronomy.AstroTime, lat: number, lng: number): number {
  const lst = (localSiderealTime(time, lng) * Math.PI) / 180;
  const eps = (obliquity(time) * Math.PI) / 180;
  const phi = (lat * Math.PI) / 180;
  let ascRad = Math.atan2(
    -Math.cos(lst),
    Math.sin(lst) * Math.cos(eps) + Math.tan(phi) * Math.sin(eps),
  );
  ascRad = ((ascRad % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  return (ascRad * 180) / Math.PI;
}

/**
 * 计算宫位 cusps（Equal House / Whole Sign / 简化 Placidus）
 *
 * - Equal House：12 宫各 30°，从 ASC 起
 * - Whole Sign：以 ASC 所在星座 0° 起算
 * - Placidus（简化）：在极地附近会失效，此处降级为 Equal
 */
export function calculateHouses(
  time: Astronomy.AstroTime,
  lat: number,
  lng: number,
  system: "Equal" | "WholeSign" | "Placidus" = "Equal",
): HouseCusps {
  const asc = ascendant(time, lat, lng);
  const mc = midheaven(time, lng);
  const ic = (mc + 180) % 360;
  const dsc = (asc + 180) % 360;

  let cusps: number[];
  if (system === "WholeSign") {
    // 以 ASC 所在星座 0° 为第 1 宫起点
    const startSign = Math.floor(asc / 30) * 30;
    cusps = Array.from({ length: 12 }, (_, i) => (startSign + i * 30) % 360);
  } else if (system === "Placidus") {
    // 完整 Placidus 计算复杂；此处采用近似：ASC/MC/IC/DSC 固定，
    // 其余宫位 30° 平分（退化 Equal）以避免极地异常
    cusps = Array.from({ length: 12 }, (_, i) => (asc + i * 30) % 360);
    // 第 10 宫起点替换为 MC（Placidus 中第 10 宫宫头 = MC）
    cusps[9] = mc;
    // 第 4 宫宫头 = IC
    cusps[3] = ic;
  } else {
    // Equal House
    cusps = Array.from({ length: 12 }, (_, i) => (asc + i * 30) % 360);
  }

  return {
    system,
    cusps,
    ascendant: asc,
    midheaven: mc,
    descendant: dsc,
    immumCoeli: ic,
  };
}

/**
 * 计算行星位置（地心黄道坐标）
 *
 * 返回所有 7 颗主行星（不含南北交点）的：
 *  - 黄经 longitude (0-360)
 *  - 黄纬 latitude
 *  - 速度 °/day（用于判断逆行，速度<0 即逆行）
 *  - 星座序号 / 星座名 / 星座内度数 / 宫位
 */
export function calculatePlanetPositions(
  time: Astronomy.AstroTime,
  houses: HouseCusps,
  zodiac: "western" | "vedic" = "western",
): PlanetPosition[] {
  // 用比 time 早一天的向量计算"前一帧"，差分得到速度
  const prev = time.AddDays(-1 / 1440); // 1 分钟前
  const signNames = zodiac === "vedic" ? VEDIC_RASHI : WESTERN_ZODIAC;

  const positions: PlanetPosition[] = [];

  for (const name of PLANET_NAMES) {
    const body = BODY_MAP[name];
    const vec = Astronomy.GeoVector(body, time, false);
    const ecl = Astronomy.Ecliptic(vec);

    const vecPrev = Astronomy.GeoVector(body, prev, false);
    const eclPrev = Astronomy.Ecliptic(vecPrev);

    // 处理黄经跨 0/360 跳变
    let lon = ecl.elon;
    let lonPrev = eclPrev.elon;
    let speed = lon - lonPrev;
    if (speed > 180) speed -= 360;
    if (speed < -180) speed += 360;
    // speed 是 1 分钟差分，乘以 1440 得到 °/day
    speed *= 1440;

    const signIndex = Math.floor(lon / 30) % 12;
    const degreeInSign = lon - signIndex * 30;
    const house = houseOf(lon, houses);

    positions.push({
      name,
      longitude: lon,
      latitude: ecl.elat,
      speed,
      signIndex,
      signName: signNames[signIndex],
      degreeInSign,
      house,
      retrograde: speed < 0,
    });
  }

  return positions;
}

/**
 * 计算月亮平均北交点（mean node）黄经
 *
 * 公式（标准 IAU）：
 *   Ω = 125.0445479 - 1934.13626197 * T + 0.0020797 * T^2 + T^3/450000
 * 其中 T 为从 J2000 起的儒略世纪
 *
 * 返回北交点黄经（度，0-360）；南交点 = 北交点 + 180
 */
export function meanNorthNode(time: Astronomy.AstroTime): number {
  const T = time.tt / 36525.0;
  let omega = 125.0445479 - 1934.13626197 * T + 0.0020797 * T * T + (T * T * T) / 450000;
  omega = ((omega % 360) + 360) % 360;
  return omega;
}

export function meanSouthNode(time: Astronomy.AstroTime): number {
  return (meanNorthNode(time) + 180) % 360;
}

/**
 * Lahiri (Chitra Paksha) ayanamsa
 *
 * J2000.0 时刻 ayanamsa ≈ 23°51'06" ≈ 23.851667°
 * 岁差约 50.29"/年
 *
 * 返回度数（用于：恒星黄道 = 回归黄道 - ayanamsa）
 */
export function lahiriAyanamsa(time: Astronomy.AstroTime): number {
  const T = time.tt / 36525.0;
  const baseAyanamsa = 23.851667; // J2000 时的 Lahiri 值
  const precessionPerYear = 50.29 / 3600; // 度/年
  const ayanamsa = baseAyanamsa + T * 100 * precessionPerYear;
  return ayanamsa;
}

/**
 * 将一个行星位置映射到印度恒星黄道（减去 Lahiri ayanamsa）
 */
export function toVedicPosition(pos: PlanetPosition, ayanamsa: number, houses: HouseCusps): PlanetPosition {
  let lon = pos.longitude - ayanamsa;
  lon = ((lon % 360) + 360) % 360;
  const signIndex = Math.floor(lon / 30) % 12;
  return {
    ...pos,
    longitude: lon,
    signIndex,
    signName: VEDIC_RASHI[signIndex],
    degreeInSign: lon - signIndex * 30,
    house: houseOf(lon, houses),
  };
}

/**
 * 计算黄经 lon 所在的宫位（1-12）
 *
 * 找出第一个 cusps[i] <= lon < cusps[i+1]（mod 360）
 */
export function houseOf(lon: number, houses: HouseCusps): number {
  let lonNorm = ((lon % 360) + 360) % 360;
  for (let i = 0; i < 12; i++) {
    const start = houses.cusps[i];
    const end = houses.cusps[(i + 1) % 12];
    // 处理跨 0/360
    if (start <= end) {
      if (lonNorm >= start && lonNorm < end) return i + 1;
    } else {
      if (lonNorm >= start || lonNorm < end) return i + 1;
    }
  }
  return 1;
}

/**
 * 计算印度 Nakshatra（27 星宿）
 *
 * 每宿跨 13°20' = 800'
 * 起点：白羊 0°（恒星黄道）
 */
const NAKSHATRAS = [
  "Ashwini", "Bharani", "Krittika", "Rohini", "Mrigashira", "Ardra",
  "Punarvasu", "Pushya", "Ashlesha", "Magha", "Purva Phalguni", "Uttara Phalguni",
  "Hasta", "Chitra", "Swati", "Vishakha", "Anuradha", "Jyeshtha",
  "Mula", "Purva Ashadha", "Uttara Ashadha", "Shravana", "Dhanishta",
  "Shatabhisha", "Purva Bhadrapada", "Uttara Bhadrapada", "Revati",
];

export function nakshatraOf(siderealLon: number): { name: string; pada: number } {
  const lon = ((siderealLon % 360) + 360) % 360;
  const segSize = 360 / 27; // 13.333
  const seg = Math.floor(lon / segSize);
  const pada = Math.floor((lon - seg * segSize) / (segSize / 4)) + 1;
  return { name: NAKSHATRAS[seg % 27], pada };
}
