import type { ChartsResult, PaipanInput, SSEEvent } from "./types.js";
import { calculateBazi } from "./bazi.js";
import { calculateSolarTime } from "./solar-time.js";
import { calculateWesternAstrology, calculateVedicAstrology, calculateArabicAstrology } from "./astrology.js";
import { calculateZiwei } from "./ziwei.js";
import { publishEvent } from "./event-bus.js";
import { LLM_API_KEY, LLM_BASE_URL, LLM_MODEL, ANALYSIS_TIMEOUT_MS } from "./config.js";

export type ProgressCallback = (event: SSEEvent) => void;

const SYSTEM_PROMPT =
  "你是一位同时精通八字、紫微、印度占星、古典占星、阿拉伯占星的专业命理师。" +
  "所有分析必须严格基于给定排盘数据，禁止编造数据。" +
  "使用简体中文，禁止任何空洞套话，每条结论都要落到具体事件、人物、时间。" +
  "所有输出必须是合法 JSON，禁止任何解释性文字或 markdown。";

interface CallLLMOptions {
  messages: Array<{ role: string; content: string }>;
  temperature?: number;
}

async function callLLM(opts: CallLLMOptions): Promise<string> {
  const url = `${LLM_BASE_URL}/v1/chat/completions`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${LLM_API_KEY}`,
    },
    body: JSON.stringify({
      model: LLM_MODEL,
      messages: opts.messages,
      temperature: opts.temperature ?? 0.7,
      response_format: { type: "json_object" },
    }),
    signal: AbortSignal.timeout(ANALYSIS_TIMEOUT_MS),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`LLM API ${response.status}: ${err.slice(0, 200)}`);
  }

  const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return data.choices?.[0]?.message?.content ?? "";
}

function buildLifePrompt(charts: ChartsResult): string {
  const bazi = charts.bazi;
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
- 十神：${Object.entries(bazi.tenGods).map(([k, v]) => `${k}=${v}`).join("、")}
- 藏干：${Object.entries(bazi.hiddenStems).map(([k, v]) => `${k}=${v.join("")}`).join("、")}
- 纳音：${bazi.nayin}
- 神煞：${bazi.shensha.join("、")}
- 大运：${bazi.dayun.map((d) => `${d.startAge}-${d.endAge ?? "?"}岁 ${d.stems.join("")}`).join("；")}
- 特征标签：${bazi.tags.join("、")}

# 西洋占星
${charts.western ? `- 太阳：${charts.western.planets.find((p) => p.name === "sun")?.signName} ${charts.western.planets.find((p) => p.name === "sun")?.degreeInSign.toFixed(0)}°\n- 月亮：${charts.western.planets.find((p) => p.name === "moon")?.signName}\n- 上升：${"上升点"}` : ""}

# 印度占星
${charts.vedic ? `- Lagna：${charts.vedic.lagna}\n- 月亮 Nakshatra：${charts.vedic.moonNakshatra}\n- 当前 Dasha：${charts.vedic.currentDasha.maha}` : ""}

请基于以上多术数排盘数据，对命主进行系统性的人生总分析。输出 JSON：
{
  "personality": ["性格特点"],
  "talents": ["天赋才能"],
  "career": ["适合的事业方向"],
  "wealth": ["财源特征"],
  "relationship": ["感情模式"],
  "health": ["健康薄弱环节"],
  "lifeThemes": ["人生主题"],
  "strengths": ["命局优势"],
  "weaknesses": ["命局弱点"],
  "luckyElements": "喜用神",
  "tabooElements": "忌神",
  "crossSystemConsensus": ["跨术数共识"]
}`;
}

