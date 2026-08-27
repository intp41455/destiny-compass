import type { ChartsResult, PaipanInput, SSEEvent } from "@destiny/shared";
import {
  callBaziPaipan,
  callZiweiPaipan,
  callVedicPaipan,
  callWesternPaipan,
  callArabicPaipan,
  callRagSearch,
  callMultiSearch,
  callLLM,
} from "../mcp-client/index.js";
import { eventBus } from "../event-bus.js";
import {
  buildLifeAnalysisPrompt,
  buildYearlyFortunePrompt,
  buildMonthlyFortunePrompt,
  buildDailyFortunePrompt,
  type PromptContext,
} from "./prompts.js";

export type ProgressCallback = (event: SSEEvent) => void;

const SYSTEM_PROMPT_BASE =
  "你是一位同时精通八字、紫微、印度占星、古典占星、阿拉伯占星的专业命理师。" +
  "所有分析必须严格基于给定排盘数据，禁止编造数据。" +
  "使用简体中文，禁止任何空洞套话，每条结论都要落到具体事件、人物、时间。" +
  "所有输出必须是合法 JSON，禁止任何解释性文字或 markdown。";

/**
 * 主分析流水线
 *
 * 串行执行：
 *  STEP 1 真太阳时 + 八字排盘（外部 MCP）
 *  STEP 2 人生总分析（LLM）
 *  STEP 3 年度运势（LLM）
 *  STEP 4 月度运势（LLM）
 *  STEP 5 未来 7 天每日运势（LLM × 7）
 *
 * 每段结果通过 analysis SSE 事件单独推送，前端可分段渲染。
 */
