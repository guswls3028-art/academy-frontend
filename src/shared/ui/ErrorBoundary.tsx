// PATH: src/shared/ui/ErrorBoundary.tsx
import { Component, type ErrorInfo, type ReactNode } from "react";
import * as Sentry from "@sentry/react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);

    // 배포 후 chunk hash 불일치 — 자동 리로드 (10초 내 1회 제한)
    const isChunkError =
      error.message?.includes("dynamically imported module") ||
      error.message?.includes("Failed to fetch") ||
      error.message?.includes("Loading chunk") ||
      error.message?.includes("Loading CSS chunk");
    if (isChunkError) {
      const key = "chunk_reload_ts";
      const last = Number(sessionStorage.getItem(key) || "0");
      if (Date.now() - last > 10_000) {
        sessionStorage.setItem(key, String(Date.now()));
        window.location.reload();
        return;
      }
    }

    // Sentry에 에러 보고 (DSN 설정 시에만 동작)
    Sentry.captureException(error, {
      contexts: { react: { componentStack: info.componentStack || "" } },
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            height: "100vh",
            gap: 16,
            fontFamily: "sans-serif",
            color: "#333",
          }}
        >
          <p style={{ fontSize: 18, margin: 0 }}>
            오류가 발생했습니다. 페이지를 새로고침해 주세요.
          </p>
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
        </div>
      );
    }
    return this.props.children;
  }
}