function buildYearlyPrompt(charts: ChartsResult, year: number): string {
  const bazi = charts.bazi;
  const meta = charts.meta;
  const birthYear = Number(meta.birthday.slice(0, 4));
  const age = year - birthYear;
  const offset = (year - 1984) % 60;
  const yearGanZhi = `${["甲","乙","丙","丁","戊","己","庚","辛","壬","癸"][(offset%10+10)%10]}${["子","丑","寅","卯","辰","巳","午","未","申","酉","戌","亥"][(offset%12+12)%12]}`;
  const currentDayun = bazi.dayun.find((d) => age >= d.startAge && (d.endAge == null || age <= d.endAge));
  return `# 命主基础信息
- 出生：${meta.birthday}（${meta.gender === "male" ? "男" : "女"}）
- 当前年龄：${age} 岁
- 日主：${bazi.dayMaster}
- 流年干支：${yearGanZhi}
- 大运：${currentDayun ? `${currentDayun.stems.join("")}（${currentDayun.startAge}-${currentDayun.endAge ?? "?"}岁）` : "暂未在大运列表内"}

# 八字排盘
- 四柱：${bazi.pillars.year} ${bazi.pillars.month} ${bazi.pillars.day} ${bazi.pillars.hour}
- 十神：${Object.entries(bazi.tenGods).map(([k, v]) => `${k}=${v}`).join("、")}

请预测 ${year} 年的事件级运势。输出 JSON：
{
  "window": "${year} 年",
  "overallScore": 60,
  "summary": "年度总评",
  "keyNotes": ["关键提示"],
  "events": [
    {
      "category": "事业",
      "probability": 0.8,
      "people": ["可能涉及人物"],
      "risks": ["风险点"],
      "opportunities": ["机会点"],
      "description": "具体事件描述",
      "suggestion": "行为建议"
    }
  ],
  "precautions": ["注意事项"]
}`;
}

function buildDailyPrompt(charts: ChartsResult, dateStr: string): string {
  const bazi = charts.bazi;
  return `# 命主
- 日主：${bazi.dayMaster}
- 四柱：${bazi.pillars.year} ${bazi.pillars.month} ${bazi.pillars.day} ${bazi.pillars.hour}

# 目标日期：${dateStr}

请预测当天的事件级运势。输出 JSON：
{
  "window": "${dateStr}",
  "overallScore": 60,
  "summary": "当日总评",
  "keyNotes": ["关键提示"],
  "events": [
    {
      "category": "事业",
      "probability": 0.6,
      "people": ["当日可能接触的人物"],
      "risks": ["当日具体风险事件"],
      "opportunities": ["当日具体机会事件"],
      "description": "事件描述",
      "suggestion": "行为建议"
    }
  ],
  "precautions": ["当日注意事项"]
}`;
}

