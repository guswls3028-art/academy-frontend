// PATH: src/AppInner.tsx
// BrowserRouter 내부 최상위 — hook 호출 + 라우터 + 오버레이

import { lazy, Suspense, useEffect, useRef } from "react";
import { useLocation } from "react-router";

import AppRouter from "@/core/router/AppRouter";
import useAuth from "@/auth/hooks/useAuth";
import { VersionUpdateNotice } from "@/shared/ui/layout/VersionChecker";
import { useVersionChecker } from "@/shared/ui/layout/useVersionChecker";
import SubscriptionExpiredOverlay from "@/shared/ui/SubscriptionExpiredOverlay";
import { addNavigationBreadcrumb } from "@/shared/lib/sentryContext";
import BugReportButton from "@/shared/ui/feedback/BugReportButton";
import ImpersonationBanner from "@dev/shared/components/ImpersonationBanner";

const StaffClockInChoiceDialog = lazy(
  () => import("@/features/staff-clock/StaffClockInChoiceDialog"),
);

function StaffClockInChoiceGate() {
  const { user } = useAuth();
  if (user?.tenantRole !== "staff") return null;

  return (
    <Suspense fallback={null}>
      <StaffClockInChoiceDialog />
    </Suspense>
  );
}

export default function AppInner() {
  const updateAvailable = useVersionChecker();

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
      <StaffClockInChoiceGate />
      <SubscriptionExpiredOverlay />
      <BugReportButton />
      <VersionUpdateNotice visible={updateAvailable} />
    </>
  );
}
