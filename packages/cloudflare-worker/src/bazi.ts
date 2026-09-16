import type { BaziResult } from "./types.js";

const TIAN_GAN = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"];
const DI_ZHI = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];
const ELEMENT = ["木", "火", "土", "金", "水"];
const ZHI_ELEMENT = [0, 2, 0, 0, 2, 1, 1, 2, 3, 3, 2, 4];

// 藏干表
const HIDDEN_STEMS: Record<string, string[]> = {
  子: ["癸"],
  丑: ["己", "癸", "辛"],
  寅: ["甲", "丙", "戊"],
  卯: ["乙"],
  辰: ["戊", "乙", "癸"],
  巳: ["丙", "庚", "戊"],
  午: ["丁", "己"],
  未: ["己", "丁", "乙"],
  申: ["庚", "壬", "戊"],
  酉: ["辛"],
  戌: ["戊", "辛", "丁"],
  亥: ["壬", "甲"],
};

// 纳音六十甲子（简化版，按序号）
const NAYIN_LIST = [
  "海中金", "炉中火", "大林木", "路旁土", "剑锋金", "山头火",
  "涧下水", "城头土", "白蜡金", "杨柳木", "泉中水", "屋上土",
  "霹雳火", "松柏木", "长流水", "砂中金", "山下火", "平地木",
  "壁上土", "金箔金", "覆灯火", "天河水", "大驿土", "钗钏金",
  "桑柘木", "大溪水", "砂中土", "天上火", "石榴木", "大海水",
  "海中金", "炉中火", "大林木", "路旁土", "剑锋金", "山头火",
  "涧下水", "城头土", "白蜡金", "杨柳木", "泉中水", "屋上土",
  "霹雳火", "松柏木", "长流水", "砂中金", "山下火", "平地木",
  "壁上土", "金箔金", "覆灯火", "天河水", "大驿土", "钗钏金",
  "桑柘木", "大溪水", "砂中土", "天上火", "石榴木", "大海水",
];

// 吉神表（日干对应）
const JI_SHEN: Record<string, string[]> = {
  甲: ["天乙贵人", "文昌", "学堂"],
  乙: ["天乙贵人", "文昌"],
  丙: ["天乙贵人", "文昌", "学堂", "驿马"],
  丁: ["天乙贵人", "文昌", "学堂"],
  戊: ["天乙贵人", "驿马", "学堂"],
  己: ["天乙贵人", "驿马"],
  庚: ["天乙贵人", "文昌", "学堂"],
  辛: ["天乙贵人", "文昌", "学堂"],
  壬: ["天乙贵人", "文昌", "学堂", "驿马"],
  癸: ["天乙贵人", "文昌"],
};

function ganIdx(gan: string): number {
  return TIAN_GAN.indexOf(gan);
}

function zhiIdx(zhi: string): number {
  return DI_ZHI.indexOf(zhi);
}

/**
 * 计算六十甲子干支
 * 公式：(年 - 4) % 60 → 天干用%10，地支用%12
 */
function sexagenaryYear(year: number): { gan: string; zhi: string } {
  const offset = (year - 4) % 60;
  const gan = TIAN_GAN[((offset % 10) + 10) % 10];
  const zhi = DI_ZHI[((offset % 12) + 12) % 12];
  return { gan, zhi };
}

/**
 * 计算日干支（基于已知参考点：2000-01-01 = 甲子日）
 */
function sexagenaryDay(year: number, month: number, day: number): { gan: string; zhi: string } {
  // 从 2000-01-01（甲子日，序号0）到目标日期的天数差
  const baseDate = new Date(2000, 0, 1);
  const targetDate = new Date(year, month - 1, day);
  const daysDiff = Math.floor((targetDate.getTime() - baseDate.getTime()) / (1000 * 60 * 60 * 24));
  const idx = ((daysDiff % 60) + 60) % 60;
  return {
    gan: TIAN_GAN[idx % 10],
    zhi: DI_ZHI[idx % 12],
  };
}

/**
 * 计算月干支
 * 月支固定：寅=1(正月)、卯=2...
 * 月干由年干决定：甲己年起丙寅，乙庚起戊寅，丙辛起庚寅，丁壬起壬寅，戊癸起甲寅
 */
function sexagenaryMonth(year: number, month: number): { gan: string; zhi: string } {
  const yearGanIdx = (year - 4) % 10;
  const monthZhiIdx = ((month + 10) % 12); // 正月=寅(1)

  const monthGanStart: Record<number, number> = {
    0: 2, 2: 4, 4: 6, 6: 8, 8: 0, // 甲己→丙, 乙庚→戊, 丙辛→庚, 丁壬→壬, 戊癸→甲
  };
  // 年干取个位
  const ganStartIdx = [2, 4, 6, 8, 0][yearGanIdx % 5];
  const monthsAfterTiger = ((month - 2) + 12) % 12;
  const monthGanIdx = (ganStartIdx + monthsAfterTiger) % 10;

  return {
    gan: TIAN_GAN[monthGanIdx],
    zhi: DI_ZHI[monthZhiIdx],
  };
}

/**
 * 计算时干支
 * 时支固定：子=0(23-1), 丑=1...
 * 时干由日干决定
 */
function sexagenaryHour(dayGan: string, hour: number): { gan: string; zhi: string } {
  const hourZhiIdx = Math.floor((hour + 1) / 2) % 12;
  const dayGanIdx = ganIdx(dayGan);
  // 甲己起丙子(2), 乙庚起戊子(4), 丙辛起庚子(6), 丁壬起壬子(8), 戊癸起甲子(0)
  const ganStartIdx = [2, 4, 6, 8, 0][dayGanIdx % 5];
  const hourGanIdx = (ganStartIdx + hourZhiIdx) % 10;

  return {
    gan: TIAN_GAN[hourGanIdx],
    zhi: DI_ZHI[hourZhiIdx],
  };
}

