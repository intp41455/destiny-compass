import { describe, it, expect } from "vitest";
import * as A from "astronomy-engine";
import {
  toAstroTime,
  obliquity,
  localSiderealTime,
  midheaven,
  ascendant,
  calculateHouses,
  calculatePlanetPositions,
  meanNorthNode,
  meanSouthNode,
  lahiriAyanamsa,
  toVedicPosition,
  houseOf,
  nakshatraOf,
} from "../src/astronomy/index.js";

describe("astronomy helpers", () => {
  // 1995-06-15 14:30 北京 (lng=116.4, lat=39.9) -> UTC ≈ 06:30
  const time = toAstroTime("1995-06-15", "14:30", 116.4);

  it("toAstroTime 转换为正确 UTC", () => {
    const utc = time.date.getTime();
    const expected = Date.UTC(1995, 5, 15, 6, 30, 0);
    expect(Math.abs(utc - expected)).toBeLessThan(1000);
  });

  it("obliquity 应在 23.4 附近", () => {
    const eps = obliquity(time);
    expect(eps).toBeGreaterThan(23.4);
    expect(eps).toBeLessThan(23.5);
  });

  it("localSiderealTime 应在 [0,360)", () => {
    const lst = localSiderealTime(time, 116.4);
    expect(lst).toBeGreaterThanOrEqual(0);
    expect(lst).toBeLessThan(360);
  });

  it("midheaven 应在 [0,360)", () => {
    const mc = midheaven(time, 116.4);
    expect(mc).toBeGreaterThanOrEqual(0);
    expect(mc).toBeLessThan(360);
  });

  it("ascendant 应在合理范围", () => {
    const asc = ascendant(time, 39.9, 116.4);
    expect(asc).toBeGreaterThanOrEqual(0);
    expect(asc).toBeLessThan(360);
  });

  it("calculateHouses Equal 应返回 12 个 cusps", () => {
    const houses = calculateHouses(time, 39.9, 116.4, "Equal");
    expect(houses.cusps.length).toBe(12);
    expect(houses.system).toBe("Equal");
    expect(houses.ascendant).toBeGreaterThanOrEqual(0);
    expect(houses.midheaven).toBeGreaterThanOrEqual(0);
  });

  it("WholeSign 第 1 宫起点应为 ASC 所在星座 0°", () => {
    const houses = calculateHouses(time, 39.9, 116.4, "WholeSign");
    const ascSign = Math.floor(houses.ascendant / 30);
    expect(houses.cusps[0]).toBeCloseTo(ascSign * 30, 1);
  });

  it("calculatePlanetPositions 应返回 7 颗行星", () => {
    const houses = calculateHouses(time, 39.9, 116.4, "Equal");
    const positions = calculatePlanetPositions(time, houses, "western");
    expect(positions.length).toBe(7);
    for (const p of positions) {
      expect(p.longitude).toBeGreaterThanOrEqual(0);
      expect(p.longitude).toBeLessThan(360);
      expect(p.signIndex).toBeGreaterThanOrEqual(0);
      expect(p.signIndex).toBeLessThan(12);
      expect(p.house).toBeGreaterThanOrEqual(1);
      expect(p.house).toBeLessThanOrEqual(12);
    }
    // 太阳应在 Gemini (signIndex=2)，1995-06-15
    const sun = positions.find((p) => p.name === "sun")!;
    expect(sun.signIndex).toBe(2);
    expect(sun.signName).toBe("Gemini");
  });

  it("太阳在 Gemini / 月亮在 Cap（与 probe 一致）", () => {
    const houses = calculateHouses(time, 39.9, 116.4, "Equal");
    const positions = calculatePlanetPositions(time, houses, "western");
    const sun = positions.find((p) => p.name === "sun")!;
    const moon = positions.find((p) => p.name === "moon")!;
    expect(sun.signName).toBe("Gemini");
    expect(moon.signName).toBe("Capricorn");
  });

  it("meanNorthNode + meanSouthNode 应相差 180°", () => {
    const nn = meanNorthNode(time);
    const sn = meanSouthNode(time);
    const diff = Math.abs((nn + 180) % 360 - sn);
    expect(diff).toBeLessThan(0.01);
  });

  it("lahiriAyanamsa 在 J2000 附近约 23.85°", () => {
    const j2000 = new A.AstroTime(new Date(Date.UTC(2000, 0, 1, 12, 0, 0)));
    const aya = lahiriAyanamsa(j2000);
    expect(aya).toBeGreaterThan(23.8);
    expect(aya).toBeLessThan(23.9);
  });

  it("toVedicPosition 应减去 ayanamsa", () => {
    const houses = calculateHouses(time, 39.9, 116.4, "WholeSign");
    const positions = calculatePlanetPositions(time, houses, "western");
    const aya = lahiriAyanamsa(time);
    const vedic = toVedicPosition(positions[0], aya, houses);
    expect(vedic.longitude).toBeCloseTo((positions[0].longitude - aya + 360) % 360, 1);
  });

  it("houseOf 应正确返回 1-12", () => {
    const houses = calculateHouses(time, 39.9, 116.4, "Equal");
    const asc = houses.ascendant;
    // ASC 上 5° 应在第 1 宫
    expect(houseOf((asc + 5) % 360, houses)).toBe(1);
    // 下一宫起点应返回 2
    expect(houseOf((asc + 35) % 360, houses)).toBe(2);
  });

  it("nakshatraOf 应在 Ashwini..Revati 中", () => {
    const r = nakshatraOf(0);
    expect(r.name).toBe("Ashwini");
    expect(r.pada).toBe(1);
    // 13.333° 已进入第 2 宿 Bharani，pada 1
    const r2 = nakshatraOf(13.333 + 0.5);
    expect(r2.name).toBe("Bharani");
    expect(r2.pada).toBe(1);
    // 第 1 宿 Ashwini 第 2 pada
    const r4 = nakshatraOf(3.33 + 0.1);
    expect(r4.name).toBe("Ashwini");
    expect(r4.pada).toBe(2);
    // 358° 应在 Revati
    const r3 = nakshatraOf(358);
    expect(r3.name).toBe("Revati");
  });
});
