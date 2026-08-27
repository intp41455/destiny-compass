import type {
  BaziResult,
  ChartsResult,
  ZiweiResult,
  VedicResult,
  WesternResult,
  ArabicResult,
} from "@destiny/shared";

/**
 * LLM Prompt 构造器集合
 *
 * 用户关键要求：分析必须精确到事件级——
 *  "预测会发生什么？事件事情等等。会遇到什么人等等。怕发生什么事。"
 *
 * 因此每段 prompt 都强制 LLM 输出结构化 JSON，包含：
 *  - 时间窗口
 *  - 事件清单（事件类型 / 可能涉及人物 / 概率 / 风险点 / 机会点）
 *  - 具体行为建议
 *
 * Phase 2 扩展：
 *  - 接受多术数排盘数据（紫微/印度/西洋/阿拉伯）
 *  - 接受 RAG 召回片段 + 外部搜索片段作为知识补充
 *  - prompt 中包含"跨术数共识分析"部分
 */

export interface PredictionEvent {
  category:
    | "事业" | "财运" | "感情" | "健康"
    | "人际" | "学业" | "出行" | "法律" | "其他";
  probability: number;
  people: string[];
  risks: string[];
  opportunities: string[];
  description: string;
  suggestion: string;
}

export interface FortuneAnalysis {
  window: string;
  overallScore: number;
  summary: string;
  keyNotes: string[];
  events: PredictionEvent[];
  precautions: string[];
}

/** RAG 召回条目片段（注入 prompt 上下文） */
export interface RagContext {
  system: string;
  title: string;
  text: string;
  source: string;
}

/** 多源搜索条目片段 */
export interface SearchContext {
  title: string;
  url: string;
  snippet: string;
  source: string;
}

export interface PromptContext {
  ragHits?: RagContext[];
  searchHits?: SearchContext[];
}

const ZODIAC = [
  "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
  "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
];

function formatContext(ctx?: PromptContext): string {
  const parts: string[] = [];
  if (ctx?.ragHits && ctx.ragHits.length > 0) {
    parts.push("# 参考知识库片段（RAG）");
    ctx.ragHits.forEach((r, i) => {
      parts.push(`[${i + 1}] ${r.title}（${r.system}，出自 ${r.source}）`);
      parts.push(r.text);
      parts.push("");
    });
  }
  if (ctx?.searchHits && ctx.searchHits.length > 0) {
    parts.push("# 外部搜索补充（多源搜索）");
    ctx.searchHits.forEach((s, i) => {
      parts.push(`[${i + 1}] ${s.title}（${s.source}）`);
      parts.push(s.snippet);
      parts.push(`  来源：${s.url}`);
      parts.push("");
    });
  }
  return parts.join("\n");
}

