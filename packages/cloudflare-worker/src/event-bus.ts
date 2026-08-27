import type { SSEEvent } from "./types.js";

const CLEANUP_DELAY_MS = 5 * 60 * 1000;

// Worker 全局事件存储
interface EventEntry {
  history: SSEEvent[];
  subscribers: Set<(e: SSEEvent) => void>;
  terminated: boolean;
  timer: ReturnType<typeof setTimeout> | null;
}

const store = new Map<string, EventEntry>();

export function publishEvent(analysisId: string, event: SSEEvent): void {
  let entry = store.get(analysisId);
  if (!entry) {
    entry = { history: [], subscribers: new Set(), terminated: false, timer: null };
    store.set(analysisId, entry);
  }

  if (!entry.terminated) {
    entry.history.push(event);
  }

  for (const cb of entry.subscribers) {
    try {
      cb(event);
    } catch {
      // ignore subscriber errors
    }
  }

  if (event.type === "done" || event.type === "error") {
    entry.terminated = true;
    entry.timer = setTimeout(() => {
      store.delete(analysisId);
    }, CLEANUP_DELAY_MS);
  }
}

export function subscribeEvents(
  analysisId: string,
  callback: (e: SSEEvent) => void,
): () => void {
  const entry = store.get(analysisId);
  if (!entry) {
    return () => {};
  }

  entry.subscribers.add(callback);

  for (const evt of entry.history) {
    try {
      callback(evt);
    } catch {
      // ignore replay errors
    }
  }

  return () => {
    entry.subscribers.delete(callback);
    if (entry.subscribers.size === 0 && entry.terminated) {
      store.delete(analysisId);
    }
  };
}
