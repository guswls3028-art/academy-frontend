// PATH: src/main.tsx
// App Entry Point — Sentry 초기화 + 앱 마운트

import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import * as Sentry from "@sentry/react";

import AppRouter from "@/app/router/AppRouter";
import QueryProvider from "@/app/providers/QueryProvider";
import { AuthProvider } from "@/features/auth/context/AuthContext";
import { ProgramProvider } from "@/shared/program";
import { ThemeProvider } from "@/context/ThemeContext";
import { DevErrorBoundary, DevErrorLogger } from "@/app/DevErrorLogger";

import "./index.css";
import "antd/dist/reset.css";

// ── Sentry 초기화 (production only) ──
const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN as string | undefined;
if (SENTRY_DSN && import.meta.env.PROD) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: import.meta.env.MODE || "production",
    release: `academy-frontend@${import.meta.env.VITE_GIT_SHA || "unknown"}`,
    // 성능 모니터링 — 10% 샘플링 (비용 절감)
    tracesSampleRate: 0.1,
    // 에러 필터: 네트워크 에러, 확장 프로그램 에러 제외
    beforeSend(event) {
      const msg = event.exception?.values?.[0]?.value || "";
      // 브라우저 확장 프로그램 에러 무시
      if (msg.includes("chrome-extension://") || msg.includes("moz-extension://")) return null;
      // ResizeObserver 루프 에러 무시 (무해)
      if (msg.includes("ResizeObserver loop")) return null;
      return event;
    },
    // 사용자 컨텍스트: tenant code 추가
    initialScope: {
      tags: {
        tenant: (() => {
          const host = window.location.hostname.toLowerCase();
          const map: Record<string, string> = {
            "tchul.com": "tchul", "hakwonplus.com": "hakwonplus",
            "limglish.kr": "limglish", "ymath.co.kr": "ymath", "sswe.co.kr": "sswe",
          };
          return map[host] || host;
        })(),
      },
    },
  });
}

const AppContent = (
  <ThemeProvider>
    <BrowserRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <QueryProvider>
        <ProgramProvider>
          <AuthProvider>
            <AppRouter />
          </AuthProvider>
        </ProgramProvider>
      </QueryProvider>
    </BrowserRouter>
  </ThemeProvider>
);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <DevErrorBoundary>
      {import.meta.env.DEV ? <DevErrorLogger>{AppContent}</DevErrorLogger> : AppContent}
    </DevErrorBoundary>
  </React.StrictMode>
);
