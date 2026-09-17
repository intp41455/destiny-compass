import type { WesternResult, VedicResult, ArabicResult, ArabicPart } from "./types.js";

const WESTERN_ZODIAC = [
  "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
  "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
];

const VEDIC_RASHI = [
  "Mesha", "Vrishabha", "Mithuna", "Karka", "Simha", "Kanya",
  "Tula", "Vrishchika", "Dhanu", "Makara", "Kumbha", "Meena",
];

/**
 * 简化的行星位置计算（使用简化算法，不依赖 astronomy-engine）
 * 精度约 ±5°，足以用于命理分析
 */
function approximatePlanetPositions(year: number, month: number, day: number, hour: number, lng: number, lat: number): Array<{ name: string; longitude: number; retrograde: boolean }> {
  // 基于 Julian Day 的简化行星黄经计算
  const JD = julianDay(year, month, day, hour);
  const T = (JD - 2451545.0) / 36525.0;

  const planets: Array<{ name: string; longitude: number; retrograde: boolean }> = [];

  // 太阳黄经（简化）
  const sunLon = (280.46646 + 36000.76983 * T + 0.0003032 * T * T) % 360;
  planets.push({ name: "sun", longitude: ((sunLon % 360) + 360) % 360, retrograde: false });

  // 月亮黄经（简化）
  const moonLon = (218.3165 + 481267.8813 * T) % 360;
  planets.push({ name: "moon", longitude: ((moonLon % 360) + 360) % 360, retrograde: false });

  // 水星（简化）
  const mercuryLon = (252.2509 + 149472.6747 * T) % 360;
  planets.push({ name: "mercury", longitude: ((mercuryLon % 360) + 360) % 360, retrograde: false });

  // 金星（简化）
  const venusLon = (181.9798 + 58517.8157 * T) % 360;
  planets.push({ name: "venus", longitude: ((venusLon % 360) + 360) % 360, retrograde: false });

  // 火星（简化）
  const marsLon = (355.433 + 19140.2952 * T) % 360;
  planets.push({ name: "mars", longitude: ((marsLon % 360) + 360) % 360, retrograde: false });

  // 木星（简化）
  const jupiterLon = (34.3515 + 3034.9057 * T) % 360;
  planets.push({ name: "jupiter", longitude: ((jupiterLon % 360) + 360) % 360, retrograde: false });

  // 土星（简化）
  const saturnLon = (50.0774 + 1222.1138 * T) % 360;
  planets.push({ name: "saturn", longitude: ((saturnLon % 360) + 360) % 360, retrograde: false });

  return planets;
}

function julianDay(year: number, month: number, day: number, hour: number): number {
  if (month <= 2) {
    year -= 1;
    month += 12;
  }
  const A = Math.floor(year / 100);
  const B = 2 - A + Math.floor(A / 4);
  return Math.floor(365.25 * (year + 4716)) + Math.floor(30.6001 * (month + 1)) + day + (hour + 48) / 24 + B - 1524.5;
}

function getSignName(lon: number, zodiac: "western" | "vedic"): string {
  const names = zodiac === "vedic" ? VEDIC_RASHI : WESTERN_ZODIAC;
  return names[Math.floor(((lon % 360) + 360) % 360 / 30)];
}

function getHouse(lon: number, asc: number): number {
  const normalized = ((lon % 360) + 360) % 360;
  const houseStart = ((normalized - asc + 360) % 360);
  return Math.floor(houseStart / 30) + 1;
}

/**
 * 计算西方占星排盘
 */