function formatMultiCharts(charts: ChartsResult): string {
  const parts: string[] = [];

  if (charts.ziwei) {
    const z = charts.ziwei as ZiweiResult;
    parts.push("# 紫微斗数排盘");
    parts.push(`- 五行局：${z.fiveElementsClass}`);
    parts.push(`- 命宫主星：${z.soulPalaceStar}（命宫地支 ${z.soulPalaceBranch}）`);
    parts.push(`- 身宫主星：${z.bodyPalaceStar}（身宫地支 ${z.bodyPalaceBranch}）`);
    parts.push(`- 八字四柱：${z.chineseDate}`);
    parts.push(`- 大限：${z.daxian.map((d) => `${d.startAge}岁起 ${d.earthlyBranch}`).slice(0, 5).join("；")}`);
    parts.push(`- 特征标签：${z.tags.join("、")}`);
    parts.push("");
  }

  if (charts.vedic) {
    const v = charts.vedic as VedicResult;
    parts.push("# 印度占星（Jyotish）");
    parts.push(`- Lagna：${v.lagna}`);
    parts.push(`- 月亮 Rashi：${v.moonRashi}；太阳 Rashi：${v.sunRashi}`);
    parts.push(`- 月宿 Nakshatra：${v.moonNakshatra}（pada ${v.moonPada}）`);
    parts.push(`- 当前 Mahadasha：${v.currentDasha.maha}（Antardasha：${v.currentDasha.antar}）`);
    parts.push(`- Yoga 组合：${v.yogas.join("、") || "无明显组合"}`);
    parts.push(`- Gochara 推运：土星过 ${v.gochara.saturn}、木星过 ${v.gochara.jupiter}`);
    parts.push(`- 特征标签：${v.tags.join("、")}`);
    parts.push("");
  }

  if (charts.western) {
    const w = charts.western as WesternResult;
    const sun = w.planets.find((p) => p.name === "sun")!;
    const moon = w.planets.find((p) => p.name === "moon")!;
    parts.push("# 古典占星");
    parts.push(`- 太阳：${sun.signName} ${sun.degreeInSign.toFixed(0)}°（第 ${sun.house} 宫）`);
    parts.push(`- 月亮：${moon.signName} ${moon.degreeInSign.toFixed(0)}°（第 ${moon.house} 宫）`);
    parts.push(`- 上升：${ZODIAC[Math.floor(w.houses.ascendant / 30) % 12]}；中天：${ZODIAC[Math.floor(w.houses.midheaven / 30) % 12]}`);
    parts.push(`- 法达：主星 ${w.firdaria.ruler}（副星 ${w.firdaria.subRuler ?? "无"}）`);
    parts.push(`- 年度小限：${w.profection.house}宫（守护星 ${w.profection.ruler}）`);
    const majorAspects = w.aspects.filter((a) => ["conjunction","opposition","trine","square"].includes(a.type)).slice(0, 5);
    if (majorAspects.length > 0) {
      parts.push(`- 主要相位：${majorAspects.map((a) => `${a.planetA}-${a.planetB}-${a.type}`).join("、")}`);
    }
    parts.push(`- 特征标签：${w.tags.join("、")}`);
    parts.push("");
  }

  if (charts.arabic) {
    const a = charts.arabic as ArabicResult;
    const pof = a.parts.find((p) => p.name === "Part of Fortune");
    const pos = a.parts.find((p) => p.name === "Part of Spirit");
    parts.push("# 阿拉伯占星");
    parts.push(`- 福点：${pof ? `${pof.sign}（第 ${pof.house} 宫，${pof.formula}）` : "—"}`);
    parts.push(`- 灵点：${pos ? `${pos.sign}（第 ${pos.house} 宫）` : "—"}`);
    parts.push(`- 北交点：${a.northNode.sign}（第 ${a.northNode.house} 宫）`);
    parts.push(`- 南交点：${a.southNode.sign}（第 ${a.southNode.house} 宫）`);
    parts.push(`- 日主星：${a.dayRuler}；时主星：${a.hourRuler}`);
    parts.push(`- 特征标签：${a.tags.join("、")}`);
    parts.push("");
  }

  return parts.join("\n");
}