export async function runAnalysisPipeline(
  input: PaipanInput,
  analysisId: string,
  onProgress: ProgressCallback,
): Promise<{
  charts: ChartsResult;
  sections: Record<string, string>;
}> {
  const sections: Record<string, string> = {};

  // ============ STEP 1: 八字排盘（必选，地基） ============
  onProgress({ type: "progress", step: "STEP 1", message: "正在调用真太阳时 + 八字排盘服务…" });
  let baseCharts: ChartsResult;
  try {
    baseCharts = await callBaziPaipan(input);
  } catch (err) {
    onProgress({
      type: "error",
      step: "STEP 1",
      message: `排盘失败: ${(err as Error).message}`,
    });
    throw err;
  }

  // ============ STEP 1.5: 多术数排盘（紫微/印度/西洋/阿拉伯 并行） ============
  onProgress({
    type: "progress",
    step: "STEP 1.5",
    message: "正在并行调用紫微/印度/西洋/阿拉伯排盘服务…",
  });

  const birthYear = Number(baseCharts.meta.birthday.slice(0, 4));
  const currentYear = new Date().getFullYear();
  const age = currentYear - birthYear;

  // 四种术数并行调用，单服务失败不阻塞其他
  const [ziweiRes, vedicRes, westernRes, arabicRes] = await Promise.allSettled([
    callZiweiPaipan(input),
    callVedicPaipan(input, age),
    callWesternPaipan(input, age),
    callArabicPaipan(input),
  ]);

  const multiFailures: string[] = [];
  const charts: ChartsResult = { ...baseCharts };

  if (ziweiRes.status === "fulfilled" && ziweiRes.value.ziwei) {
    charts.ziwei = ziweiRes.value.ziwei;
  } else if (ziweiRes.status === "rejected") {
    multiFailures.push(`紫微: ${ziweiRes.reason?.message ?? ziweiRes.reason}`);
  }

  if (vedicRes.status === "fulfilled" && vedicRes.value.vedic) {
    charts.vedic = vedicRes.value.vedic;
  } else if (vedicRes.status === "rejected") {
    multiFailures.push(`印度: ${vedicRes.reason?.message ?? vedicRes.reason}`);
  }

  if (westernRes.status === "fulfilled" && westernRes.value.western) {
    charts.western = westernRes.value.western;
  } else if (westernRes.status === "rejected") {
    multiFailures.push(`西洋: ${westernRes.reason?.message ?? westernRes.reason}`);
  }

  if (arabicRes.status === "fulfilled" && arabicRes.value.arabic) {
    charts.arabic = arabicRes.value.arabic;
  } else if (arabicRes.status === "rejected") {
    multiFailures.push(`阿拉伯: ${arabicRes.reason?.message ?? arabicRes.reason}`);
  }

  // 汇总多术数标签
  const allTags = new Set<string>(charts.bazi.tags);
  if (charts.ziwei) charts.ziwei.tags.forEach((t) => allTags.add(t));
  if (charts.vedic) charts.vedic.tags.forEach((t) => allTags.add(t));
  if (charts.western) charts.western.tags.forEach((t) => allTags.add(t));
  if (charts.arabic) charts.arabic.tags.forEach((t) => allTags.add(t));
  charts.unifiedTags = Array.from(allTags);

  if (multiFailures.length > 0) {
    onProgress({
      type: "progress",
      step: "STEP 1.5",
      message: `部分术数不可用（继续分析）：${multiFailures.join("；")}`,
    });
  }

  onProgress({
    type: "charts",
    data: charts,
  });

  // ============ STEP 1.6: RAG + 多源搜索（补充知识上下文） ============
  onProgress({
    type: "progress",
    step: "STEP 1.6",
    message: "正在检索命理知识库 + 多源搜索…",
  });

  const promptCtx: PromptContext = {};

  // RAG：用多术数标签作为查询
  try {
    const ragRes = await callRagSearch(charts.unifiedTags, { topK: 6 });
    if (ragRes.hits.length > 0) {
      promptCtx.ragHits = ragRes.hits.map((h) => ({
        system: h.entry.system,
        title: h.entry.title,
        text: h.entry.text,
        source: h.entry.source,
      }));
    }
  } catch (err) {
    onProgress({
      type: "progress",
      step: "STEP 1.6",
      message: `RAG 不可用，继续：${(err as Error).message}`,
    });
  }

  // 多源搜索：基于命主日主 + Lagna/上升 等关键标签
  const searchQuery = [
    charts.bazi.dayMaster,
    charts.ziwei?.soulPalaceStar,
    charts.vedic?.lagna,
    charts.western ? "上升" : "",
  ]
    .filter(Boolean)
    .slice(0, 4)
    .join(" ");

  try {
    const searchRes = await callMultiSearch(searchQuery, { limit: 5 });
    if (searchRes.hits.length > 0) {
      promptCtx.searchHits = searchRes.hits.map((h) => ({
        title: h.title,
        url: h.url,
        snippet: h.snippet,
        source: h.source,
      }));
    }
  } catch (err) {
    onProgress({
      type: "progress",
      step: "STEP 1.6",
      message: `多源搜索不可用，继续：${(err as Error).message}`,
    });
  }

  // ============ STEP 2: 人生总分析 ============
  onProgress({ type: "progress", step: "STEP 2", message: "正在生成人生总分析…" });
  try {
    const lifeAnalysis = await callLLM({
      messages: [
        { role: "system", content: SYSTEM_PROMPT_BASE },
        { role: "user", content: buildLifeAnalysisPrompt(charts, promptCtx) },
      ],
      temperature: 0.7,
      responseFormat: { type: "json_object" },
    });
    sections.life = lifeAnalysis;
    onProgress({ type: "analysis", section: "人生总分析", content: lifeAnalysis });
  } catch (err) {
    const fallback = JSON.stringify({
      error: "LLM 不可用",
      message: (err as Error).message,
      baziSummary: charts.bazi,
    });
    sections.life = fallback;
    onProgress({
      type: "analysis",
      section: "人生总分析",
      content: fallback,
    });
  }

  // ============ STEP 3: 年度运势 ============
  const now = new Date();
  const year = now.getFullYear();
  onProgress({
    type: "progress",
    step: "STEP 3",
    message: `正在生成 ${year} 年度事件级运势…`,
  });
  try {
    const yearly = await callLLM({
      messages: [
        { role: "system", content: SYSTEM_PROMPT_BASE },
        { role: "user", content: buildYearlyFortunePrompt(charts, year, promptCtx) },
      ],
      temperature: 0.7,
      responseFormat: { type: "json_object" },
    });
    sections.yearly = yearly;
    onProgress({ type: "analysis", section: `${year} 年度运势`, content: yearly });
  } catch (err) {
    const fallback = JSON.stringify({
      error: "LLM不可用",
      message: (err as Error).message,
    });
    sections.yearly = fallback;
    onProgress({ type: "analysis", section: `${year} 年度运势`, content: fallback });
  }

  // ============ STEP 4: 月度运势 ============
  const month = now.getMonth() + 1;
  onProgress({
    type: "progress",
    step: "STEP 4",
    message: `正在生成 ${year} 年 ${month} 月事件级运势…`,
  });
  try {
    const monthly = await callLLM({
      messages: [
        { role: "system", content: SYSTEM_PROMPT_BASE },
        { role: "user", content: buildMonthlyFortunePrompt(charts, year, month, promptCtx) },
      ],
      temperature: 0.7,
      responseFormat: { type: "json_object" },
    });
    sections.monthly = monthly;
    onProgress({
      type: "analysis",
      section: `${year} 年 ${month} 月运势`,
      content: monthly,
    });
  } catch (err) {
    const fallback = JSON.stringify({
      error: "LLM不可用",
      message: (err as Error).message,
    });
    sections.monthly = fallback;
    onProgress({ type: "analysis", section: `${year} 年 ${month} 月运势`, content: fallback });
  }

  // ============ STEP 5: 未来 7 天每日运势 ============
  onProgress({
    type: "progress",
    step: "STEP 5",
    message: "正在生成未来 7 天每日事件级运势…",
  });
  const dailyResults: string[] = [];
  for (let i = 0; i < 7; i++) {
    try {
      const daily = await callLLM({
        messages: [
          { role: "system", content: SYSTEM_PROMPT_BASE },
          { role: "user", content: buildDailyFortunePrompt(charts, now, i, promptCtx) },
        ],
        temperature: 0.7,
        responseFormat: { type: "json_object" },
      });
      dailyResults.push(daily);
      onProgress({
        type: "analysis",
        section: `每日运势 #${i + 1}`,
        content: daily,
      });
      onProgress({
        type: "progress",
        step: "STEP 5",
        message: `已完成 ${i + 1}/7 天`,
      });
    } catch (err) {
      const fallback = JSON.stringify({
        error: "LLM不可用",
        dayOffset: i,
        message: (err as Error).message,
      });
      dailyResults.push(fallback);
      onProgress({ type: "analysis", section: `每日运势 #${i + 1}`, content: fallback });
    }
  }
  sections.daily = `[${dailyResults.join(",")}]`;

  // ============ DONE ============
  onProgress({
    type: "done",
    analysisId,
    tokens: 0,
  });

  return { charts, sections };
}

/**
 * 异步启动流水线，将事件发布到 EventBus
 */
export function startPipeline(
  input: PaipanInput,
  analysisId: string,
): Promise<unknown> {
  return runAnalysisPipeline(input, analysisId, (event) => {
    eventBus.publish(analysisId, event);
  });
}
