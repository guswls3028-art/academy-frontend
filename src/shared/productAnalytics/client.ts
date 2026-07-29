import api from "@/shared/api/axios";
import {
  getSessionItem,
  removeSessionItem,
  setSessionItem,
} from "@/shared/utils/safeSessionStorage";
import { PRODUCT_ANALYTICS_CATALOG_VERSION } from "./featureRegistry";
import type {
  ProductAnalyticsDevice,
  ProductUsageEvent,
  ProductUsageInput,
} from "./types";

const SESSION_KEY = "product_analytics_session_id";
const FLUSH_MS = 5_000;
const BATCH_SIZE = 10;
const MAX_QUEUE_SIZE = 100;

type QueuedEvent = {
  event: ProductUsageEvent;
  attempts: number;
};

let queue: QueuedEvent[] = [];
let flushTimer: number | null = null;
let flushing = false;

function randomId(): string {
  return crypto.randomUUID();
}

function getSessionId(): string {
  const existing = getSessionItem(SESSION_KEY);
  if (existing) return existing;
  const created = randomId();
  setSessionItem(SESSION_KEY, created);
  return created;
}

function deviceClass(): ProductAnalyticsDevice {
  const width = window.innerWidth;
  if (width < 768) return "mobile";
  if (width < 1100) return "tablet";
  return "desktop";
}

function scheduleFlush(delay = FLUSH_MS) {
  if (flushTimer !== null || queue.length === 0) return;
  flushTimer = window.setTimeout(() => {
    flushTimer = null;
    void flushProductUsage();
  }, delay);
}

export function resetProductAnalyticsSession() {
  queue = [];
  if (flushTimer !== null) {
    window.clearTimeout(flushTimer);
    flushTimer = null;
  }
  removeSessionItem(SESSION_KEY);
}

if (typeof window !== "undefined") {
  window.addEventListener(
    "product-analytics-session-reset",
    resetProductAnalyticsSession,
  );
}

export function trackProductUsage(input: ProductUsageInput): string {
  const eventId = randomId();
  queue.push({
    attempts: 0,
    event: {
      ...input,
      event_id: eventId,
      occurred_at: new Date().toISOString(),
      session_id: getSessionId(),
      device_class: deviceClass(),
      client_release:
        import.meta.env.VITE_GIT_SHA
        || import.meta.env.VITE_BUILD_VERSION
        || import.meta.env.VITE_APP_VERSION
        || "dev",
      catalog_version: PRODUCT_ANALYTICS_CATALOG_VERSION,
      synthetic:
        import.meta.env.VITE_PRODUCT_ANALYTICS_SYNTHETIC === "true",
    },
  });
  if (queue.length > MAX_QUEUE_SIZE) {
    queue = queue.slice(-MAX_QUEUE_SIZE);
  }
  if (queue.length >= BATCH_SIZE) {
    void flushProductUsage();
  } else {
    scheduleFlush();
  }
  return eventId;
}

export async function flushProductUsage(): Promise<void> {
  if (flushing || queue.length === 0) return;
  flushing = true;
  const batch = queue.splice(0, 20);
  try {
    await api.post(
      "/core/product-analytics/events/batch/",
      {
        schema_version: 1,
        events: batch.map((item) => item.event),
      },
      { timeout: 4_000 },
    );
  } catch {
    const retry = batch
      .filter((item) => item.attempts === 0)
      .map((item) => ({ ...item, attempts: 1 }));
    queue = [...retry, ...queue].slice(0, MAX_QUEUE_SIZE);
  } finally {
    flushing = false;
    scheduleFlush();
  }
}