/** 构建"人生总分析"的 user prompt */
export function buildLifeAnalysisPrompt(
  charts: ChartsResult,
  ctx?: PromptContext,
): string {
  const bazi = charts.bazi as BaziResult;
  const meta = charts.meta;
  const multiCharts = formatMultiCharts(charts);
  const contextStr = formatContext(ctx);
  return `# 命主信息
- 公历生日：${meta.birthday}
- 真太阳时（已校准）：${meta.solarTimeCorrected}（校准偏移 ${meta.trueSolarOffsetMin} 分钟）
- 性别：${meta.gender === "male" ? "男" : "女"}
- 出生地：${meta.locationName}（纬度 ${meta.lat}，经度 ${meta.lng}，时区 ${meta.timezone}）

# 八字排盘结果
- 年柱：${bazi.pillars.year}
- 月柱：${bazi.pillars.month}
- 日柱：${bazi.pillars.day}（日主：${bazi.dayMaster}）
- 时柱：${bazi.pillars.hour}
- 十神：${Object.entries(bazi.tenGods).map(([k, v]) => `${k}=${v}`).join("、")}
- 藏干：${Object.entries(bazi.hiddenStems).map(([k, v]) => `${k}=${v.join("")}`).join("、")}
- 纳音：${bazi.nayin}
- 神煞：${bazi.shensha.join("、")}
- 大运：${bazi.dayun.map((d) => `${d.startAge}-${d.endAge ?? "?"}岁 ${d.stems.join("")}`).join("；")}
- 特征标签：${bazi.tags.join("、")}

${multiCharts}
${contextStr}
# 任务
你是一位同时精通八字、紫微、印度占星、古典占星、阿拉伯占星的专业命理师。
请基于以上完整多术数排盘数据，对命主进行系统性的人生总分析。

必须输出 JSON，结构如下：
\`\`\`
{
  "personality": ["性格特点 1", "性格特点 2", "..."],
  "talents": ["天赋才能 1", "..."],
  "career": ["适合的事业方向、行业 1", "..."],
  "wealth": ["财源特征、求财方式 1", "..."],
  "relationship": ["感情模式、婚姻特征 1", "..."],
  "health": ["健康薄弱环节、保养建议 1", "..."],
  "lifeThemes": ["人生主题 1", "..."],
  "strengths": ["命局优势 1", "..."],
  "weaknesses": ["命局弱点 1", "..."],
  "luckyElements": "喜用神（如 木火）",
  "tabooElements": "忌神（如 金水）",
  "crossSystemConsensus": [
    "跨术数共识 1：八字日主甲木身弱 + 紫微命宫天同天梁 + 印度 Lagna Simha + 西洋上升 Leo → 一致主艺术气质、领导倾向、内心敏感"
  ]
}
\`\`\`

要求：
1. 所有字段都必须填写，不得省略
2. 每个字段至少 3 条具体、可操作的内容
3. 不使用空洞套话，每条都要基于具体排盘数据
4. crossSystemConsensus 必须显式指出多种术数系统给出的【一致结论】（至少 3 条），
   每条要列出 2 种以上术数系统所对应的具体证据
5. 仅输出 JSON，不要任何解释文字`;
}

