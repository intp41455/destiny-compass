import { describe, it, expect } from "vitest";
import { geocode, CITY_DATABASE } from "../src/geo-coding/index.js";

describe("geocode", () => {
  it("应返回北京的经纬度", () => {
    const result = geocode("北京");
    expect(result).not.toBeNull();
    expect(result!.lat).toBeCloseTo(39.90, 1);
    expect(result!.lng).toBeCloseTo(116.41, 1);
  });

  it("应支持省市格式 '北京市'", () => {
    const result = geocode("北京市");
    expect(result).not.toBeNull();
    expect(result!.lng).toBeCloseTo(116.41, 1);
  });

  it("应支持上海", () => {
    const result = geocode("上海");
    expect(result).not.toBeNull();
    expect(result!.lat).toBeCloseTo(31.23, 1);
  });

  it("未知城市应返回null", () => {
    const result = geocode("火星城");
    expect(result).toBeNull();
  });

  it("CITY_DATABASE应包含至少50个城市", () => {
    expect(Object.keys(CITY_DATABASE).length).toBeGreaterThanOrEqual(50);
  });

  it("应支持包含匹配（北京市东城区）", () => {
    const result = geocode("北京市东城区");
    expect(result).not.toBeNull();
    expect(result!.cityName).toBe("北京");
  });
});
