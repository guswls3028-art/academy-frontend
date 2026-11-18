// PATH: src/shared/ui/ErrorBoundary.tsx
import { Component, type ErrorInfo, type ReactNode } from "react";
import * as Sentry from "@sentry/react";
import { hardReloadWithCacheBust } from "@/shared/utils/hardReload";
import { isChunkLoadError } from "@/shared/utils/chunkLoadError";
import { sanitizeObservabilityPath } from "@/shared/lib/sentryContext";
import { reportClientException } from "@/shared/lib/userIncidentReporter";
import ErrorRecoveryScreen from "./ErrorRecoveryScreen";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  recovering: boolean;
  sentryEventId?: string;
}

/**
 * 자동 리로드 쿨다운 — 같은 세션에서 너무 잦게 reload 되는 무한 루프 방지.
 * chunk 에러는 배포 직후 흔하므로 짧게, 일반 에러는 길게.
 */
const CHUNK_RELOAD_COOLDOWN_MS = 10_000;
const GENERIC_RELOAD_COOLDOWN_MS = 30_000;
const CHUNK_RELOAD_KEY = "chunk_reload_ts";
const CHUNK_RETRY_COUNT_KEY = "chunk_reload_retry_count";
const CHUNK_RETRY_WINDOW_KEY = "chunk_reload_retry_window_ts";
const CHUNK_RETRY_WINDOW_MS = 2 * 60_000;
const MAX_CHUNK_AUTO_RETRIES = 6;
const GENERIC_RELOAD_KEY = "eb_reload_ts";

function safeGet(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): void {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

function hasRecentReload(key: string, cooldownMs: number): boolean {
  const lastReload = Number(safeGet(key) || "0");
  return Number.isFinite(lastReload) && Date.now() - lastReload < cooldownMs;
}

function scheduleChunkRecovery(): boolean {
  const now = Date.now();
  const lastReload = Number(safeGet(CHUNK_RELOAD_KEY) || "0");
  let windowStartedAt = Number(safeGet(CHUNK_RETRY_WINDOW_KEY) || "0");
  let retryCount = Number(safeGet(CHUNK_RETRY_COUNT_KEY) || "0");

  if (!Number.isFinite(windowStartedAt) || now - windowStartedAt >= CHUNK_RETRY_WINDOW_MS) {
    windowStartedAt = now;
    retryCount = 0;
    safeSet(CHUNK_RETRY_WINDOW_KEY, String(windowStartedAt));
  }
  if (!Number.isFinite(retryCount) || retryCount >= MAX_CHUNK_AUTO_RETRIES) return false;

  safeSet(CHUNK_RETRY_COUNT_KEY, String(retryCount + 1));
  const delay = Math.max(750, CHUNK_RELOAD_COOLDOWN_MS - (now - lastReload) + 250);
  window.setTimeout(() => {
    hardReloadWithCacheBust({ key: CHUNK_RELOAD_KEY, cooldownMs: CHUNK_RELOAD_COOLDOWN_MS });
  }, delay);
  return true;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, recovering: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true, recovering: false };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    const url = typeof window !== "undefined" ? sanitizeObservabilityPath(window.location.href) : "";
    const tenantCode = safeGet("tenantCode");
    const isChunk = isChunkLoadError(error, info.componentStack || "");

    const key = isChunk ? CHUNK_RELOAD_KEY : GENERIC_RELOAD_KEY;
    const cooldown = isChunk ? CHUNK_RELOAD_COOLDOWN_MS : GENERIC_RELOAD_COOLDOWN_MS;
    if (hardReloadWithCacheBust({ key, cooldownMs: cooldown })) {
      return;
    }
    if (isChunk && hasRecentReload(CHUNK_RELOAD_KEY, CHUNK_RELOAD_COOLDOWN_MS)) {
      if (scheduleChunkRecovery()) {
        this.setState({ recovering: true });
        return;
      }
    }

    console.error(
      "[ErrorBoundary]",
      { url, tenantCode, errorName: error.name, isChunk },
      error,
      info.componentStack,
    );

    const eventId = Sentry.captureException(error, {
      tags: { recurred: "true", chunk: String(isChunk) },
      contexts: {
        react: { componentStack: info.componentStack || "" },
        app: { url, tenantCode: tenantCode || "unknown" },
      },
    });
    this.setState({ sentryEventId: eventId });
    reportClientException(error.name || "ReactError", {
      route: url,
      sentryEventId: eventId,
      confirmedPersistent: true,
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <ErrorRecoveryScreen
          recovering={this.state.recovering}
          route={window.location.pathname}
          sentryEventId={this.state.sentryEventId}
          onReload={() => {
            if (!hardReloadWithCacheBust({ key: "manual_reload_ts", cooldownMs: 0 })) {
              window.location.reload();
            }
          }}
        />
      );
    }
    return this.props.children;
  }
}
