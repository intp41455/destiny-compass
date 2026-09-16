import type { SSEEvent } from "./types.js";

const CLEANUP_DELAY_MS = 5 * 60 * 1000;

interface EventEntry {
  history: SSEEvent[];
  subscribers: Set<(e: SSEEvent) => void>;
  terminated: boolean;
  timer: ReturnType<typeof setTimeout> | null;
  started: boolean;
}

const store = new Map<string, EventEntry>();

export function ensureEntry(analysisId: string): EventEntry {
  let entry = store.get(analysisId);
  if (!entry) {
    entry = { history: [], subscribers: new Set(), terminated: false, timer: null, started: false };
    store.set(analysisId, entry);
  }
  return entry;
}

export function markStarted(analysisId: string): boolean {
  const entry = ensureEntry(analysisId);
  if (entry.started) return false;
  entry.started = true;
  return true;
}

export function publishEvent(analysisId: string, event: SSEEvent): void {
  const entry = ensureEntry(analysisId);

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
  const entry = ensureEntry(analysisId);

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
      if (entry.timer) clearTimeout(entry.timer);
      store.delete(analysisId);
    }
  };
}
