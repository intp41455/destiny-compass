import type { SSEEvent } from "@destiny/shared";

/**
 * 进程内 SSE 事件总线（单例）
 *
 * 解决 plan 中 routes/analyze.ts 与 routes/stream.ts 各自维护独立 Map
 * 导致事件互不通气的问题：analyze 启动流水线后无法把事件推送给
 * 已连接的 stream 订阅者。改为统一通过 EventBus 中转。
 *
 * 行为：
 *  - publish: 推送一个事件给当前订阅者；若无订阅者则缓存到历史队列
 *  - subscribe: 订阅某个 analysisId 的事件流，先回放历史，再实时接收
 *  - terminate: 流水线结束时调用，让订阅者关闭
 */
class EventBus {
  private history = new Map<string, SSEEvent[]>();
  private subscribers = new Map<string, Set<(e: SSEEvent) => void>>();
  private terminated = new Set<string>();

  publish(analysisId: string, event: SSEEvent): void {
    // 终止后不再缓存（避免内存泄漏）
    if (!this.terminated.has(analysisId)) {
      const queue = this.history.get(analysisId) ?? [];
      queue.push(event);
      this.history.set(analysisId, queue);
    }

    const subs = this.subscribers.get(analysisId);
    if (subs && subs.size > 0) {
      for (const cb of subs) {
        try {
          cb(event);
        } catch {
          // 单个订阅者出错不应影响其他订阅者
        }
      }
    }

    // done / error 事件触发终止
    if (event.type === "done" || event.type === "error") {
      this.markTerminated(analysisId);
    }
  }

  subscribe(
    analysisId: string,
    callback: (e: SSEEvent) => void,
  ): () => void {
    let subs = this.subscribers.get(analysisId);
    if (!subs) {
      subs = new Set();
      this.subscribers.set(analysisId, subs);
    }
    subs.add(callback);

    // 立即回放历史事件
    const history = this.history.get(analysisId) ?? [];
    for (const evt of history) {
      try {
        callback(evt);
      } catch {
        // 忽略回放错误
      }
    }

    // 取消订阅
    return () => {
      subs?.delete(callback);
      if (subs && subs.size === 0) {
        this.subscribers.delete(analysisId);
      }
    };
  }

  isTerminated(analysisId: string): boolean {
    return this.terminated.has(analysisId);
  }

  /**
   * 标记某个 analysisId 终止：保留历史一段时间以便晚到的客户端取回结果，
   * 然后延迟清理。
   */
  markTerminated(analysisId: string): void {
    this.terminated.add(analysisId);
    // 5 分钟后清理历史与终止标记
    setTimeout(() => {
      this.history.delete(analysisId);
      this.terminated.delete(analysisId);
      this.subscribers.delete(analysisId);
    }, 5 * 60 * 1000);
  }
}

export const eventBus = new EventBus();
