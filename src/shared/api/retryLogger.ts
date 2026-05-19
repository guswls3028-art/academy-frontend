// PATH: src/shared/api/retryLogger.ts
// Structured logging for video retry (Batch-only). No PII.

const LOG_PREFIX = "[video-retry]";

declare global {
  interface Window {
    __VIDEO_RETRY_DEBUG__?: boolean;
  }
}

function isDebugEnabled(): boolean {
  return import.meta.env.DEV || (typeof window !== "undefined" && window.__VIDEO_RETRY_DEBUG__ === true);
}

export function logRetryAttempt(videoId: number): void {
  try {
    if (isDebugEnabled()) {
      console.info(LOG_PREFIX, "attempt", { videoId });
    }
  } catch {
    // no-op
  }
}

export function logRetrySuccess(videoId: number): void {
  try {
    if (isDebugEnabled()) {
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
