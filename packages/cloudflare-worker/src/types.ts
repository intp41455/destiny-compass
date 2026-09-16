/** 排盘输入参数 */
export interface PaipanInput {
  birthday: string;
  birthTime: string;
  gender: "male" | "female";
  locationName: string;
  lat?: number;
  lng?: number;
  timezone?: string;
}

/** 真太阳时校准结果 */
export interface SolarTimeResult {
  inputTime: string;
  solarTime: string;
  offsetMinutes: number;
  lng: number;
  lat: number;
  locationName: string;
  longitudeDiffMinutes: number;
  equationOfTimeMinutes: number;
  timezone: string;
}

/** 八字排盘结果 */
export interface BaziResult {
  pillars: { year: string; month: string; day: string; hour: string };
  dayMaster: string;
  tenGods: Record<string, string>;
  hiddenStems: Record<string, string[]>;
  nayin: string;
  dayun: { startAge: number; endAge?: number; stems: string[] }[];
  shensha: string[];
  tags: string[];
}

/** 行星位置 */
export interface PlanetPosition {
  name: string;
  longitude: number;
  latitude: number;
  speed: number;
  signIndex: number;
  signName: string;
  degreeInSign: number;
  house: number;
  retrograde: boolean;
}

/** 宫位 cusps */
export interface HouseCusps {
  system: string;
  cusps: number[];
  ascendant: number;
  midheaven: number;
  descendant: number;
  immumCoeli: number;
}

/** 相位 */
export interface Aspect {
  planetA: string;
  planetB: string;
  type: string;
  exactAngle: number;
  actualAngle: number;
  orb: number;
  applying: boolean;
}

/** 西方占星结果 */
export interface WesternResult {
  planets: PlanetPosition[];
  houses: HouseCusps;
  aspects: Aspect[];
  dignities: Record<string, { essential: string[]; accidental: string[] }>;
  firdaria: { period: string; ruler: string };
  profection: { yearAge: number; ruler: string; house: number; sign: string };
  transits: Aspect[];
  tags: string[];
}

/** 印度占星结果 */
export interface VedicResult {
  planets: PlanetPosition[];
  lagna: string;
  moonNakshatra: string;
  moonPada: number;
  moonRashi: string;
  sunRashi: string;
  dashas: { planet: string; startAge: number; endAge: number }[];
  currentDasha: { maha: string; antar: string };
  yogas: string[];
  ashtakavargaTotal: number;
  gochara: { saturn: string; jupiter: string; rahu: string; ketu: string };
  tags: string[];
}

/** 阿拉伯部分 */
export interface ArabicPart {
  name: string;
  formula: string;
  longitude: number;
  sign: string;
  house: number;
}

/** 阿拉伯占星结果 */
export interface ArabicResult {
  parts: ArabicPart[];
  northNode: { longitude: number; sign: string; house: number };
  southNode: { longitude: number; sign: string; house: number };
  dayRuler: string;
  hourRuler: string;
  planets: PlanetPosition[];
  tags: string[];
}

/** 紫微斗数结果 */
export interface ZiweiResult {
  fiveElementsClass: string;
  soulPalaceStar: string;
  soulPalaceBranch: string;
  bodyPalaceStar: string;
  bodyPalaceBranch: string;
  chineseDate: string;
  daxian: { startAge: number; endAge?: number; earthlyBranch: string }[];
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
  western?: WesternResult;
  vedic?: VedicResult;
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
