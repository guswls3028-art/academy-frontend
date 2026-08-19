// PATH: src/AppInner.tsx
// BrowserRouter 내부 최상위 — hook 호출 + 라우터 + 오버레이

import { lazy, Suspense, useEffect, useRef } from "react";
import { useLocation } from "react-router";

import AppRouter from "@/core/router/AppRouter";
import { useVersionChecker } from "@/shared/ui/layout/VersionChecker";
import SubscriptionExpiredOverlay from "@/shared/ui/SubscriptionExpiredOverlay";
import { addNavigationBreadcrumb } from "@/shared/lib/sentryContext";
import BugReportButton from "@/shared/ui/feedback/BugReportButton";
import ImpersonationBanner from "@dev/shared/components/ImpersonationBanner";

const StaffClockInChoiceDialog = lazy(
  () => import("@/features/staff-clock/StaffClockInChoiceDialog"),
);

export default function AppInner() {
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
      <Suspense fallback={null}>
        <StaffClockInChoiceDialog />
      </Suspense>
      <SubscriptionExpiredOverlay />
      <BugReportButton />
    </>
  );
}
