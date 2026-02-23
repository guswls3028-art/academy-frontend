// PATH: src/shared/api/retryLogger.ts
// Structured logging for video retry (Batch-only). No PII.

const LOG_PREFIX = "[video-retry]";

export function logRetryAttempt(videoId: number): void {
  try {
    if (import.meta.env.DEV || (typeof window !== "undefined" && (window as any).__VIDEO_RETRY_DEBUG__)) {
      console.info(LOG_PREFIX, "attempt", { videoId });
    }
  } catch {
    // no-op
  }
}

export function logRetrySuccess(videoId: number): void {
  try {
    if (import.meta.env.DEV || (typeof window !== "undefined" && (window as any).__VIDEO_RETRY_DEBUG__)) {
      console.info(LOG_PREFIX, "success", { videoId });
    }
  } catch {
    // no-op
  }
}

export function logRetryError(videoId: number, message: string): void {
  try {
    console.warn(LOG_PREFIX, "error", { videoId, message });
  } catch {
    // no-op
  }
}
