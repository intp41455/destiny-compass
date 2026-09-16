import { describe, it, expect } from "vitest";
import { calculateZiwei } from "../src/ziwei-engine.js";

describe("calculateZiwei", () => {
  it("1995-06-15 14:00 男 应排出 12 宫", () => {
    const result = calculateZiwei("1995-06-15", "14:00", "male");
    expect(result.palaces.length).toBe(12);
    expect(result.solarDate).toBe("1995-06-15");
  });

  it("命宫主星应非空", () => {
    const result = calculateZiwei("1995-06-15", "14:00", "male");
    expect(result.soulPalaceStar).toBeTruthy();
  });

  it("应有五行局信息", () => {
    const result = calculateZiwei("1995-06-15", "14:00", "male");
    expect(result.fiveElementsClass).toMatch(/局$/);
  });

  it("应生成八字四柱与农历日期", () => {
    const result = calculateZiwei("1995-06-15", "14:00", "male");
    expect(result.chineseDate).toMatch(/[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]/);
    expect(result.lunarDate.length).toBeGreaterThan(0);
  });

  it("应包含至少一个大限", () => {
    const result = calculateZiwei("1995-06-15", "14:00", "male");
    expect(result.daxian.length).toBeGreaterThan(0);
  });

  it("tags 应包含命宫主星标签", () => {
    const result = calculateZiwei("1995-06-15", "14:00", "male");
    expect(result.tags.length).toBeGreaterThan(0);
    expect(result.tags.some((t) => t.startsWith("命宫:"))).toBe(true);
  });

  it("应识别时辰范围（未时 13:00-15:00）", () => {
    const result = calculateZiwei("1995-06-15", "14:00", "male");
    expect(result.time).toBe("未时");
    expect(result.timeRange).toMatch(/13:00.*15:00/);
  });

  it("女性排盘应正常返回", () => {
    const result = calculateZiwei("1995-06-15", "14:00", "female");
    expect(result.palaces.length).toBe(12);
  });
});
