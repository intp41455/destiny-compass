declare module "lunar-javascript" {
  /** 最小类型声明：lunar-javascript 的 API 通过 Object.keys 探查确认 */
  interface LunarBase {
    getYear(): string;
    getMonth(): string;
    getDay(): string;
    getTime(): string;
    getYearGan(): string;
    getMonthGan(): string;
    getDayGan(): string;
    getTimeGan(): string;
    getYearZhi(): string;
    getMonthZhi(): string;
    getDayZhi(): string;
    getTimeZhi(): string;
    getYearHideGan(): string[];
    getMonthHideGan(): string[];
    getDayHideGan(): string[];
    getTimeHideGan(): string[];
    getDayNaYin(): string;
    getYearShiShenGan(): string;
    getMonthShiShenGan(): string;
    getDayShiShenGan(): string;
    getTimeShiShenGan(): string;
    getYearShiShenZhi(): string;
    getMonthShiShenZhi(): string;
    getDayShiShenZhi(): string;
    getTimeShiShenZhi(): string;
    getYun(gender: 0 | 1): Yun;
    getDayJiShen(): string[];
    getDayXiongSha(): string[];
    getLunar(): LunarBase;
  }

  interface Yun {
    getStartYear(): number;
    getStartMonth(): number;
    getStartDay(): number;
    getStartAge(): number;
    isForward(): boolean;
    getDaYun(): DaYun[];
  }

  interface DaYun {
    getStartAge(): number;
    getEndAge(): number;
    getGanZhi(): string;
    getIndex(): number;
  }

  interface Solar {
    getLunar(): LunarBase;
    static fromYmdHms(
      year: number,
      month: number,
      day: number,
      hour: number,
      minute: number,
      second: number,
    ): Solar;
  }

  const lunar: {
    Solar: typeof Solar & { fromYmdHms: typeof Solar.fromYmdHms };
    Lunar: unknown;
    EightChar: unknown;
  };

  export = lunar;
}
