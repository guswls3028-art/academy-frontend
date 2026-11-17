// PATH: src/core/DevErrorLogger.tsx
// 개발 환경에서 React 오류 메시지와 스택을 콘솔에 출력.

import React, { useEffect } from "react";
import ErrorRecoveryScreen from "@/shared/ui/ErrorRecoveryScreen";

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

/** 로컬 개발의 렌더링 오류를 콘솔에 남기고 공통 오류 화면을 표시한다. */
export class DevErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error(PREFIX, error, errorInfo.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <ErrorRecoveryScreen
        recovering={false}
        route={window.location.pathname}
        onReload={() => window.location.reload()}
      />
    );
  }
}
