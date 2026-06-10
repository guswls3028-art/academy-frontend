// PATH: src/shared/ui/ErrorBoundary.tsx
import { Component, type ErrorInfo, type ReactNode } from "react";
import * as Sentry from "@sentry/react";
import { hardReloadWithCacheBust } from "@/shared/utils/hardReload";
import styles from "./ErrorBoundary.module.css";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  recurred: boolean;
  errorMessage: string;
}

/**
 * 자동 리로드 쿨다운 — 같은 세션에서 너무 잦게 reload 되는 무한 루프 방지.
 * chunk 에러는 배포 직후 흔하므로 짧게, 일반 에러는 길게.
 */
const CHUNK_RELOAD_COOLDOWN_MS = 10_000;
const GENERIC_RELOAD_COOLDOWN_MS = 30_000;
const CHUNK_RELOAD_KEY = "chunk_reload_ts";
const GENERIC_RELOAD_KEY = "eb_reload_ts";

function safeGet(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function hasRecentReload(key: string, cooldownMs: number): boolean {
  const lastReload = Number(safeGet(key) || "0");
  return Number.isFinite(lastReload) && Date.now() - lastReload < cooldownMs;
}

function isChunkLoadError(error: Error, info?: ErrorInfo): boolean {
  const m = error?.message || "";
  const stack = error?.stack || "";
  const componentStack = info?.componentStack || "";
  return (
    m.includes("dynamically imported module") ||
    m.includes("Importing a module script failed") ||
    m.includes("Failed to fetch") ||
    m.includes("Loading chunk") ||
    m.includes("Loading CSS chunk") ||
    m.includes("LAZY_DEFAULT_UNDEFINED") ||
    stack.includes("dynamically imported module") ||
    stack.includes("Importing a module script failed") ||
    ((m === "Error" || m === "") && componentStack.includes("Lazy"))
  );
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, recurred: false, errorMessage: "" };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, recurred: false, errorMessage: error?.message || "" };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    const url = typeof window !== "undefined" ? window.location.href : "";
    const tenantCode = safeGet("tenantCode");
    const isChunk = isChunkLoadError(error, info);

    const key = isChunk ? CHUNK_RELOAD_KEY : GENERIC_RELOAD_KEY;
    const cooldown = isChunk ? CHUNK_RELOAD_COOLDOWN_MS : GENERIC_RELOAD_COOLDOWN_MS;
    if (hardReloadWithCacheBust({ key, cooldownMs: cooldown })) {
      return;
    }
    if (isChunk && hasRecentReload(CHUNK_RELOAD_KEY, CHUNK_RELOAD_COOLDOWN_MS)) {
      return;
    }

    console.error(
      "[ErrorBoundary]",
      { url, tenantCode, errorName: error.name, isChunk },
      error,
      info.componentStack,
    );

    // 쿨다운 이내에 재발생 — 자동 복구 실패. 사용자에게 원본 정보 노출.
    this.setState({ recurred: true });

    Sentry.captureException(error, {
      tags: { recurred: "true", chunk: String(isChunk) },
      contexts: {
        react: { componentStack: info.componentStack || "" },
        app: { url, tenantCode: tenantCode || "unknown" },
      },
    });
  }

  render() {
    if (this.state.hasError) {
      const { recurred, errorMessage } = this.state;
      return (
        <div className={styles.root}>
          <p className={styles.message}>
            오류가 발생했습니다. 페이지를 새로고침해 주세요.
          </p>
          {recurred && (
            <p className={styles.hint}>
              문제가 계속되면 관리자에게 문의해 주세요.
            </p>
          )}
          <button
            onClick={() => hardReloadWithCacheBust({ key: "manual_reload_ts", cooldownMs: 0 })}
            className={styles.button}
          >
            새로고침
          </button>
          {recurred && errorMessage && (
            <code className={styles.errorCode}>
              {errorMessage}
            </code>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}
