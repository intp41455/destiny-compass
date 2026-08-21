// lunar-javascript 是 CommonJS 模块，需要 default import
import lunar from "lunar-javascript";
import type { BaziResult } from "@destiny/shared";

const { Solar } = lunar;

/** 天干顺序：甲乙丙丁戊己庚辛壬癸 */
const TIAN_GAN = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"];

/** 地支顺序：子丑寅卯辰巳午未申酉戌亥 */
const DI_ZHI = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];

/** 地支主气五行索引：0木 1火 2土 3金 4水 */
const ZHI_MAIN_ELEMENT = [4, 2, 0, 0, 2, 1, 1, 2, 3, 3, 2, 4];

/**
 * 判断身强身弱（基于月令主气与日主关系，简化版）
 * 返回 "身强" | "身弱"
 */
function getStrength(dayMaster: string, monthZhi: string): "身强" | "身弱" {
  const dmIdx = TIAN_GAN.indexOf(dayMaster);
  const zhiIdx = DI_ZHI.indexOf(monthZhi);
  if (dmIdx === -1 || zhiIdx === -1) return "身弱";

  const dmElement = Math.floor(dmIdx / 2); // 0木 1火 2土 3金 4水
  const monthElement = ZHI_MAIN_ELEMENT[zhiIdx];

  // 月令与日主同类（比劫）或生日主（印）为身强倾向
  if (monthElement === dmElement) return "身强";
  if ((monthElement + 1) % 5 === dmElement) return "身强"; // 印（生我者）
  return "身弱";
}

/**
 * 八字排盘核心函数
 * @param date 公历日期 YYYY-MM-DD
 * @param time 出生时间 HH:MM（已校准为真太阳时）
 * @param gender male | female
 * @param lng 经度（仅用于元信息，排盘已由调用方校准时传入）
 * @param _lat 纬度（保留参数位）
 */
export function calculateBazi(
  date: string,
  time: string,
  gender: "male" | "female",
  _lng: number,
  _lat: number,
): BaziResult {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);

  const solar = Solar.fromYmdHms(year, month, day, hour, minute, 0);
  const lunarObj = solar.getLunar();
  const ec = lunarObj.getEightChar();

  // 四柱（字符串如 "乙亥"）
  const yearPillar = ec.getYear();
  const monthPillar = ec.getMonth();
  const dayPillar = ec.getDay();
  const hourPillar = ec.getTime();

  const dayMaster = ec.getDayGan(); // 日主天干
  const monthZhi = ec.getMonthZhi();

  // 十神：直接使用 lunar-javascript 内置
  const tenGods: Record<string, string> = {
    year: ec.getYearShiShenGan(),
    month: ec.getMonthShiShenGan(),
    day: "日主",
    hour: ec.getTimeShiShenGan(),
  };

  // 藏干：内置返回数组（如 ['己', '癸', '辛']）
  const hiddenStems: Record<string, string[]> = {
    year: ec.getYearHideGan() ?? [],
    month: ec.getMonthHideGan() ?? [],
    day: ec.getDayHideGan() ?? [],
    hour: ec.getTimeHideGan() ?? [],
  };

  // 纳音
  const nayin = ec.getDayNaYin();

  // 大运：getDaYun() 返回 10 项，第一项为童限（ganZhi 为空），过滤掉空项
  const yun = ec.getYun(gender === "male" ? 1 : 0);
  const rawDayun = yun.getDaYun();
  const dayun = rawDayun
    .filter((dy) => {
      const gz = dy.getGanZhi();
      return gz && gz.length > 0;
    })
    .map((dy) => ({
      startAge: dy.getStartAge(),
      endAge: dy.getEndAge(),
      stems: [dy.getGanZhi()],
    }));

  // 神煞：合并吉神与凶煞
  const shensha: string[] = [
    ...(lunarObj.getDayJiShen() ?? []),
    ...(lunarObj.getDayXiongSha() ?? []),
  ];

  // 特征标签
  const tags: string[] = [
    `${dayMaster}日主`,
    `${yearPillar[0]}${yearPillar[1]}年`,
    `${monthPillar[0]}${monthPillar[1]}月`,
    getStrength(dayMaster, monthZhi),
  ];

  return {
    pillars: {
      year: yearPillar,
      month: monthPillar,
      day: dayPillar,
      hour: hourPillar,
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
