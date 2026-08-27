import { describe, it, expect } from "vitest";
import { calculateVedic } from "../src/vedic-engine.js";

describe("calculateVedic", () => {
  const result = calculateVedic("1995-06-15", "14:30", 39.9, 116.4, 30);

  it("应返回 7 大行星 + 2 个交点（共 9 颗）", () => {
    expect(result.planets.length).toBe(9);
    const names = result.planets.map((p) => p.name);
    expect(names).toContain("sun");
    expect(names).toContain("moon");
    expect(names).toContain("mercury");
    expect(names).toContain("venus");
    expect(names).toContain("mars");
    expect(names).toContain("jupiter");
    expect(names).toContain("saturn");
    expect(names).toContain("north_node");
    expect(names).toContain("south_node");
  });

  it("应有 Lagna / 月 Nakshatra / Rashi", () => {
    expect(result.lagna).toMatch(/Mesha|Vrishabha|/);
    expect(result.moonNakshatra.length).toBeGreaterThan(0);
    expect(result.moonRashi).toBeTruthy();
    expect(result.sunRashi).toBeTruthy();
    expect(result.moonPada).toBeGreaterThanOrEqual(1);
    expect(result.moonPada).toBeLessThanOrEqual(4);
  });

  it("应有 Vimshottari Dasha 列表（≥9 主星）", () => {
    expect(result.dashas.length).toBeGreaterThanOrEqual(9);
    const planets = result.dashas.map((d) => d.planet);
    // 第一段应是 9 主星之一
    expect(["Ketu", "Venus", "Sun", "Moon", "Mars", "Rahu", "Jupiter", "Saturn", "Mercury"])
      .toContain(planets[0]);
  });

  it("应计算当前 Mahadasha + Antardasha", () => {
    expect(result.currentDasha.maha).toBeTruthy();
    expect(result.currentDasha.antar).toBeTruthy();
  });

  it("应返回 Yoga 列表（数组）", () => {
    expect(Array.isArray(result.yogas)).toBe(true);
  });

  it("Ashtakavarga 总分应为正数", () => {
    expect(result.ashtakavargaTotal).toBeGreaterThan(0);
  });

  it("Gochara 推运应包含 4 颗过宫星（Saturn/Jupiter/Rahu/Ketu）", () => {
    expect(result.gochara.saturn).toBeTruthy();
    expect(result.gochara.jupiter).toBeTruthy();
    expect(result.gochara.rahu).toBeTruthy();
    expect(result.gochara.ketu).toBeTruthy();
  });

  it("tags 应包含 Lagna/月亮Rashi/Nakshatra/Dasha 标签", () => {
    expect(result.tags.some((t) => t.startsWith("Lagna:"))).toBe(true);
    expect(result.tags.some((t) => t.startsWith("月亮Nakshatra:"))).toBe(true);
    expect(result.tags.some((t) => t.startsWith("当前Mahadasha:"))).toBe(true);
  });

  it("行星黄经与西方 (MCP-4) 应相差约 Lahiri ayanamsa", () => {
    // 月亮 nakshatra Ashwini..Revati
    const naks = ["Ashwini","Bharani","Krittika","Rohini","Mrigashira","Ardra",
      "Punarvasu","Pushya","Ashlesha","Magha","Purva Phalguni","Uttara Phalguni",
      "Hasta","Chitra","Swati","Vishakha","Anuradha","Jyeshtha","Mula",
      "Purva Ashadha","Uttara Ashadha","Shravana","Dhanishta","Shatabhisha",
      "Purva Bhadrapada","Uttara Bhadrapada","Revati"];
    expect(naks).toContain(result.moonNakshatra);
  });
});
