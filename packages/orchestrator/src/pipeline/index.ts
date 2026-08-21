import type { ChartsResult, PaipanInput, SSEEvent } from "@destiny/shared";
import { callBaziPaipan, callLLM } from "../mcp-client/index.js";
import { eventBus } from "../event-bus.js";
import {
  buildLifeAnalysisPrompt,
  buildYearlyFortunePrompt,
  buildMonthlyFortunePrompt,
  buildDailyFortunePrompt,
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

  // ============ STEP 1: 排盘 ============
  onProgress({ type: "progress", step: "STEP 1", message: "正在调用真太阳时 + 八字排盘服务…" });
  let charts: ChartsResult;
  try {
    charts = await callBaziPaipan(input);
  } catch (err) {
    onProgress({
      type: "error",
      step: "STEP 1",
      message: `排盘失败: ${(err as Error).message}`,
    });
    throw err;
  }

  onProgress({
    type: "charts",
    data: {
      ...charts,
      unifiedTags: charts.bazi.tags,
    } as ChartsResult,
  });

  // ============ STEP 2: 人生总分析 ============
  onProgress({ type: "progress", step: "STEP 2", message: "正在生成人生总分析…" });
  try {
    const lifeAnalysis = await callLLM({
      messages: [
        { role: "system", content: SYSTEM_PROMPT_BASE },
        { role: "user", content: buildLifeAnalysisPrompt(charts) },
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
        { role: "user", content: buildYearlyFortunePrompt(charts, year) },
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
        { role: "user", content: buildMonthlyFortunePrompt(charts, year, month) },
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
          { role: "user", content: buildDailyFortunePrompt(charts, now, i) },
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
