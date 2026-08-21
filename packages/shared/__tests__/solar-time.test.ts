import { describe, it, expect } from "vitest";
import { calculateSolarTime } from "../src/solar-time/index.js";

describe("calculateSolarTime", () => {
  it("北京116.41°E 14:30 应产生约14分钟经度时差", () => {
    const result = calculateSolarTime({
      date: "1995-06-15",
      time: "14:30",
      lng: 116.41,
      lat: 39.90,
      locationName: "北京",
    });
    // (116.41-120)*4 = -14.36
    expect(result.longitudeDiffMinutes).toBeCloseTo(-14.36, 0);
    expect(result.solarTime).toContain("14:");
    expect(result.timezone).toBe("UTC+8");
  });

  it("经度120°E应产生0经度时差", () => {
    const result = calculateSolarTime({
      date: "2026-01-01",
      time: "12:00",
      lng: 120,
      lat: 30,
      locationName: "test",
    });
    expect(result.longitudeDiffMinutes).toBeCloseTo(0, 1);
  });

  it("均时差应在-16到+16分钟之间", () => {
    const result = calculateSolarTime({
      date: "2026-06-15",
      time: "12:00",
      lng: 116.41,
      lat: 39.90,
      locationName: "北京",
    });
    expect(Math.abs(result.equationOfTimeMinutes)).toBeLessThanOrEqual(16);
  });

  it("应正确计算真太阳时格式", () => {
    const result = calculateSolarTime({
      date: "2026-03-21",
      time: "10:00",
      lng: 121.47,
      lat: 31.23,
      locationName: "上海",
    });
    expect(result.solarTime).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
    expect(result.inputTime).toBe("2026-03-21 10:00");
  });
});
