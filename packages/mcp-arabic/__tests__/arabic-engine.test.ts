import { describe, it, expect } from "vitest";
import { calculateArabic } from "../src/arabic-engine.js";

describe("calculateArabic", () => {
  const result = calculateArabic("1995-06-15", "14:30", 39.9, 116.4);

  it("应返回至少 10 个 Parts", () => {
    expect(result.parts.length).toBeGreaterThanOrEqual(10);
    const names = result.parts.map((p) => p.name);
    expect(names).toContain("Part of Fortune");
    expect(names).toContain("Part of Spirit");
  });

  it("每个 Part 应有黄经 + 星座 + 宫位", () => {
    for (const p of result.parts) {
      expect(p.longitude).toBeGreaterThanOrEqual(0);
      expect(p.longitude).toBeLessThan(360);
      expect(p.sign).toBeTruthy();
      expect(p.house).toBeGreaterThanOrEqual(1);
      expect(p.house).toBeLessThanOrEqual(12);
      expect(p.formula).toContain("ASC");
    }
  });

  it("应有南北交点", () => {
    expect(result.northNode.longitude).toBeGreaterThanOrEqual(0);
    expect(result.northNode.sign).toBeTruthy();
    expect(result.southNode.longitude).toBeGreaterThanOrEqual(0);
    expect(result.southNode.sign).toBeTruthy();
    // 南北交点相差 180°
    const diff = Math.abs((result.northNode.longitude + 180) % 360 - result.southNode.longitude);
    expect(diff).toBeLessThan(1);
  });

  it("应有日主星与时主星", () => {
    expect(result.dayRuler).toBeTruthy();
    expect(result.hourRuler).toBeTruthy();
    const valid = ["sun", "moon", "mars", "mercury", "jupiter", "venus", "saturn"];
    expect(valid).toContain(result.dayRuler);
    expect(valid).toContain(result.hourRuler);
  });

  it("应返回 7 大行星位置", () => {
    expect(result.planets.length).toBe(7);
  });

  it("tags 应包含日主星/时主星/福点标签", () => {
    expect(result.tags.some((t) => t.startsWith("日主星:"))).toBe(true);
    expect(result.tags.some((t) => t.startsWith("时主星:"))).toBe(true);
    expect(result.tags.some((t) => t.startsWith("福点:"))).toBe(true);
  });

  it("1995-06-15 是周四，日主星应为 Jupiter", () => {
    expect(result.dayRuler).toBe("jupiter");
  });
});
