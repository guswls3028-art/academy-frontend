// PATH: src/shared/ui/ErrorBoundary.tsx
import { Component, type ErrorInfo, type ReactNode } from "react";
import * as Sentry from "@sentry/react";

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

function safeSet(key: string, v: string): void {
  try {
    sessionStorage.setItem(key, v);
  } catch {
    /* ignore */
  }
}

function isChunkLoadError(error: Error): boolean {
  const m = error?.message || "";
  return (
    m.includes("dynamically imported module") ||
    m.includes("Failed to fetch") ||
    m.includes("Loading chunk") ||
    m.includes("Loading CSS chunk")
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
    const isChunk = isChunkLoadError(error);

    console.error(
      "[ErrorBoundary]",
      { url, tenantCode, errorName: error.name, isChunk },
      error,
      info.componentStack,
    );

    const key = isChunk ? CHUNK_RELOAD_KEY : GENERIC_RELOAD_KEY;
    const cooldown = isChunk ? CHUNK_RELOAD_COOLDOWN_MS : GENERIC_RELOAD_COOLDOWN_MS;
    const last = Number(safeGet(key) || "0");
    const canReload = Date.now() - last > cooldown;

    if (canReload) {
      safeSet(key, String(Date.now()));
      window.location.reload();
      return;
    }

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
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            height: "100vh",
            gap: 12,
            padding: 24,
            fontFamily: "sans-serif",
            color: "#333",
            textAlign: "center",
          }}
        >
          <p style={{ fontSize: 18, margin: 0 }}>
            오류가 발생했습니다. 페이지를 새로고침해 주세요.
          </p>
          {recurred && (
            <p style={{ fontSize: 13, color: "#888", margin: 0, maxWidth: 420 }}>
              문제가 계속되면 관리자에게 문의해 주세요.
            </p>
          )}
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: "8px 24px",
              fontSize: 14,
              border: "1px solid #ccc",
              borderRadius: 6,
              background: "#fff",
              cursor: "pointer",
            }}
          >
            새로고침
          </button>
          {recurred && errorMessage && (
            <code
              style={{
                marginTop: 8,
                padding: "6px 10px",
                fontSize: 11,
                color: "#aaa",
                background: "#f7f7f7",
                borderRadius: 4,
                maxWidth: 520,
                overflowWrap: "anywhere",
              }}
            >
              {errorMessage}
            </code>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}