export async function runAnalysisPipeline(
  input: PaipanInput,
  analysisId: string,
  onProgress: ProgressCallback,
): Promise<{ charts: ChartsResult; sections: Record<string, string> }> {
  const sections: Record<string, string> = {};

  // ============ STEP 1: 真太阳时 + 八字 ============
  onProgress({ type: "progress", step: "STEP 1", message: "正在校准真太阳时 + 排八字…" });

  const lat = input.lat ?? 39.9042;
  const lng = input.lng ?? 116.4074;

  const solarTime = calculateSolarTime({
    date: input.birthday,
    time: input.birthTime,
    lng,
    lat,
    locationName: input.locationName,
  });

  const [correctedDate, correctedTime] = solarTime.solarTime.split(" ");
  const bazi = calculateBazi(correctedDate, correctedTime, input.gender, lng, lat);

  const birthYear = Number(input.birthday.slice(0, 4));
  const currentYear = new Date().getFullYear();
  const age = currentYear - birthYear;

  // ============ STEP 1.5: 多术数并行 ============
  onProgress({ type: "progress", step: "STEP 1.5", message: "正在并行排紫微/印度/西洋/阿拉伯…" });

  const westernResult = calculateWesternAstrology(input.birthday, input.birthTime, lat, lng, age);
  const vedicResult = calculateVedicAstrology(input.birthday, input.birthTime, lat, lng, age);
  const arabicResult = calculateArabicAstrology(input.birthday, input.birthTime, lat, lng);
  const ziweiResult = calculateZiwei(input.birthday, input.birthTime, input.gender);

  const charts: ChartsResult = {
    meta: {
      birthday: input.birthday,
      solarTimeCorrected: solarTime.solarTime,
      trueSolarOffsetMin: solarTime.offsetMinutes,
      gender: input.gender,
      lat,
      lng,
      timezone: solarTime.timezone,
      locationName: input.locationName,
    },
    bazi,
    ziwei: ziweiResult,
    western: westernResult,
    vedic: vedicResult,
    arabic: arabicResult,
    unifiedTags: [...new Set([...bazi.tags, ...ziweiResult.tags, ...westernResult.tags, ...vedicResult.tags, ...arabicResult.tags])],
  };

  onProgress({ type: "charts", data: charts });

  // ============ STEP 2: 人生总分析 ============
  onProgress({ type: "progress", step: "STEP 2", message: "正在生成人生总分析…" });
  try {
    const lifeAnalysis = await callLLM({
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildLifePrompt(charts) },
      ],
    });
    sections.life = lifeAnalysis;
    onProgress({ type: "analysis", section: "人生总分析", content: lifeAnalysis });
  } catch (err) {
    const fallback = JSON.stringify({ error: "LLM不可用", message: (err as Error).message });
    sections.life = fallback;
    onProgress({ type: "analysis", section: "人生总分析", content: fallback });
  }

  // ============ STEP 3: 年度运势 ============
  onProgress({ type: "progress", step: "STEP 3", message: `正在生成 ${currentYear} 年度运势…` });
  try {
    const yearly = await callLLM({
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildYearlyPrompt(charts, currentYear) },
      ],
    });
    sections.yearly = yearly;
    onProgress({ type: "analysis", section: `${currentYear} 年度运势`, content: yearly });
  } catch (err) {
    sections.yearly = JSON.stringify({ error: "LLM不可用" });
    onProgress({ type: "analysis", section: `${currentYear} 年度运势`, content: JSON.stringify({ error: "LLM不可用" }) });
  }

  // ============ STEP 4: 月度运势 ============
  const month = new Date().getMonth() + 1;
  onProgress({ type: "progress", step: "STEP 4", message: `正在生成 ${currentYear} 年 ${month} 月运势…` });
  try {
    const monthly = await callLLM({
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `# 命主\n- 日主：${charts.bazi.dayMaster}\n- 四柱：${charts.bazi.pillars.year} ${charts.bazi.pillars.month} ${charts.bazi.pillars.day} ${charts.bazi.pillars.hour}\n\n请预测 ${currentYear} 年 ${month} 月的运势。输出 JSON：{"window":"${currentYear}年${month}月","overallScore":60,"summary":"月度总评","keyNotes":[],"events":[{"category":"事业","probability":0.7,"people":[],"risks":[],"opportunities":[],"description":"","suggestion":""}],"precautions":[]}` },
      ],
    });
    sections.monthly = monthly;
    onProgress({ type: "analysis", section: `${currentYear} 年 ${month} 月运势`, content: monthly });
  } catch (err) {
    sections.monthly = JSON.stringify({ error: "LLM不可用" });
    onProgress({ type: "analysis", section: `${currentYear} 年 ${month} 月运势`, content: JSON.stringify({ error: "LLM不可用" }) });
  }

  // ============ STEP 5: 未来7天每日运势 ============
  onProgress({ type: "progress", step: "STEP 5", message: "正在生成未来 7 天每日运势…" });
  const dailyResults: string[] = [];
  for (let i = 0; i < 7; i++) {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + i);
    const dateStr = targetDate.toISOString().slice(0, 10);
    try {
      const daily = await callLLM({
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: buildDailyPrompt(charts, dateStr) },
        ],
      });
      dailyResults.push(daily);
      onProgress({ type: "analysis", section: `每日运势 #${i + 1}`, content: daily });
      onProgress({ type: "progress", step: "STEP 5", message: `已完成 ${i + 1}/7 天` });
    } catch (err) {
      const fallback = JSON.stringify({ error: "LLM不可用", dayOffset: i });
      dailyResults.push(fallback);
      onProgress({ type: "analysis", section: `每日运势 #${i + 1}`, content: fallback });
    }
  }
  sections.daily = `[${dailyResults.join(",")}]`;

  // ============ DONE ============
  onProgress({ type: "done", analysisId, tokens: 0 });

  return { charts, sections };
}

export function startPipeline(
  input: PaipanInput,
  analysisId: string,
): Promise<unknown> {
  return runAnalysisPipeline(input, analysisId, (event) => {
    publishEvent(analysisId, event);
  });
}
