import { useState, useEffect, useMemo } from "react";
import { InputForm } from "./components/InputForm";
import { BaziChart } from "./components/BaziChart";
import { StatusBadge } from "./components/StatusBadge";
import { ProgressTimeline } from "./components/ProgressTimeline";
import { AnalysisSection } from "./components/AnalysisSection";
import { DailyFortuneList } from "./components/DailyFortuneList";
import { useSSE } from "./hooks/useSSE";
import { startAnalysis, type PaipanInput } from "./api/client";

interface ChartsData {
  meta: {
    birthday: string;
    solarTimeCorrected: string;
    trueSolarOffsetMin: number;
    gender: "male" | "female";
    lat: number;
    lng: number;
    timezone: string;
    locationName: string;
  };
  bazi: {
    pillars: { year: string; month: string; day: string; hour: string };
    dayMaster: string;
    tenGods: Record<string, string>;
    hiddenStems: Record<string, string[]>;
    nayin: string;
    dayun: { startAge: number; endAge?: number; stems: string[] }[];
    shensha: string[];
    tags: string[];
  };
  unifiedTags: string[];
}

export default function App() {
  const [loading, setLoading] = useState(false);
  const [charts, setCharts] = useState<ChartsData | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const { events, isConnected, isDone, error, connect } = useSSE();

  // 按 section 收集 analysis 事件（同一 section 可能被多次推送，取最新）
  const analysisSections = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of events) {
      if (e.type === "analysis" && typeof e.section === "string" && typeof e.content === "string") {
        map.set(e.section, e.content);
      }
    }
    return map;
  }, [events]);

  const handleSubmit = async (input: PaipanInput) => {
    setLoading(true);
    setErrMsg(null);
    setCharts(null);
    try {
      const { analysisId } = await startAnalysis(input);
      connect(analysisId);
    } catch (err) {
      setErrMsg((err as Error).message);
      setLoading(false);
    }
  };

  useEffect(() => {
    if (events.length === 0) return;
    const latest = events[events.length - 1];
    if (latest.type === "charts" && latest.data) {
      setCharts(latest.data as ChartsData);
    }
    if (latest.type === "done" || latest.type === "error") {
      setLoading(false);
    }
  }, [events]);

  // 提取分段
  const lifeContent = analysisSections.get("人生总分析");
  const yearlyContent = useMemo(() => {
    for (const [key, val] of analysisSections) {
      if (key.includes("年度运势")) return { section: key, content: val };
    }
    return null;
  }, [analysisSections]);
  const monthlyContent = useMemo(() => {
    for (const [key, val] of analysisSections) {
      if (key.includes("月运势")) return { section: key, content: val };
    }
    return null;
  }, [analysisSections]);
  const dailyContents = useMemo(() => {
    const out: { section: string; content: string }[] = [];
    for (const [key, val] of analysisSections) {
      if (key.startsWith("每日运势")) out.push({ section: key, content: val });
    }
    return out;
  }, [analysisSections]);

  // 把 7 个 daily 合并成数组字符串给 DailyFortuneList
  const dailyAggregated = useMemo(() => {
    if (dailyContents.length === 0) return null;
    const arr = dailyContents.map((d) => {
      try {
        return JSON.parse(d.content);
      } catch {
        return { error: "parse", message: d.content.slice(0, 100) };
      }
    });
    return JSON.stringify(arr);
  }, [dailyContents]);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      <header className="border-b border-zinc-200 dark:border-zinc-800 px-6 py-3 flex items-center justify-between bg-white dark:bg-zinc-900 sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-brand-600" />
          <span className="font-medium">命理罗盘 · Destiny Compass</span>
          <span className="text-xs text-zinc-400 ml-2">v0.1 Phase 1</span>
        </div>
        <div className="text-xs text-zinc-500">
          {isConnected && <span className="text-green-600 dark:text-green-400">● SSE 已连接</span>}
          {!isConnected && isDone && <span className="text-zinc-400">分析完成</span>}
          {!isConnected && !isDone && loading && (
            <span className="text-brand-600 dark:text-brand-400">分析中…</span>
          )}
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[20rem_1fr] gap-4 p-4 max-w-7xl mx-auto">
        {/* 左侧：输入 + 状态 + 进度 */}
        <div className="space-y-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4">
            <h2 className="font-medium mb-3 text-sm">排盘输入</h2>
            <InputForm onSubmit={handleSubmit} loading={loading} />
          </div>

          {errMsg && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50 rounded-xl p-3 text-xs text-red-700 dark:text-red-300">
              {errMsg}
            </div>
          )}

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50 rounded-xl p-3 text-xs text-red-700 dark:text-red-300">
              SSE 错误：{error}
            </div>
          )}

          {events.length > 0 && (
            <ProgressTimeline events={events} isDone={isDone} />
          )}

          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4">
            <h2 className="font-medium mb-3 text-sm">系统状态</h2>
            <StatusBadge />
          </div>
        </div>

        {/* 右侧：命盘 + 分段分析 */}
        <div className="space-y-4">
          {charts ? (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6">
              <h2 className="font-medium mb-4 text-sm">命盘总览</h2>
              <BaziChart data={charts.bazi} meta={charts.meta} />
            </div>
          ) : (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-12 text-center text-zinc-400">
              <div className="text-4xl mb-3">☯</div>
              <div>请输入出生信息开始排盘</div>
              <div className="text-xs mt-2 text-zinc-500">
                真太阳时校准 + 八字四柱 + LLM 综合分析 + 事件级运势预测
              </div>
            </div>
          )}

          {lifeContent && (
            <AnalysisSection section="人生总分析" content={lifeContent} />
          )}

          {yearlyContent && (
            <AnalysisSection
              section={yearlyContent.section}
              content={yearlyContent.content}
            />
          )}

          {monthlyContent && (
            <AnalysisSection
              section={monthlyContent.section}
              content={monthlyContent.content}
            />
          )}

          {dailyAggregated && (
            <DailyFortuneList content={dailyAggregated} />
          )}
        </div>
      </div>

      <footer className="text-center text-xs text-zinc-400 py-4">
        Destiny Compass · Phase 1：八字排盘 + LLM 综合 · 数据为参考性质
      </footer>
    </div>
  );
}
