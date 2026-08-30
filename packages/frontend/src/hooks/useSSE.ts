import { useState, useCallback, useRef, useEffect } from "react";

/** SSE 事件类型与编排层 SSEEvent 对齐 */
export interface SSEEvent {
  type: "progress" | "charts" | "analysis" | "done" | "error";
  [key: string]: unknown;
}

export interface SSEState {
  events: SSEEvent[];
  isConnected: boolean;
  isDone: boolean;
  error: string | null;
  connect: (analysisId: string) => void;
  reset: () => void;
}

/**
 * SSE 订阅 Hook
 *
 * 行为：
 *  - connect(id) 关闭旧连接、清空状态、新建 EventSource
 *  - 收到 progress/charts/analysis/done/error 事件统一压入 events 数组
 *  - 收到 done/error 后自动关闭连接
 *  - 组件卸载时关闭连接
 */
export function useSSE(): SSEState {
  const [events, setEvents] = useState<SSEEvent[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const closeCurrent = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, []);

  const connect = useCallback(
    (analysisId: string) => {
      closeCurrent();
      setEvents([]);
      setIsDone(false);
      setError(null);
      setIsConnected(true);

      const es = new EventSource(`/api/stream/${analysisId}`);
      eventSourceRef.current = es;

      const handle = (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data) as SSEEvent;
          setEvents((prev) => [...prev, data]);
          if (data.type === "done" || data.type === "error") {
            setIsDone(true);
            setIsConnected(false);
            if (data.type === "error") {
              setError(String(data.message ?? "未知错误"));
            }
            es.close();
            eventSourceRef.current = null;
          }
        } catch (err) {
          console.warn("SSE parse error", err, e.data);
        }
      };

      // 显式监听具名事件（后端用 event: <type> 字段分发）
      ["progress", "charts", "analysis", "done", "error"].forEach((type) =>
        es.addEventListener(type, handle as EventListener)
      );

      // 连接级错误（如网络断开）
      es.onerror = () => {
        setIsConnected(false);
        if (!isDone) {
          setError("SSE 连接中断，请刷新重试");
        }
      };
    },
    [closeCurrent]
  );

  const reset = useCallback(() => {
    closeCurrent();
    setEvents([]);
    setIsConnected(false);
    setIsDone(false);
    setError(null);
  }, [closeCurrent]);

  useEffect(() => closeCurrent, [closeCurrent]);

  return { events, isConnected, isDone, error, connect, reset };
}
