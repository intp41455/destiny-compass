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
  dayun: { startAge: number; stems: string[] }[];
  shensha: string[];
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
  // 以下术数在后续Phase接入
  ziwei?: unknown;
  vedic?: unknown;
  western?: unknown;
  arabic?: unknown;
  unifiedTags: string[];
}

/** SSE 事件类型 */
export type SSEEvent =
  | { type: "progress"; step: string; message: string }
  | { type: "charts"; data: ChartsResult }
  | { type: "analysis"; section: string; content: string }
  | { type: "done"; analysisId: string; tokens: number }
  | { type: "error"; step: string; message: string };