/** 构建"年度运势"的 user prompt */
export function buildYearlyFortunePrompt(
  charts: ChartsResult,
  year: number,
  ctx?: PromptContext,
): string {
  const bazi = charts.bazi as BaziResult;
  const meta = charts.meta;
  const birthYear = Number(meta.birthday.slice(0, 4));
  const age = year - birthYear;

  const currentDayun = bazi.dayun.find(
    (d) => age >= d.startAge && (d.endAge == null || age <= d.endAge),
  );
  const dayunInfo = currentDayun
    ? `当前大运：${currentDayun.stems.join("")}（${currentDayun.startAge}-${currentDayun.endAge ?? "?"}岁）`
    : "暂未在大运列表内";

  const yearGanZhi = getYearGanZhi(year);
  const multiCharts = formatMultiCharts(charts);
  const contextStr = formatContext(ctx);

  // 跨术数推运摘要
  const vedicCurrent = (charts.vedic as VedicResult | undefined)?.currentDasha;
  const westernFirdaria = (charts.western as WesternResult | undefined)?.firdaria;
  const westernProfection = (charts.western as WesternResult | undefined)?.profection;

  return `# 命主基础信息
- 出生：${meta.birthday}（${meta.gender === "male" ? "男" : "女"}）
- 真太阳时：${meta.solarTimeCorrected}
- 当前年龄：${age} 岁（虚岁 ${age + 1}）

# 命局核心
- 日主：${bazi.dayMaster}
- 喜忌参考：${bazi.tags.join("、")}
- ${dayunInfo}
- 流年干支：${yearGanZhi}
- 十神：${Object.entries(bazi.tenGods).map(([k, v]) => `${k}=${v}`).join("、")}

${multiCharts}
# 当年跨术数推运
- 印度 Dasha：${vedicCurrent ? `Mahadasha ${vedicCurrent.maha} / Antardasha ${vedicCurrent.antar}` : "—"}
- 西洋 Firdaria：${westernFirdaria ? `主星 ${westernFirdaria.ruler}（副星 ${westernFirdaria.subRuler ?? "无"}）` : "—"}
- 西洋 Profection：${westernProfection ? `第 ${westernProfection.house} 宫（守护 ${westernProfection.ruler}）` : "—"}

${contextStr}
# 任务
请基于命主多术数命局 + 当年流年干支 + 当前大运 + 印度 Dasha + 西洋 Firdaria/Profection，预测 ${year} 年（农历正月初一至腊月三十）的事件级运势。

必须输出 JSON，结构如下：
\`\`\`
{
  "window": "${year} 年",
  "overallScore": 60,
  "summary": "年度总评，3-5 句",
  "keyNotes": ["年度关键提示 1", "..."],
  "events": [
    {
      "category": "事业",
      "probability": 0.8,
      "people": ["可能涉及的具体人物角色，如 年长男性上司、属马的同事"],
      "risks": ["风险点，具体事件描述"],
      "opportunities": ["机会点，具体事件描述"],
      "description": "事件描述，要具体到可能发生什么事",
      "suggestion": "具体行为建议"
    }
  ],
  "precautions": ["年度注意事项 1", "..."]
}
\`\`\`

要求：
1. events 至少 6 个，覆盖 事业/财运/感情/健康/人际 等至少 4 个类别
2. probability 取 0-1 之间的浮点数
3. people 字段必须填写具体人物特征（年龄/性别/生肖/职业关系）
4. description 必须具体到"会发生什么事"，禁止笼统描述
5. risks 和 opportunities 必须包含具体可识别的事件
6. 跨术数一致的运势信号应在 events 中得到强化（probability 提高 / description 更明确）
7. 仅输出 JSON`;
}

/** 构建"月度运势"的 user prompt */
export function buildMonthlyFortunePrompt(
  charts: ChartsResult,
  year: number,
  month: number,
  ctx?: PromptContext,
): string {
  const bazi = charts.bazi as BaziResult;
  const meta = charts.meta;
  const birthYear = Number(meta.birthday.slice(0, 4));
  const age = year - birthYear;

  const monthGanZhi = getMonthGanZhi(year, month);
  const contextStr = formatContext(ctx);

  return `# 命主基础信息
- 出生：${meta.birthday}（${meta.gender === "male" ? "男" : "女"}）
- 当前年龄：${age} 岁
- 日主：${bazi.dayMaster}
- 命局标签：${bazi.tags.join("、")}

# 当月信息
- 公历：${year} 年 ${month} 月
- 流月干支：${monthGanZhi}
- 流月与日主关系：${getRelation(bazi.dayMaster, monthGanZhi[0])}

${contextStr}
# 任务
请基于命主多术数命局 + 当月流月干支，预测 ${year} 年 ${month} 月（公历 1 日到月底）的事件级运势。

必须输出 JSON，结构如下：
\`\`\`
{
  "window": "${year} 年 ${month} 月",
  "overallScore": 60,
  "summary": "月度总评，2-4 句",
  "keyNotes": ["月度关键提示 1", "..."],
  "events": [
    {
      "category": "事业",
      "probability": 0.7,
      "people": ["可能涉及人物，含年龄/性别/生肖/职业"],
      "risks": ["具体风险事件"],
      "opportunities": ["具体机会事件"],
      "description": "事件具体描述",
      "suggestion": "具体行为建议"
    }
  ],
  "precautions": ["月度注意事项 1", "..."]
}
\`\`\`

要求：
1. events 至少 4 个，覆盖至少 3 个类别
2. 所有事件必须发生在当月内可能发生
3. description 必须具体到事件级别，禁止笼统
4. people 字段不可为空数组
5. 仅输出 JSON`;
}

