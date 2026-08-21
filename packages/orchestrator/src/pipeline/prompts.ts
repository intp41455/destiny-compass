import type { BaziResult, ChartsResult } from "@destiny/shared";

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
 */

export interface PredictionEvent {
  /** 事件分类：事业 / 财运 / 感情 / 健康 / 人际 / 学业 / 出行 / 法律 */
  category:
    | "事业"
    | "财运"
    | "感情"
    | "健康"
    | "人际"
    | "学业"
    | "出行"
    | "法律"
    | "其他";
  /** 概率 0-1 */
  probability: number;
  /** 可能涉及的人物（角色描述，如"年长男性上司"、"属马的异性"） */
  people: string[];
  /** 风险点 / 警惕事项 */
  risks: string[];
  /** 机会点 / 可借势之处 */
  opportunities: string[];
  /** 具体事件描述 */
  description: string;
  /** 建议行为 */
  suggestion: string;
}

export interface FortuneAnalysis {
  /** 时间窗口标签，如 "2026 年 3 月" 或 "2026-08-21 至 2026-08-27" */
  window: string;
  /** 总体运势评分 1-100 */
  overallScore: number;
  /** 综合评语 */
  summary: string;
  /** 当期关键提示 */
  keyNotes: string[];
  /** 事件级预测清单 */
  events: PredictionEvent[];
  /** 注意事项 */
  precautions: string[];
}

/** 构建"人生总分析"的 user prompt */
export function buildLifeAnalysisPrompt(
  charts: ChartsResult,
): string {
  const bazi = charts.bazi as BaziResult;
  const meta = charts.meta;
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
- 十神：${Object.entries(bazi.tenGods)
    .map(([k, v]) => `${k}=${v}`)
    .join("、")}
- 藏干：${Object.entries(bazi.hiddenStems)
    .map(([k, v]) => `${k}=${v.join("")}`)
    .join("、")}
- 纳音：${bazi.nayin}
- 神煞：${bazi.shensha.join("、")}
- 大运：${bazi.dayun
     .map((d) => `${d.startAge}-${d.endAge ?? "?"}岁 ${d.stems.join("")}`)
     .join("；")}
- 特征标签：${bazi.tags.join("、")}

# 任务
你是一位资深八字命理师，请基于以上完整排盘数据，对命主进行一次系统性的人生总分析。

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
  "tabooElements": "忌神（如 金水）"
}
\`\`\`

要求：
1. 所有字段都必须填写，不得省略
2. 每个字段至少 3 条具体、可操作的内容
3. 不使用空洞套话，每条都要基于具体排盘数据
4. 仅输出 JSON，不要任何解释文字`;
}

/** 构建"年度运势"的 user prompt */
export function buildYearlyFortunePrompt(
  charts: ChartsResult,
  year: number,
): string {
  const bazi = charts.bazi as BaziResult;
  const meta = charts.meta;
  // 计算命主当年年龄
  const birthYear = Number(meta.birthday.slice(0, 4));
  const age = year - birthYear;

  // 定位当前大运
  const currentDayun = bazi.dayun.find(
    (d) => age >= d.startAge && (d.endAge == null || age <= d.endAge),
  );
  const dayunInfo = currentDayun
    ? `当前大运：${currentDayun.stems.join("")}（${currentDayun.startAge}-${
        currentDayun.endAge ?? "?"
      }岁）`
    : "暂未在大运列表内";

  // 流年干支：以立春为界，简化用 4 月起算
  const yearGanZhi = getYearGanZhi(year);

  return `# 命主基础信息
- 出生：${meta.birthday}（${meta.gender === "male" ? "男" : "女"}）
- 真太阳时：${meta.solarTimeCorrected}
- 当前年龄：${age} 岁（虚岁 ${age + 1}）

# 命局核心
- 日主：${bazi.dayMaster}
- 喜忌参考：${bazi.tags.join("、")}
- ${dayunInfo}
- 流年干支：${yearGanZhi}
- 十神：${Object.entries(bazi.tenGods)
    .map(([k, v]) => `${k}=${v}`)
    .join("、")}

# 任务
请基于命主八字命局 + 当年流年干支 + 当前大运，预测 ${year} 年（农历正月初一至腊月三十）的事件级运势。

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
6. 仅输出 JSON`;
}

