/**
 * MCP-6 RAG 知识库检索引擎
 *
 * 简化实现（避免 ChromaDB Python 依赖）：
 *  - 内存倒排索引：tag → Set<entryId>
 *  - TF-IDF 风格打分：查询标签与 entry 标签的 Jaccard 加权
 *  - 按命理系统过滤（system 过滤）
 *  - Top-K 召回
 *  - 支持运行时添加文档（POST /documents）
 */
import { SEED_KNOWLEDGE, type KnowledgeEntry } from "./seed-knowledge.js";

export interface RagQuery {
  /** 检索查询标签数组（来自排盘 tags） */
  tags: string[];
  /** 命理系统过滤；缺省=全部 */
  system?: KnowledgeEntry["system"];
  /** Top-K 个数，默认 5 */
  topK?: number;
}

export interface RagHit {
  entry: KnowledgeEntry;
  score: number;
  matchedTags: string[];
}

class RagStore {
  private entries: Map<string, KnowledgeEntry> = new Map();
  /** tag -> Set<entryId>（倒排索引） */
  private index: Map<string, Set<string>> = new Map();
  /** 每个 tag 的文档频率（df），用于 IDF 计算 */
  private tagDf: Map<string, number> = new Map();

  constructor(seed: KnowledgeEntry[] = SEED_KNOWLEDGE) {
    for (const e of seed) this.add(e);
  }

  add(entry: KnowledgeEntry): void {
    if (this.entries.has(entry.id)) {
      // 替换：先移除旧 tag 索引
      this.remove(entry.id);
    }
    this.entries.set(entry.id, entry);
    for (const t of entry.tags) {
      const key = this.normalize(t);
      if (!this.index.has(key)) this.index.set(key, new Set());
      this.index.get(key)!.add(entry.id);
      this.tagDf.set(key, (this.tagDf.get(key) ?? 0) + 1);
    }
  }

  remove(id: string): boolean {
    const entry = this.entries.get(id);
    if (!entry) return false;
    for (const t of entry.tags) {
      const key = this.normalize(t);
      const set = this.index.get(key);
      if (set) {
        set.delete(id);
        if (set.size === 0) this.index.delete(key);
      }
      const df = (this.tagDf.get(key) ?? 0) - 1;
      if (df <= 0) this.tagDf.delete(key);
      else this.tagDf.set(key, df);
    }
    this.entries.delete(id);
    return true;
  }

  /**
   * Top-K 检索
   *
   * 打分规则：对每个 entry，计算其 tags 与 query tags 的重叠度，
   * 加上 IDF 权重（稀有 tag 匹配得分更高）。
   *
   * 完全匹配：score += 1.0 / df（稀有加分）
   * 部分匹配：score += 0.5 / df
   */
  query(q: RagQuery): RagHit[] {
    const topK = q.topK ?? 5;
    const queryTags = q.tags.map((t) => this.normalize(t));
    const total = this.entries.size || 1;

    const hits: RagHit[] = [];
    for (const entry of this.entries.values()) {
      if (q.system && entry.system !== q.system) continue;

      const entryTags = entry.tags.map((t) => this.normalize(t));
      const matched: string[] = [];
      let score = 0;

      for (const qt of queryTags) {
        // 完全匹配
        if (entryTags.includes(qt)) {
          const df = this.tagDf.get(qt) ?? 1;
          score += Math.log((total + 1) / (df + 1)) + 1;
          matched.push(qt);
          continue;
        }
        // 部分匹配（子串包含）
        const partial = entryTags.find((et) => et.includes(qt) || qt.includes(et));
        if (partial) {
          const df = this.tagDf.get(partial) ?? 1;
          score += 0.5 * (Math.log((total + 1) / (df + 1)) + 1);
          matched.push(partial);
        }
      }

      if (score > 0) {
        hits.push({ entry, score: Number(score.toFixed(3)), matchedTags: matched });
      }
    }

    // 排序：得分降序
    hits.sort((a, b) => b.score - a.score);
    return hits.slice(0, topK);
  }

  size(): number {
    return this.entries.size;
  }

  list(): KnowledgeEntry[] {
    return Array.from(this.entries.values());
  }

  /** 标签归一化：去除空格、统一大小写、保留中文 */
  private normalize(tag: string): string {
    return tag.trim().toLowerCase();
  }
}

// 单例（进程内）
export const ragStore = new RagStore();