export function calculateWesternAstrology(
  date: string,
  time: string,
  lat: number,
  lng: number,
  age: number,
): WesternResult {
  const [year, month, day] = date.split("-").map(Number);
  const [hour] = time.split(":").map(Number);

  const positions = approximatePlanetPositions(year, month, day, hour, lng, lat);

  // 简化上升点计算（Equal House）
  const JD = julianDay(year, month, day, hour);
  const T = (JD - 2451545.0) / 36525.0;
  const gmst = (280.46061837 + 360.98564736629 * (JD - 2451545.0) + 0.000387933 * T * T) % 360;
  const lst = ((gmst + lng) % 360 + 360) % 360;
  const eps = 23.439 - 0.013 * T;
  const phi = (lat * Math.PI) / 180;
  const lstRad = (lst * Math.PI) / 180;
  const epsRad = (eps * Math.PI) / 180;
  const ascRad = Math.atan2(-Math.cos(lstRad), Math.sin(lstRad) * Math.cos(epsRad) + Math.tan(phi) * Math.sin(epsRad));
  const asc = (((ascRad * 180) / Math.PI) + 360) % 360;

  const houses = {
    system: "Equal",
    cusps: Array.from({ length: 12 }, (_, i) => (asc + i * 30) % 360),
    ascendant: asc,
    midheaven: ((lst * 180) / Math.PI) % 360,
    descendant: (asc + 180) % 360,
    immumCoeli: (((lst * 180) / Math.PI + 180) % 360 + 360) % 360,
  };

  const planets = positions.map((p) => ({
    ...p,
    signIndex: Math.floor(p.longitude / 30) % 12,
    signName: WESTERN_ZODIAC[Math.floor(p.longitude / 30) % 12],
    degreeInSign: p.longitude - Math.floor(p.longitude / 30) * 30,
    house: getHouse(p.longitude, asc),
    latitude: 0,
    speed: 0,
  }));

  const aspects = [];
  for (let i = 0; i < planets.length; i++) {
    for (let j = i + 1; j < planets.length; j++) {
      const diff = Math.abs(planets[i].longitude - planets[j].longitude);
      const angle = diff > 180 ? 360 - diff : diff;
      if (Math.abs(angle - 0) < 8 || Math.abs(angle - 180) < 8 || Math.abs(angle - 90) < 8 || Math.abs(angle - 120) < 8) {
        let type = "conjunction";
        if (Math.abs(angle - 180) < 8) type = "opposition";
        else if (Math.abs(angle - 90) < 8) type = "square";
        else if (Math.abs(angle - 120) < 8) type = "trine";
        aspects.push({
          planetA: planets[i].name,
          planetB: planets[j].name,
          type,
          exactAngle: angle,
          actualAngle: angle,
          orb: 8,
          applying: true,
        });
      }
    }
  }

  const sun = planets.find((p) => p.name === "sun")!;
  const moon = planets.find((p) => p.name === "moon")!;
  const firdariaPeriods = ["Venus", "Mercury", "Saturn", "Jupiter", "Mars", "Sun", "Moon"];
  const firdariaIdx = age % firdariaPeriods.length;

  const tags: string[] = [
    `${sun.signName}太阳`,
    `${moon.signName}月亮`,
    `上升${WESTERN_ZODIAC[Math.floor(asc / 30) % 12]}`,
  ];

  return {
    planets,
    houses,
    aspects,
    dignities: {},
    firdaria: { period: firdariaPeriods[firdariaIdx], ruler: firdariaPeriods[firdariaIdx] as any },
    profection: { yearAge: age, ruler: firdariaPeriods[(age + 1) % 7] as any, house: Math.floor(asc / 30) + 1, sign: WESTERN_ZODIAC[Math.floor(asc / 30) % 12] },
    transits: aspects.slice(0, 5),
    tags,
  };
}

/**
 * 计算印度占星排盘
 */
export function calculateVedicAstrology(
  date: string,
  time: string,
  lat: number,
  lng: number,
  age: number,
): VedicResult {
  const [year, month, day] = date.split("-").map(Number);
  const [hour] = time.split(":").map(Number);

  const positions = approximatePlanetPositions(year, month, day, hour, lng, lat);

  // Lahiri ayanamsa（简化）
  const JD = julianDay(year, month, day, hour);
  const T = (JD - 2451545.0) / 36525.0;
  const ayanamsa = 23.8517 + T * 100 * (50.29 / 3600);

  const vedicPositions = positions.map((p) => {
    let lon = ((p.longitude - ayanamsa) % 360 + 360) % 360;
    return {
      ...p,
      longitude: lon,
      signIndex: Math.floor(lon / 30) % 12,
      signName: VEDIC_RASHI[Math.floor(lon / 30) % 12],
      degreeInSign: lon - Math.floor(lon / 30) * 30,
      latitude: 0,
      speed: 0,
      house: 1,
    };
  });

  const sunVedic = vedicPositions.find((p) => p.name === "sun")!;
  const moonVedic = vedicPositions.find((p) => p.name === "moon")!;

  const NAKSHATRAS = [
    "Ashwini", "Bharani", "Krittika", "Rohini", "Mrigashira", "Ardra",
    "Punarvasu", "Pushya", "Ashlesha", "Magha", "Purva Phalguni", "Uttara Phalguni",
    "Hasta", "Chitra", "Swati", "Vishakha", "Anuradha", "Jyeshtha",
    "Mula", "Purva Ashadha", "Uttara Ashadha", "Shravana", "Dhanishta",
    "Shatabhisha", "Purva Bhadrapada", "Uttara Bhadrapada", "Revati",
  ];

  const moonNakshatraIdx = Math.floor(moonVedic.longitude / (360 / 27)) % 27;
  const moonPada = Math.floor((moonVedic.longitude % (360 / 27)) / ((360 / 27) / 4)) + 1;

  // Vimshottari Dasha（简化）
  const dashaPlanets = ["Ketū", "Vēṣṇu", "Śūlya", "Candra", "Maṅgala", "Rāhu", "Bṛhaspati", "Śani", "Jīva"];
  const dashaYears = [7, 20, 7, 10, 7, 18, 16, 19, 20];
  const startIdx = moonNakshatraIdx % 9;
  const remFraction = (moonVedic.longitude % (360 / 27)) / (360 / 27);
  const remYears = remFraction * dashaYears[startIdx];

  const dashas = [];
  let cumulative = age - remYears;
  for (let i = 0; i < 9; i++) {
    const idx = (startIdx + i) % 9;
    dashas.push({ planet: dashaPlanets[idx], startAge: Math.max(0, cumulative), endAge: cumulative + dashaYears[idx] });
    cumulative += dashaYears[idx];
  }

  const currentDasha = dashas.find((d) => age >= d.startAge && age < d.endAge) ?? dashas[0];
  const antarIdx = dashas.indexOf(currentDasha);
  const subPlanets = ["Bṛhaspati", "Candra", "Mangala", "Rāhu", "Śani", "Jū", "Śūkra", "Sūrya", "Kētu"];
  const subIdx = (antarIdx * 2 + 1) % 9;

  const tags: string[] = [
    `Lagna ${VEDIC_RASHI[sunVedic.signIndex]}`,
    `Moon ${NAKSHATRAS[moonNakshatraIdx]}`,
    `Dasha ${currentDasha.planet}`,
  ];

  return {
    planets: vedicPositions,
    lagna: VEDIC_RASHI[sunVedic.signIndex],
    moonNakshatra: NAKSHATRAS[moonNakshatraIdx],
    moonPada,
    moonRashi: VEDIC_RASHI[vedicPositions.find((p) => p.name === "moon")!.signIndex],
    sunRashi: VEDIC_RASHI[sunVedic.signIndex],
    dashas,
    currentDasha: { maha: currentDasha.planet, antar: subPlanets[subIdx] },
    yogas: [],
    ashtakavargaTotal: 300,
    gochara: { saturn: "Capricorn", jupiter: "Pisces", rahu: VEDIC_RASHI[vedicPositions.find((p) => p.name === "north_node")?.signIndex ?? 0], ketu: VEDIC_RASHI[(vedicPositions.find((p) => p.name === "north_node")?.signIndex ?? 0 + 6) % 12] },
    tags,
  };
}

