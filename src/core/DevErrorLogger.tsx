/* eslint-disable no-restricted-syntax */
// PATH: src/app/DevErrorLogger.tsx
// 개발/스테이징에서 React 에러(예: #310) 발생 시 전체 메시지 + 컴포넌트 스택을 콘솔에 출력.
// 로컬에서 영상 재현이 어려울 때, 배포 환경에서 재현 후 콘솔 로그로 원인 확인용.

import React, { useEffect } from "react";

const PREFIX = "[React Error #310 Debug]";

export function DevErrorLogger({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      const msg = event.message || "";
      if (msg.includes("310") || msg.includes("Maximum update depth") || msg.includes("Minified React error")) {
        console.error(
          `${PREFIX} Caught:\n  message: ${event.message}\n  filename: ${event.filename}\n  lineno: ${event.lineno}\n  colno: ${event.colno}\n  stack: ${event.error?.stack ?? "(no stack)"}`
        );
      }
    };

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const msg = typeof reason === "object" && reason?.message ? String(reason.message) : String(reason);
      if (msg.includes("310") || msg.includes("Maximum update depth")) {
        console.error(`${PREFIX} UnhandledRejection:\n  ${msg}\n  stack: ${reason?.stack ?? "(no stack)"}`);
      }
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }, []);

  return <>{children}</>;
}

/** React 에러(예: #310) 잡아서 콘솔에 스택 출력. 배포에서도 동작 → 재현 후 F12 콘솔만 보면 됨 */
export class DevErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null; errorInfo: React.ErrorInfo | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState((s) => ({ ...s, errorInfo }));
    const is310 =
      /310|Maximum update depth|Minified React error/i.test(error.message);
    if (is310) {
      console.error(
        `${PREFIX} (배포에서도 찍힘)\n  message: ${error.message}\n  componentStack:\n${errorInfo.componentStack ?? "(없음)"}`
      );
    }
  }

  render() {
    if (this.state.hasError && this.state.error) {
      if (import.meta.env.DEV) {
        return (
          <div style={{ padding: 16, background: "#1e1e1e", color: "#fff", fontFamily: "monospace", fontSize: 12 }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>{PREFIX} (개발 모드)</div>
            <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-all" }}>{this.state.error.message}</pre>
            {this.state.errorInfo?.componentStack && (
              <pre style={{ marginTop: 8, whiteSpace: "pre-wrap" }}>{this.state.errorInfo.componentStack}</pre>
            )}
          </div>
        );
      }
      return (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "60vh",
            padding: "32px 24px",
            gap: 14,
            textAlign: "center",
            color: "#374151",
            fontFamily: "'Pretendard Variable', 'Pretendard', system-ui, sans-serif",
          }}
        >
          <div style={{ fontSize: 32 }} aria-hidden>⚠️</div>
          <p style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "#1f2937" }}>
            화면을 표시하지 못했어요.
          </p>
          <p style={{ margin: 0, fontSize: 13.5, color: "#6b7280", maxWidth: 360, lineHeight: 1.55 }}>
            새로고침하면 대부분 해결됩니다. 문제가 계속되면 상담문의로 알려주세요.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              marginTop: 4,
              padding: "9px 22px",
              fontSize: 13.5,
              fontWeight: 600,
              border: "none",
              borderRadius: 8,
              background: "#2563eb",
              color: "#fff",
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
