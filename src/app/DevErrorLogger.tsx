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

/** 개발 모드 전용: Error Boundary가 잡은 에러의 componentStack 로깅 */
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
    if (import.meta.env.DEV) {
      console.error(
        `${PREFIX} ErrorBoundary caught:\n  message: ${error.message}\n  componentStack:\n${errorInfo.componentStack}`
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
    }
    return this.props.children;
  }
}