function getTenGod(dayMaster: string, stem: string): string {
  const dmIdx = ganIdx(dayMaster);
  const sIdx = ganIdx(stem);
  if (dmIdx === -1 || sIdx === -1 || dmIdx === sIdx) return "比肩";

  const dmEl = Math.floor(dmIdx / 2);
  const sEl = Math.floor(sIdx / 2);
  const sameYinYang = dmIdx % 2 === sIdx % 2;

  if (dmEl === sEl) return sameYinYang ? "比肩" : "劫财";
  if ((sEl + 1) % 5 === dmEl) return sameYinYang ? "偏印" : "正印";
  if ((dmEl + 1) % 5 === sEl) return sameYinYang ? "食神" : "伤官";
  if ((sEl + 2) % 5 === dmEl) return sameYinYang ? "七杀" : "正官";
  if ((dmEl + 2) % 5 === sEl) return sameYinYang ? "偏财" : "正财";
  return "未知";
}

function getStrength(dayMaster: string, monthZhi: string): "身强" | "身弱" {
  const dmIdx = ganIdx(dayMaster);
  const monthZhiIdx = zhiIdx(monthZhi);
  if (dmIdx === -1 || monthZhiIdx === -1) return "身弱";
  const dmEl = Math.floor(dmIdx / 2);
  const monthEl = ZHI_ELEMENT[monthZhiIdx];
  if (monthEl === dmEl) return "身强";
  if ((monthEl + 1) % 5 === dmEl) return "身强";
  return "身弱";
}

/**
 * 计算大运
 * 阳年男/阴年女顺行，阳年女/阴年女逆行
 * 起运年龄：取决于出生日与上一个/下一个节气的天数差
 */
function calcDayun(
  yearGanIdx: number,
  gender: "male" | "female",
  dayGanIdx: number,
): Array<{ startAge: number; endAge?: number; stems: string[] }> {
  const isYangYear = yearGanIdx % 2 === 0;
  const isForward = (isYangYear && gender === "male") || (!isYangYear && gender === "female");

  // 简化：起运年龄按 1-10 岁均匀分布，实际应计算节气差
  // 此处采用简化算法：第 N 步大运从 (N*10 + 起运年龄) 开始
  const qiyunAge = ((dayGanIdx + 1) % 10) + 1; // 简化起运年龄

  const result: Array<{ startAge: number; endAge?: number; stems: string[] }> = [];
  const baseZhi = zhiIdx(DI_ZHI[((yearGanIdx + 10) % 12)]); // 月支基准

  for (let i = 0; i < 8; i++) {
    const stepZhi = isForward
      ? (baseZhi + i + 1) % 12
      : (baseZhi - i - 1 + 12) % 12;
    const stepGan = isForward
      ? (dayGanIdx + i + 1) % 10
      : ((dayGanIdx - i - 1) % 10 + 10) % 10;

    const startAge = qiyunAge + i * 10;
    result.push({
      startAge,
      endAge: startAge + 9,
      stems: [TIAN_GAN[stepGan] + DI_ZHI[stepZhi]],
    });
  }
  return result;
}

export function calculateBazi(
  date: string,
  time: string,
  gender: "male" | "female",
  _lng: number,
  _lat: number,
): BaziResult {
  const [year, month, day] = date.split("-").map(Number);
  const [hour] = time.split(":").map(Number);

  const yearPZ = sexagenaryYear(year);
  const monthPZ = sexagenaryMonth(year, month);
  const dayPZ = sexagenaryDay(year, month, day);
  const hourPZ = sexagenaryHour(dayPZ.gan, hour);

  const dayMaster = dayPZ.gan;
  const monthZhi = monthPZ.zhi;

  const tenGods: Record<string, string> = {
    year: getTenGod(dayMaster, yearPZ.gan),
    month: getTenGod(dayMaster, monthPZ.gan),
    day: "日主",
    hour: getTenGod(dayMaster, hourPZ.gan),
  };

  const hiddenStems: Record<string, string[]> = {
    year: HIDDEN_STEMS[yearPZ.zhi] ?? [],
    month: HIDDEN_STEMS[monthPZ.zhi] ?? [],
    day: HIDDEN_STEMS[dayPZ.zhi] ?? [],
    hour: HIDDEN_STEMS[hourPZ.zhi] ?? [],
  };

  const yearIdx = ((year - 4) % 60 + 60) % 60;
  const nayin = NAYIN_LIST[yearIdx];

  const dayun = calcDayun(
    (year - 4) % 10,
    gender,
    ganIdx(dayMaster),
  );

  const shensha: string[] = [...(JI_SHEN[dayMaster] ?? [])];

  const tags: string[] = [
    `${dayMaster}日主`,
    `${yearPZ.gan}${yearPZ.zhi}年`,
    `${monthPZ.gan}${monthPZ.zhi}月`,
    getStrength(dayMaster, monthZhi),
  ];

  return {
    pillars: {
      year: yearPZ.gan + yearPZ.zhi,
      month: monthPZ.gan + monthPZ.zhi,
      day: dayPZ.gan + dayPZ.zhi,
      hour: hourPZ.gan + hourPZ.zhi,
    },
    dayMaster,
    tenGods,
    hiddenStems,
    nayin,
    dayun,
    shensha,
    tags,
  };
}