/** 构建"每日运势"的 user prompt */
export function buildDailyFortunePrompt(
  charts: ChartsResult,
  date: Date,
  daysAhead: number = 0,
  ctx?: PromptContext,
): string {
  const bazi = charts.bazi as BaziResult;
  const meta = charts.meta;
  const targetDate = new Date(date);
  targetDate.setDate(targetDate.getDate() + daysAhead);
  const dateStr = targetDate.toISOString().slice(0, 10);

  const dayGanZhi = "（由排盘服务计算）";
  const contextStr = formatContext(ctx);

  return `# 命主基础信息
- 出生：${meta.birthday}（${meta.gender === "male" ? "男" : "女"}）
- 日主：${bazi.dayMaster}
- 命局标签：${bazi.tags.join("、")}

# 当日信息
- 公历：${dateStr}
- 日干支：${dayGanZhi}

${contextStr}
# 任务
请基于命主多术数命局 + 当日干支，预测 ${dateStr} 当天的事件级运势。

必须输出 JSON，结构如下：
\`\`\`
{
  "window": "${dateStr}",
  "overallScore": 60,
  "summary": "当日总评，1-3 句",
  "keyNotes": ["当日关键提示 1", "..."],
  "events": [
    {
      "category": "事业",
      "probability": 0.6,
      "people": ["当日可能接触的人物，含年龄/性别/生肖"],
      "risks": ["当日具体风险事件"],
      "opportunities": ["当日具体机会事件"],
      "description": "事件描述，要具体",
      "suggestion": "具体行为建议"
    }
  ],
  "precautions": ["当日注意事项 1", "..."]
}
\`\`\`

要求：
1. events 至少 3 个
2. 所有事件都必须是当日可能发生的具体事件
3. 重点关注：宜/忌的事项、可能遇到的人、需警惕的小事
4. 仅输出 JSON`;
}

// ============ 工具函数 ============

const TIAN_GAN = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"];

function getYearGanZhi(year: number): string {
  const offset = year - 1984;
  const gan = TIAN_GAN[((offset % 10) + 10) % 10];
  const zhi = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"][
    ((offset % 12) + 12) % 12
  ];
  return `${gan}${zhi}`;
}

function getMonthGanZhi(year: number, month: number): string {
  const monthZhiMap = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];
  const zhi = monthZhiMap[(month + 10) % 12];
  const yearOffset = (year - 1984 + 10_000) % 10;
  const startMonthGanIdx = [5, 5, 1, 1, 7, 7, 3, 3, 9, 9][yearOffset];
  const monthsAfterTiger = (month - 2 + 12) % 12;
  const ganIdx = (startMonthGanIdx + monthsAfterTiger) % 10;
  const gan = TIAN_GAN[ganIdx];
  return `${gan}${zhi}`;
}

function getRelation(dayMaster: string, gan: string): string {
  if (dayMaster === gan) return "比肩";
  const dmIdx = TIAN_GAN.indexOf(dayMaster);
  const ganIdx = TIAN_GAN.indexOf(gan);
  if (dmIdx === -1 || ganIdx === -1) return "未知";
  const dmEl = Math.floor(dmIdx / 2);
  const ganEl = Math.floor(ganIdx / 2);
  const sameYinYang = dmIdx % 2 === ganIdx % 2;
  if (dmEl === ganEl) return sameYinYang ? "比肩" : "劫财";
  if ((ganEl + 1) % 5 === dmEl) return sameYinYang ? "偏印" : "正印";
  if ((dmEl + 1) % 5 === ganEl) return sameYinYang ? "食神" : "伤官";
  if ((ganEl + 2) % 5 === dmEl) return sameYinYang ? "七杀" : "正官";
  if ((dmEl + 2) % 5 === ganEl) return sameYinYang ? "偏财" : "正财";
  return "未知";
}
