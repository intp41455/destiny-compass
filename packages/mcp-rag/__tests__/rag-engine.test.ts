import { describe, it, expect, beforeEach } from "vitest";
import { ragStore } from "../src/rag-engine.js";
import type { KnowledgeEntry } from "../src/seed-knowledge.js";

describe("RagStore", () => {
  it("应加载种子知识库", () => {
    expect(ragStore.size()).toBeGreaterThan(10);
    const entries = ragStore.list();
    expect(entries.some((e) => e.system === "bazi")).toBe(true);
    expect(entries.some((e) => e.system === "ziwei")).toBe(true);
    expect(entries.some((e) => e.system === "vedic")).toBe(true);
    expect(entries.some((e) => e.system === "western")).toBe(true);
    expect(entries.some((e) => e.system === "arabic")).toBe(true);
  });

  it("应能按 tag 检索并返回 Top-K", () => {
    const hits = ragStore.query({ tags: ["杀破狼格", "七杀"], topK: 5 });
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].entry.tags.some((t) => t.includes("杀破狼"))).toBe(true);
    expect(hits[0].score).toBeGreaterThan(0);
    expect(hits[0].matchedTags.length).toBeGreaterThan(0);
  });

  it("应支持 system 过滤", () => {
    const hits = ragStore.query({ tags: ["Lagna", "mars"], system: "vedic", topK: 5 });
    expect(hits.length).toBeGreaterThan(0);
    for (const h of hits) {
      expect(h.entry.system).toBe("vedic");
    }
  });

  it("应按得分降序", () => {
    const hits = ragStore.query({ tags: ["命主星", "ASC", "Lagna"], topK: 10 });
    expect(hits.length).toBeGreaterThan(1);
    for (let i = 0; i < hits.length - 1; i++) {
      expect(hits[i].score).toBeGreaterThanOrEqual(hits[i + 1].score);
    }
  });

  it("无匹配时返回空数组", () => {
    const hits = ragStore.query({ tags: ["完全不存在的标签XYZ123"] });
    expect(hits.length).toBe(0);
  });

  it("应支持动态添加 / 删除文档", () => {
    const testEntry: KnowledgeEntry = {
      id: "test-dynamic-001",
      system: "general",
      tags: ["测试", "动态添加"],
      title: "测试条目",
      text: "这是一个测试。",
      source: "test",
    };
    const before = ragStore.size();
    ragStore.add(testEntry);
    expect(ragStore.size()).toBe(before + 1);

    const hits = ragStore.query({ tags: ["测试"] });
    expect(hits.some((h) => h.entry.id === "test-dynamic-001")).toBe(true);

    const removed = ragStore.remove("test-dynamic-001");
    expect(removed).toBe(true);
    expect(ragStore.size()).toBe(before);
  });

  it("部分匹配应召回（子串包含）", () => {
    // "杀破狼格" 应能匹配包含 "杀破狼" 的种子条目
    const hits = ragStore.query({ tags: ["杀破狼"], topK: 5 });
    expect(hits.length).toBeGreaterThan(0);
  });
});
