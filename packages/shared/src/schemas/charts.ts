/** 排盘输入参数 */
export interface PaipanInput {
  birthday: string;       // 公历日期 YYYY-MM-DD
  birthTime: string;      // 出生时间 HH:MM
  gender: "male" | "female";
  locationName: string;   // 出生地名称
  lat?: number;           // 可选手动指定纬度
  lng?: number;           // 可选手动指定经度
  timezone?: string;      // 可选，默认从经度推断
}

/** 真太阳时校准结果 */
export interface SolarTimeResult {
  inputTime: string;           // 原始输入时间
  solarTime: string;           // 校准后真太阳时
  offsetMinutes: number;       // 校准偏移分钟数
  lng: number;
  lat: number;
  locationName: string;
  longitudeDiffMinutes: number; // 经度时差分钟
  equationOfTimeMinutes: number; // 均时差分钟
  timezone: string;
}

/** 八字排盘结果 */
export interface BaziResult {
  pillars: {
    year: string;
    month: string;
    day: string;
    hour: string;
  };
  dayMaster: string;
  tenGods: Record<string, string>;
  hiddenStems: Record<string, string[]>;
  nayin: string;
  dayun: { startAge: number; endAge?: number; stems: string[] }[];
  shensha: string[];
  tags: string[];
}

// ============================================================
// 紫微斗数 (MCP-2)
// ============================================================

export interface ZiweiPalace {
  /** 宫位序号 0-11（从寅宫起，顺时针） */
  index: number;
  /** 宫位名（命/财帛/事业/田宅/福德/迁移/父母/兄弟/夫妻/子女/疾厄/奴仆） */
  name: string;
  /** 是否命宫 */
  isSoulPalace?: boolean;
  /** 是否身宫 */
  isBodyPalace?: boolean;
  heavenlyStem: string;
  earthlyBranch: string;
  /** 主星（紫微/天机/太阳…） */
  majorStars: string[];
  /** 辅星（左辅右弼文昌文曲天魁天钺等） */
  minorStars: string[];
  /** 乙级星（擎羊/陀罗/火星/铃星/地空/地劫等） */
  adjectiveStars: string[];
  /** 四化（禄/权/科/忌）落于此宫 */
  sihua?: string[];
  /** 长生十二神 */
  changsheng12: string;
  /** 博士十二神 */
  boshi12: string;
  /** 大限起止年龄 */
  daxian: { startAge: number; endAge: number };
  /** 流年小限可用年龄 */
  ages: number[];
}

export interface ZiweiResult {
  /** 命宫主星 */
  soulPalaceStar: string;
  /** 身宫主星 */
  bodyPalaceStar: string;
  /** 五行局（如 水二局/土五局） */
  fiveElementsClass: string;
  /** 阳历日期 */
  solarDate: string;
  /** 农历日期 */
  lunarDate: string;
  /** 八字四柱（与 MCP-1 对齐） */
  chineseDate: string;
  /** 出生时辰（如 未时） */
  time: string;
  /** 时辰时间范围（如 13:00~15:00） */
  timeRange: string;
  /** 西方星座 */
  sign: string;
  /** 生肖 */
  zodiac: string;
  /** 命宫地支 */
  soulPalaceBranch: string;
  /** 身宫地支 */
  bodyPalaceBranch: string;
  /** 十二宫完整数据 */
  palaces: ZiweiPalace[];
  /** 大限列表（从命宫起，每 10 年一档） */
  daxian: { startAge: number; palace: string; heavenlyStem: string; earthlyBranch: string }[];
  /** 特征标签（如 紫微在午/杀破狼格/阳梁昌格） */
  tags: string[];
}

// ============================================================
// 占星共享基础（西洋/印度/阿拉伯共用）
// ============================================================

/** 行星枚举（覆盖西洋/印度/阿拉伯需要的天体） */
export type AstroPlanetName =
  | "sun" | "moon" | "mercury" | "venus" | "mars"
  | "jupiter" | "saturn"
  /** 北交点（印度称 Rahu） */
  | "north_node"
  /** 南交点（印度称 Ketu） */
  | "south_node";

/** 行星位置（黄道度数 + 星座 + 宫位） */
export interface PlanetPosition {
  name: AstroPlanetName;
  /** 黄经度数 0-360 */
  longitude: number;
  /** 黄纬度数 */
  latitude: number;
  /** 速度（°/day），逆行为负 */
  speed: number;
  /** 黄道星座序号 0-11（白羊=0） */
  signIndex: number;
  /** 星座名（西洋用 Aries…，印度用 Mesha…） */
  signName: string;
  /** 星座内度数 0-30 */
  degreeInSign: number;
  /** 宫位序号 1-12 */
  house: number;
  /** 是否逆行 */
  retrograde: boolean;
}

