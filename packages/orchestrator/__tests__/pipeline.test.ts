import { describe, it, expect } from "vitest";
import {
  buildLifeAnalysisPrompt,
  buildYearlyFortunePrompt,
  buildMonthlyFortunePrompt,
  buildDailyFortunePrompt,
} from "../src/pipeline/prompts.js";
import { eventBus } from "../src/event-bus.js";
import type { ChartsResult } from "@destiny/shared";

const mockCharts: ChartsResult = {
  meta: {
    birthday: "1995-06-15",
    solarTimeCorrected: "1995-06-15 14:15",
    trueSolarOffsetMin: -14.56,
    gender: "male",
    lat: 39.9,
    lng: 116.4,
    timezone: "UTC+8",
    locationName: "北京",
  },
  bazi: {
    pillars: { year: "乙亥", month: "壬午", day: "丁丑", hour: "丁未" },
    dayMaster: "丁",
    tenGods: { year: "偏印", month: "正官", day: "日主", hour: "比肩" },
    hiddenStems: {
      year: ["壬", "甲"],
      month: ["丁", "己"],
      day: ["己", "癸", "辛"],
      hour: ["己", "丁", "乙"],
    },
    nayin: "涧下水",
    dayun: [
      { startAge: 4, endAge: 13, stems: ["辛巳"] },
      { startAge: 14, endAge: 23, stems: ["庚辰"] },
    ],
    shensha: ["阴德", "圣心", "宝光", "月煞"],
    tags: ["丁日主", "乙亥年", "壬午月", "身强"],
  },
  unifiedTags: ["丁日主", "乙亥年", "壬午月", "身强"],
};

describe("buildLifeAnalysisPrompt", () => {
  it("应包含完整命主信息与排盘数据", () => {
    const prompt = buildLifeAnalysisPrompt(mockCharts);
    expect(prompt).toContain("1995-06-15");
    expect(prompt).toContain("北京");
    expect(prompt).toContain("丁");
    expect(prompt).toContain("乙亥");
    expect(prompt).toContain("涧下水");
    expect(prompt).toContain("阴德");
    expect(prompt).toContain("丁日主");
  });

  it("应包含 JSON 输出格式约束", () => {
    const prompt = buildLifeAnalysisPrompt(mockCharts);
    expect(prompt).toContain("personality");
    expect(prompt).toContain("career");
    expect(prompt).toContain("relationship");
    expect(prompt).toContain("luckyElements");
    expect(prompt).toContain("仅输出 JSON");
  });
});

describe("buildYearlyFortunePrompt", () => {
  it("应包含年份与命主年龄", () => {
    const prompt = buildYearlyFortunePrompt(mockCharts, 2026);
    expect(prompt).toContain("2026 年");
    expect(prompt).toContain("31 岁"); // 2026 - 1995
  });

  it("应包含当前大运定位", () => {
    const prompt = buildYearlyFortunePrompt(mockCharts, 2026);
    expect(prompt).toMatch(/当前大运.*庚辰|暂未在大运/);
  });

  it("应包含事件级 JSON 约束", () => {
    const prompt = buildYearlyFortunePrompt(mockCharts, 2026);
    expect(prompt).toContain("events");
    expect(prompt).toContain("probability");
    expect(prompt).toContain("people");
    expect(prompt).toContain("risks");
    expect(prompt).toContain("opportunities");
  });
});

describe("buildMonthlyFortunePrompt", () => {
  it("应包含年月", () => {
    const prompt = buildMonthlyFortunePrompt(mockCharts, 2026, 8);
    expect(prompt).toContain("2026 年 8 月");
  });

  it("应包含事件级 JSON 约束", () => {
    const prompt = buildMonthlyFortunePrompt(mockCharts, 2026, 8);
    expect(prompt).toContain("events");
    expect(prompt).toContain("probability");
    expect(prompt).toContain("至少 4 个");
  });
});

describe("buildDailyFortunePrompt", () => {
  it("应包含目标日期", () => {
    const prompt = buildDailyFortunePrompt(mockCharts, new Date("2026-08-21"), 0);
    expect(prompt).toContain("2026-08-21");
  });

  it("daysAhead 应正确偏移日期", () => {
    const prompt = buildDailyFortunePrompt(mockCharts, new Date("2026-08-21"), 3);
    expect(prompt).toContain("2026-08-24");
  });

  it("应包含当日事件 JSON 约束", () => {
    const prompt = buildDailyFortunePrompt(mockCharts, new Date("2026-08-21"), 0);
    expect(prompt).toContain("events");
    expect(prompt).toContain("当日可能接触的人物");
    expect(prompt).toContain("至少 3 个");
  });
});

describe("EventBus", () => {
  it("应回放历史事件给晚到的订阅者", () => {
    const id = `test-${Date.now()}-${Math.random()}`;
    eventBus.publish(id, { type: "progress", step: "S1", message: "m1" });
    eventBus.publish(id, { type: "progress", step: "S2", message: "m2" });

    const received: any[] = [];
    eventBus.subscribe(id, (e) => received.push(e));

    expect(received).toHaveLength(2);
    expect(received[0].step).toBe("S1");
    expect(received[1].step).toBe("S2");
  });

  it("应实时推送新事件给已订阅者", () => {
    const id = `test-${Date.now()}-${Math.random()}`;
    const received: any[] = [];
    eventBus.subscribe(id, (e) => received.push(e));

    eventBus.publish(id, { type: "progress", step: "S1", message: "realtime" });

    expect(received).toHaveLength(1);
    expect(received[0].message).toBe("realtime");
  });

  it("done 事件后应标记为终止", () => {
    const id = `test-${Date.now()}-${Math.random()}`;
    eventBus.publish(id, { type: "done", analysisId: id, tokens: 0 });
    expect(eventBus.isTerminated(id)).toBe(true);
  });

  it("error 事件后应标记为终止", () => {
    const id = `test-${Date.now()}-${Math.random()}`;
    eventBus.publish(id, { type: "error", step: "S1", message: "fail" });
    expect(eventBus.isTerminated(id)).toBe(true);
  });

  it("取消订阅后不再接收事件", () => {
    const id = `test-${Date.now()}-${Math.random()}`;
    const received: any[] = [];
    const unsubscribe = eventBus.subscribe(id, (e) => received.push(e));

    unsubscribe();
    eventBus.publish(id, { type: "progress", step: "S1", message: "after-unsub" });

    expect(received).toHaveLength(0);
  });
});
