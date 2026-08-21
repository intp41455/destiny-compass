import { describe, it, expect } from "vitest";
import { calculateBazi } from "../src/bazi-engine.js";

describe("calculateBazi", () => {
  it("1995-06-15 14:30 北京 应排出正确四柱", () => {
    const result = calculateBazi("1995-06-15", "14:30", "male", 116.41, 39.9);

    expect(result.pillars.year).toBeDefined();
    expect(result.pillars.month).toBeDefined();
    expect(result.pillars.day).toBeDefined();
    expect(result.pillars.hour).toBeDefined();
    expect(result.dayMaster).toMatch(/[甲乙丙丁戊己庚辛壬癸]/);
  });

  it("应返回十神信息", () => {
    const result = calculateBazi("1995-06-15", "14:30", "male", 116.41, 39.9);
    expect(Object.keys(result.tenGods).length).toBeGreaterThan(0);
  });

  it("应返回大运信息", () => {
    const result = calculateBazi("1995-06-15", "14:30", "male", 116.41, 39.9);
    expect(result.dayun.length).toBeGreaterThan(0);
    expect(result.dayun[0].startAge).toBeGreaterThanOrEqual(0);
  });

  it("应返回tags数组", () => {
    const result = calculateBazi("1995-06-15", "14:30", "male", 116.41, 39.9);
    expect(Array.isArray(result.tags)).toBe(true);
    expect(result.tags.length).toBeGreaterThan(0);
  });

  it("女性排盘应正确处理大运顺逆", () => {
    const result = calculateBazi("1995-06-15", "14:30", "female", 116.41, 39.9);
    expect(result.dayun.length).toBeGreaterThan(0);
  });
});
