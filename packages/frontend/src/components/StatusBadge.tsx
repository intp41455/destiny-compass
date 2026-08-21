import { useState, useEffect } from "react";
import { getStatus, type ServiceStatus } from "../api/client";

const MCP_LABELS: Record<string, string> = {
  BAZI: "八字排盘",
  ZIWEI: "紫微斗数",
  VEDIC: "印度占星",
  WESTERN: "古典占星",
  ARABIC: "阿拉伯占星",
  RAG: "命理 RAG 库",
  SEARCH: "多源搜索",
  LLM: "LLM 网关",
};

export function StatusBadge() {
  const [services, setServices] = useState<ServiceStatus[]>([]);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  useEffect(() => {
    const fetchStatus = () => {
      getStatus()
        .then((d) => {
          setServices(d.services);
          setLastUpdate(new Date());
        })
        .catch(() => {
          // 静默失败
        });
    };
    fetchStatus();
    const interval = setInterval(fetchStatus, 10_000);
    return () => clearInterval(interval);
  }, []);

  const onlineCount = services.filter((s) => s.status === "online").length;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-zinc-500">
        <span>
          在线 <span className="text-green-600 dark:text-green-400">{onlineCount}</span> / {services.length}
        </span>
        {lastUpdate && (
          <span className="text-zinc-400">
            {lastUpdate.toLocaleTimeString("zh-CN", { hour12: false })}
          </span>
        )}
      </div>

      <div className="space-y-1">
        {services.length === 0 && (
          <div className="text-xs text-zinc-400">正在检测服务状态…</div>
        )}
        {services.map((s) => (
          <div
            key={s.name}
            className="flex items-center justify-between text-xs py-0.5"
          >
            <span className="text-zinc-700 dark:text-zinc-300">
              {MCP_LABELS[s.name] ?? s.name}
              <span className="text-zinc-400 ml-1">:{s.port}</span>
            </span>
            <span
              className={
                s.status === "online"
                  ? "text-green-600 dark:text-green-400"
                  : "text-zinc-400"
              }
            >
              ● {s.status === "online" ? "在线" : "离线"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
