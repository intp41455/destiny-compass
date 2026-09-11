import type { ZiweiResult } from "./types.js";

const DI_ZHI = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];
const TIAN_GAN = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"];
const MAIN_STARS = ["紫微", "天机", "太阳", "武曲", "天同", "廉贞", "天府", "太阴", "贪狼", "巨门", "天相", "天梁", "七杀", "破军"];
const FIVE_ELEMENTS_MAP: Record<string, string> = {
  "甲子": "水二局", "乙丑": "金四局", "丙寅": "火六局", "丁卯": "木三局", "戊辰": "木三局",
  "己巳": "木三局", "庚午": "土五局", "辛未": "土五局", "壬申": "金四局", "癸酉": "金四局",
  "甲戌": "火六局", "乙亥": "火六局",
};

function sexagenaryYear(year: number): string {
  const gan = TIAN_GAN[((year - 4) % 10 + 10) % 10];
  const zhi = DI_ZHI[((year - 4) % 12 + 12) % 12];
  return gan + zhi;
}

function lunarYearStem(year: number): string {
  return TIAN_GAN[((year - 4) % 10 + 10) % 10];
}

export function calculateZiwei(birthDate: string, _birthTime: string, _gender: "male" | "female"): ZiweiResult {
  const [year, month, day] = birthDate.split("-").map(Number);
  const yearGZ = sexagenaryYear(year);
  const fiveElementsClass = FIVE_ELEMENTS_MAP[yearGZ] ?? "水二局";

  const soulIndex = ((month - 1 + day) % 12 + 12) % 12;
  const soulPalaceBranch = DI_ZHI[soulIndex];

  const bodyIndex = (soulIndex + 6) % 12;
  const bodyPalaceBranch = DI_ZHI[bodyIndex];

  const soulStarIdx = soulIndex % MAIN_STARS.length;
  const bodyStarIdx = bodyIndex % MAIN_STARS.length;

  const startAge = Number(fiveElementsClass.replace(/[^0-9]/g, "")) || 2;
  const daxian = Array.from({ length: 12 }, (_, i) => ({
    startAge: startAge + i * 10,
    endAge: startAge + i * 10 + 9,
    earthlyBranch: DI_ZHI[(soulIndex + i) % 12],
  }));

  const tags: string[] = [
    `${lunarYearStem(year)}年生`,
    fiveElementsClass,
    `命宫${soulPalaceBranch}`,
  ];

  return {
    fiveElementsClass,
    soulPalaceStar: MAIN_STARS[soulStarIdx],
    soulPalaceBranch,
    bodyPalaceStar: MAIN_STARS[bodyStarIdx],
    bodyPalaceBranch,
    chineseDate: `${yearGZ}年 ${month}月 ${day}日`,
    daxian,
    tags,
  };
}
