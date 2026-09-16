import { describe, it, expect } from "vitest";
import { calculateWestern } from "../src/western-engine.js";

describe("calculateWestern", () => {
  const result = calculateWestern("1995-06-15", "14:30", "male", 39.9, 116.4, 30);

  it("应返回 7 大行星 + 1 北交点", () => {
    expect(result.planets.length).toBe(8);
    const names = result.planets.map((p) => p.name);
    expect(names).toContain("sun");
    expect(names).toContain("moon");
    expect(names).toContain("mercury");
    expect(names).toContain("venus");
    expect(names).toContain("mars");
    expect(names).toContain("jupiter");
    expect(names).toContain("saturn");
    expect(names).toContain("north_node");
  });

  it("太阳应在双子座（Gemini）", () => {
    const sun = result.planets.find((p) => p.name === "sun")!;
    expect(sun.signName).toBe("Gemini");
  });

  it("应包含宫位 cusps 与 ASC/MC", () => {
    expect(result.houses.cusps.length).toBe(12);
    expect(result.houses.ascendant).toBeGreaterThanOrEqual(0);
    expect(result.houses.midheaven).toBeGreaterThanOrEqual(0);
    expect(result.houses.descendant).toBeCloseTo((result.houses.ascendant + 180) % 360, 1);
    expect(result.houses.immumCoeli).toBeCloseTo((result.houses.midheaven + 180) % 360, 1);
  });

  it("每个行星宫位应在 1-12 之间", () => {
    for (const p of result.planets) {
      expect(p.house).toBeGreaterThanOrEqual(1);
      expect(p.house).toBeLessThanOrEqual(12);
    }
  });

  it("应计算相位（至少几条）", () => {
    expect(result.aspects.length).toBeGreaterThan(0);
    const types = result.aspects.map((a) => a.type);
    // 至少有一种主相位
    expect(types.some((t) => ["conjunction", "trine", "square", "opposition", "sextile"].includes(t))).toBe(true);
  });

  it("dignities 应覆盖所有 7 大行星", () => {
    const keys = Object.keys(result.dignities);
    expect(keys).toContain("sun");
    expect(keys).toContain("moon");
    expect(keys).toContain("saturn");
  });

  it("Firdaria 应有当前主星", () => {
    expect(result.firdaria.ruler).toBeTruthy();
    expect(result.firdaria.period).toMatch(/日生|夜生/);
  });

  it("Profection 当前年宫位应在 1-12", () => {
    expect(result.profection.house).toBeGreaterThanOrEqual(1);
    expect(result.profection.house).toBeLessThanOrEqual(12);
    expect(result.profection.sign).toBeTruthy();
  });

  it("tags 应包含太阳/月亮/上升/日夜标签", () => {
    expect(result.tags.some((t) => t.startsWith("太阳:"))).toBe(true);
    expect(result.tags.some((t) => t.startsWith("月亮:"))).toBe(true);
    expect(result.tags.some((t) => t.startsWith("上升:"))).toBe(true);
    expect(result.tags.some((t) => t === "日生" || t === "夜生")).toBe(true);
  });

  it("女性排盘应正常返回", () => {
    const f = calculateWestern("1995-06-15", "14:30", "female", 39.9, 116.4, 30);
    expect(f.planets.length).toBe(8);
  });
});