/** 宫位 cusps（黄经度数） */
export interface HouseCusps {
  /** 宫位系统名（Placidus/Equal/Whole Sign） */
  system: string;
  /** 12 个宫位的起点黄经 */
  cusps: number[];
  /** 上升点 ASC */
  ascendant: number;
  /** 天顶 MC */
  midheaven: number;
  /** 下降点 DSC */
  descendant: number;
  /** 下中天 IC */
  immumCoeli: number;
}

// ============================================================
// 古典占星 (MCP-4)
// ============================================================

export interface Aspect {
  /** 主体星 */
  planetA: AstroPlanetName;
  /** 客体星 */
  planetB: AstroPlanetName;
  /** 相位类型（conjunction/opposition/trine/square/sextile 等） */
  type: string;
  /** 精确度数 */
  exactAngle: number;
  /** 实际角度差 */
  actualAngle: number;
  /** 容许度 */
  orb: number;
  /** 是否入相/出相 */
  applying: boolean;
}

export interface WesternResult {
  /** 行星位置 */
  planets: PlanetPosition[];
  /** 宫位 cusps */
  houses: HouseCusps;
  /** 相位 */
  aspects: Aspect[];
  /** 行星尊贵表：每个行星的 essential/accidental dignities */
  dignities: Record<string, { essential: string[]; accidental: string[] }>;
  /** 法达星限（Firdaria）：当前主星 + 副星 */
  firdaria: { period: string; ruler: AstroPlanetName; subRuler?: AstroPlanetName };
  /** 小限（Profection）：当前年宫位 */
  profection: { yearAge: number; ruler: AstroPlanetName; house: number; sign: string };
  /** 推运 transit 关键相位 */
  transits: Aspect[];
  /** 特征标签 */
  tags: string[];
}

// ============================================================
// 印度占星 (MCP-3)
// ============================================================

export interface VedicResult {
  /** 恒星黄道行星位置（Lahiri ayanamsa 已减） */
  planets: PlanetPosition[];
  /** 上升 Rashi */
  lagna: string;
  /** 月亮所在 Nakshatra */
  moonNakshatra: string;
  /** 月亮所在 Nakshatra 的 Pada 1-4 */
  moonPada: number;
  /** 月亮 Rashi */
  moonRashi: string;
  /** 太阳 Rashi */
  sunRashi: string;
  /** 大运 Vimshottari Dasha 列表（年表） */
  dashas: { planet: string; startAge: number; endAge: number }[];
  /** 当前 Mahadasha + Antardasha */
  currentDasha: { maha: string; antar: string; pratyantar?: string };
  /** Yoga 组合 */
  yogas: string[];
  /** Ashtakavarga 总分 */
  ashtakavargaTotal: number;
  /** 推运 Gochara：土星/木星过宫所在 Rashi */
  gochara: { saturn: string; jupiter: string; rahu: string; ketu: string };
  /** 特征标签 */
  tags: string[];
}

// ============================================================
// 阿拉伯占星 (MCP-5)
// ============================================================

export interface ArabicPart {
  /** 部分名（如 Part of Fortune / Part of Spirit） */
  name: string;
  /** 计算公式（如 ASC + Moon - Sun） */
  formula: string;
  /** 黄经度数 */
  longitude: number;
  /** 所在星座 */
  sign: string;
  /** 所在宫位 */
  house: number;
}

export interface ArabicResult {
  /** 阿拉伯部分（Lots）集合 */
  parts: ArabicPart[];
  /** 北交点 */
  northNode: { longitude: number; sign: string; house: number };
  /** 南交点 */
  southNode: { longitude: number; sign: string; house: number };
  /** 时主星（Chaldean sequence，日间/夜间不同） */
  dayRuler: string;
  /** 月主星（按行星日主循环） */
  hourRuler: string;
  /** 复用的行星位置（仅返回由 swisseph 算出的部分） */
  planets: PlanetPosition[];
  /** 特征标签 */
  tags: string[];
}

/** 统一排盘输出 */
export interface ChartsResult {
  meta: {
    birthday: string;
    solarTimeCorrected: string;
    trueSolarOffsetMin: number;
    gender: "male" | "female";
    lat: number;
    lng: number;
    timezone: string;
    locationName: string;
  };
  bazi: BaziResult;
  ziwei?: ZiweiResult;
  vedic?: VedicResult;
  western?: WesternResult;
  arabic?: ArabicResult;
  unifiedTags: string[];
}

/** SSE 事件类型 */
export type SSEEvent =
  | { type: "progress"; step: string; message: string }
  | { type: "charts"; data: ChartsResult }
  | { type: "analysis"; section: string; content: string }
  | { type: "done"; analysisId: string; tokens: number }
  | { type: "error"; step: string; message: string };
