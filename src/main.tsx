// PATH: src/main.tsx
// App Entry Point — Sentry 초기화 + 앱 마운트

import React, { useEffect, useRef } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, useLocation } from "react-router-dom";
import * as Sentry from "@sentry/react";

import AppRouter from "@/core/router/AppRouter";
import QueryProvider from "@/core/providers/QueryProvider";
import { AuthProvider } from "@/auth/context/AuthContext";
import { ProgramProvider } from "@/shared/program";
import { ThemeProvider } from "@/shared/contexts/ThemeContext";
// 테넌트 레지스트리를 엔트리에서 직접 사용 — Vite 메인 번들에 포함 강제
import { TENANTS } from "@/shared/tenant/tenants/index";
// side-effect guard: Rollup이 tree-shake하지 않도록 런타임 참조
if (!TENANTS.length) throw new Error("Tenant registry empty");
import ErrorBoundary from "@/shared/ui/ErrorBoundary";
import { DevErrorBoundary, DevErrorLogger } from "@/core/DevErrorLogger";
import { useVersionChecker } from "@/shared/ui/layout/VersionChecker";
import SubscriptionExpiredOverlay from "@/shared/ui/SubscriptionExpiredOverlay";
import { ConfirmProvider } from "@/shared/ui/confirm/ConfirmProvider";
import { ModalWindowProvider, ModalTaskbar } from "@/shared/ui/modal";
import { addNavigationBreadcrumb } from "@/shared/lib/sentryContext";
import BugReportButton from "@/shared/ui/feedback/BugReportButton";
import ImpersonationBanner from "@dev/shared/components/ImpersonationBanner";

import "./index.css";
import "antd/dist/reset.css";

/**
 * 신규 배포로 사용자 브라우저 캐시 index.html이 참조하는 구 chunk가 404일 때
 * 자동 1회 reload 하여 새 번들을 받도록. 무한 루프 방지용 sessionStorage 플래그.
 */
function installChunkReloadHandler() {
  const KEY = "__chunk_reload_done__";
  const reloadOnce = () => {
    try {
      if (sessionStorage.getItem(KEY)) return;
      sessionStorage.setItem(KEY, "1");
      setTimeout(() => sessionStorage.removeItem(KEY), 10_000);
    } catch {}
    window.location.reload();
  };
  window.addEventListener("vite:preloadError", (e) => {
    e.preventDefault();
    reloadOnce();
  });
  window.addEventListener("error", (e) => {
    const msg = String((e as ErrorEvent).message || "");
    if (msg.includes("Failed to fetch dynamically imported module") || msg.includes("Importing a module script failed")) {
      reloadOnce();
    }
  });
  window.addEventListener("unhandledrejection", (e) => {
    const msg = String((e as PromiseRejectionEvent).reason?.message || "");
    if (msg.includes("Failed to fetch dynamically imported module") || msg.includes("Importing a module script failed")) {
      reloadOnce();
    }
  });
}
installChunkReloadHandler();

// ── Sentry 초기화 (production only) ──
const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN as string | undefined;

function resolveTenantCode(): string {
  const host = window.location.hostname.toLowerCase();
  const map: Record<string, string> = {
    "tchul.com": "tchul", "hakwonplus.com": "hakwonplus",
    "limglish.kr": "limglish", "ymath.co.kr": "ymath", "sswe.co.kr": "sswe",
    "dnbacademy.co.kr": "dnb",
  };
  return map[host] || host;
}

if (SENTRY_DSN && import.meta.env.PROD) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: import.meta.env.MODE || "production",
    release: `academy-frontend@${import.meta.env.VITE_GIT_SHA || "unknown"}`,
    integrations: [
      // Session Replay — 에러 발생 시 세션 녹화 자동 캡처
      Sentry.replayIntegration({
        // 민감 정보 마스킹 (비밀번호, 전화번호 등)
        maskAllText: false,
        maskAllInputs: true,
        blockAllMedia: false,
      }),
    ],
    // 성능 모니터링 — 10% 샘플링 (비용 절감)
    tracesSampleRate: 0.1,
    // Session Replay 샘플링: 일반 세션 0%, 에러 세션 100%
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 1.0,
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
      tags: { tenant: resolveTenantCode() },
    },
  });
}

/** BrowserRouter 내부 최상위 — hook 호출 + 라우터 + 오버레이 */
function AppInner() {
  useVersionChecker(); // 배포 자동 업데이트 (visibilitychange + pageshow + 폴링)

  // Sentry breadcrumb: 라우트 변경 추적
  const location = useLocation();
  const prevPath = useRef(location.pathname);
  useEffect(() => {
    if (prevPath.current !== location.pathname) {
      addNavigationBreadcrumb(prevPath.current, location.pathname);
      prevPath.current = location.pathname;
    }
  }, [location.pathname]);

  return (
    <>
      <ImpersonationBanner />
      <AppRouter />
      <SubscriptionExpiredOverlay />
      <BugReportButton />
    </>
  );
}

const AppContent = (
  <ThemeProvider>
    <BrowserRouter
      future={{
        // v7_startTransition: true 는 concurrent 업데이트로 URL만 바뀌고
        // 메인 영역(Outlet)이 갱신되지 않는 사례가 있어 비활성화함.
        v7_relativeSplatPath: true,
      }}
    >
      <QueryProvider>
        <ProgramProvider>
          <AuthProvider>
            <ModalWindowProvider>
              <ConfirmProvider>
                <AppInner />
              </ConfirmProvider>
              <ModalTaskbar />
            </ModalWindowProvider>
          </AuthProvider>
        </ProgramProvider>
      </QueryProvider>
    </BrowserRouter>
  </ThemeProvider>
);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <DevErrorBoundary>
        {import.meta.env.DEV ? <DevErrorLogger>{AppContent}</DevErrorLogger> : AppContent}
      </DevErrorBoundary>
    </ErrorBoundary>
  </React.StrictMode>
);