/** 构建"月度运势"的 user prompt */
export function buildMonthlyFortunePrompt(
  charts: ChartsResult,
  year: number,
  month: number,
): string {
  const bazi = charts.bazi as BaziResult;
  const meta = charts.meta;
  const birthYear = Number(meta.birthday.slice(0, 4));
  const age = year - birthYear;

  // 月干支：简化用月份对应的农历月
  const monthGanZhi = getMonthGanZhi(year, month);

  return `# 命主基础信息
- 出生：${meta.birthday}（${meta.gender === "male" ? "男" : "女"}）
- 当前年龄：${age} 岁
- 日主：${bazi.dayMaster}
- 命局标签：${bazi.tags.join("、")}

# 当月信息
- 公历：${year} 年 ${month} 月
- 流月干支：${monthGanZhi}
- 流月与日主关系：${getRelation(bazi.dayMaster, monthGanZhi[0])}

# 任务
请基于命主八字命局 + 当月流月干支，预测 ${year} 年 ${month} 月（公历 1 日到月底）的事件级运势。

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
): string {
  const bazi = charts.bazi as BaziResult;
  const meta = charts.meta;
  const targetDate = new Date(date);
  targetDate.setDate(targetDate.getDate() + daysAhead);
  const dateStr = targetDate.toISOString().slice(0, 10);

  // 日干支：简化使用 lunar 公式替代 — 此处给出占位，由编排层调用排盘服务计算
  const dayGanZhi = "（由排盘服务计算）";

  return `# 命主基础信息
- 出生：${meta.birthday}（${meta.gender === "male" ? "男" : "女"}）
- 日主：${bazi.dayMaster}
- 命局标签：${bazi.tags.join("、")}

# 当日信息
- 公历：${dateStr}
- 日干支：${dayGanZhi}

# 任务
请基于命主八字命局 + 当日干支，预测 ${dateStr} 当天的事件级运势。

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

/** 简化版的流年干支计算（基于 1984 甲子年） */
function getYearGanZhi(year: number): string {
  const offset = year - 1984;
  const gan = TIAN_GAN[((offset % 10) + 10) % 10];
  const zhi = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"][
    ((offset % 12) + 12) % 12
  ];
  return `${gan}${zhi}`;
}

/** 简化版的流月干支计算 */
function getMonthGanZhi(year: number, month: number): string {
  // 月支：寅月为正月，即公历 2 月
  const monthZhiMap = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];
  // 公历 1 月 → 上一年的丑月，2 月 → 寅月
  const zhi = monthZhiMap[(month + 10) % 12];
  // 年上起月：甲己之年丙作首
  const yearOffset = (year - 1984 + 10_000) % 10; // 0=甲
  const startMonthGanIdx = [5, 5, 1, 1, 7, 7, 3, 3, 9, 9][yearOffset]; // 丙=2 戊=5 庚=7 壬=9 甲=0...
  // 简化：寅月起算
  const monthsAfterTiger = (month - 2 + 12) % 12;
  const ganIdx = (startMonthGanIdx + monthsAfterTiger) % 10;
  const gan = TIAN_GAN[ganIdx];
  return `${gan}${zhi}`;
}

/** 日主与流年/月/日干的关系（十神简化） */
function getRelation(dayMaster: string, gan: string): string {
  if (dayMaster === gan) return "比肩";
  const dmIdx = TIAN_GAN.indexOf(dayMaster);
  const ganIdx = TIAN_GAN.indexOf(gan);
  if (dmIdx === -1 || ganIdx === -1) return "未知";
  const dmEl = Math.floor(dmIdx / 2);
  const ganEl = Math.floor(ganIdx / 2);
  const sameYinYang = dmIdx % 2 === ganIdx % 2;
  if (dmEl === ganEl) return sameYinYang ? "比肩" : "劫财";
  if ((ganEl + 1) % 5 === dmEl) return sameYinYang ? "偏印" : "正印"; // 印（生我）
  if ((dmEl + 1) % 5 === ganEl) return sameYinYang ? "食神" : "伤官"; // 食伤（我生）
  if ((ganEl + 2) % 5 === dmEl) return sameYinYang ? "七杀" : "正官"; // 官杀（克我）
  if ((dmEl + 2) % 5 === ganEl) return sameYinYang ? "偏财" : "正财"; // 财（我克）
  return "未知";
}