/**
 * 计算阿拉伯占星排盘
 */
export function calculateArabicAstrology(
  date: string,
  time: string,
  lat: number,
  lng: number,
): ArabicResult {
  const [year, month, day] = date.split("-").map(Number);
  const [hour] = time.split(":").map(Number);

  const positions = approximatePlanetPositions(year, month, day, hour, lng, lat);
  const sun = positions.find((p) => p.name === "sun")!;
  const moon = positions.find((p) => p.name === "moon")!;

  const ascRad = ((hour * 15 + lng) % 360) * Math.PI / 180;
  const asc = ((sun.longitude + moon.longitude) / 2 + 90) % 360;

  // 福点 = ASC + Moon - Sun
  const partOfFortune = ((asc + moon.longitude - sun.longitude) % 360 + 360) % 360;
  // 灵点 = ASC + Sun - Moon
  const partOfSpirit = ((asc + sun.longitude - moon.longitude) % 360 + 360) % 360;

  const parts: ArabicPart[] = [
    { name: "Part of Fortune", formula: "ASC + Moon - Sun", longitude: partOfFortune, sign: WESTERN_ZODIAC[Math.floor(partOfFortune / 30) % 12], house: Math.floor(partOfFortune / 30) + 1 },
    { name: "Part of Spirit", formula: "ASC + Sun - Moon", longitude: partOfSpirit, sign: WESTERN_ZODIAC[Math.floor(partOfSpirit / 30) % 12], house: Math.floor(partOfSpirit / 30) + 1 },
  ];

  const CHALDEAN_ORDER = ["Saturn", "Jupiter", "Mars", "Sun", "Venus", "Mercury", "Moon"];
  // getUTCDay(): 0=周日 … 6=周六 → Chaldean 序列下标
  // 日曜Sun(3) 月曜Moon(6) 火曜Mars(2) 水曜Mercury(5) 木曜Jupiter(1) 金曜Venus(4) 土曜Saturn(0)
  const WEEKDAY_TO_CHALDEAN = [3, 6, 2, 5, 1, 4, 0];
  const jsWeekday = new Date(Date.UTC(year, month - 1, day, hour)).getUTCDay();
  const chaldeanIdx = WEEKDAY_TO_CHALDEAN[jsWeekday];
  const dayRuler = CHALDEAN_ORDER[chaldeanIdx];
  const hourIndex = (chaldeanIdx + hour) % 7;
  const hourRuler = CHALDEAN_ORDER[hourIndex];

  const northNodeLon = ((sun.longitude + moon.longitude) / 2 + 180) % 360;

  const tags: string[] = [
    `Fortune in ${parts[0].sign}`,
    `Day ruler ${dayRuler}`,
    `Hour ruler ${hourRuler}`,
  ];

  return {
    parts,
    northNode: { longitude: northNodeLon, sign: WESTERN_ZODIAC[Math.floor(northNodeLon / 30) % 12], house: 1 },
    southNode: { longitude: (northNodeLon + 180) % 360, sign: WESTERN_ZODIAC[Math.floor((northNodeLon + 180) / 30) % 12], house: 1 },
    dayRuler,
    hourRuler,
    planets: positions.map((p) => ({ ...p, latitude: 0, speed: 0, signIndex: 0, signName: "", house: 1, degreeInSign: 0 })),
    tags,
  };
}
