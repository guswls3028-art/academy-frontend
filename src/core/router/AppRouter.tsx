import { Routes, Route, Navigate, Outlet, useLocation, useNavigate } from "react-router";
import { Suspense, useEffect, useRef } from "react";
import { lazyWithRetry as lazy } from "@/shared/utils/lazyWithRetry";
import ProtectedRoute from "./ProtectedRoute";
import MobileWorkspaceRedirect, {
  prefersFullWorkspace,
} from "./MobileWorkspaceRedirect";
import ErrorBoundary from "@/shared/ui/ErrorBoundary";
import RouteFallback from "./RouteFallback";
import ExternalRedirect from "./ExternalRedirect";
import { ProductAnalyticsProvider } from "@/shared/productAnalytics";
import {
  canonicalizeWorkspacePath,
  WORKSPACE_PATHS,
} from "./workspaceRoutes";

const StudentRouter = lazy(() => import("@student/app/StudentRouter"));
const MobileWorkspaceRouter = lazy(() => import("@teacher/app/TeacherRouter"));
import AuthRouter from "./AuthRouter";

import TenantRequiredPage from "@/auth/pages/TenantRequiredPage";
import MaintenancePage from "@admin/domains/maintenance/pages/MaintenancePage";
import { TermsPage, PrivacyPage } from "@admin/domains/legal";
import useAuth from "@/auth/hooks/useAuth";
import { useProgram } from "@/shared/program";
import { resolveTenantCode } from "@/shared/tenant";
import AuthUnavailableState from "@/auth/components/AuthUnavailableState";
import {
  resolveDeveloperConsoleDestination,
  resolveRootDestination,
} from "./rootDestination";
import {
  isDeveloperConsoleHost,
  isPrimaryAppHost,
} from "@/shared/constants/origins";

const FullWorkspaceRouter = lazy(() => import("@admin/app/AdminRouter"));
const DevAppRouter = lazy(() => import("@dev/app/DevAppRouter"));
const PromoRouter = lazy(() => import("@promo/app/PromoRouter"));
const LandingRouter = lazy(() => import("@/landing/app/LandingRouter"));

const DEV_HOST_ALLOWED_PATHS = [
  "/dev",
  "/login",
  "/terms",
  "/privacy",
  "/error/tenant-required",
];

function MaintenanceGate({ enabled }: { enabled: boolean }) {
  const location = useLocation();
  if (!enabled) return <Outlet />;

  const p = location.pathname || "";
  if (p.startsWith("/dev") || p.startsWith("/login") || p.startsWith("/promo") || p.startsWith("/maintenance") || p.startsWith("/terms") || p.startsWith("/privacy")) {
    return <Outlet />;
  }

  return <Navigate to="/maintenance" replace />;
}

function LegacyWorkspaceRedirect() {
  const location = useLocation();
  const pathname = canonicalizeWorkspacePath(location.pathname);
  if (!pathname) return <Navigate to="/" replace />;

  return (
    <Navigate
      to={{ pathname, search: location.search, hash: location.hash }}
      state={location.state}
      replace
    />
  );
}

/** 홍보 테넌트(hakwonplus, 9999)만 /promo 접근 허용. 그 외 테넌트는 / 로 리다이렉트. */
function PromoGuard() {
  const { program, isLoading } = useProgram();
  const resolvedTenant = resolveTenantCode();
  const tc = program?.tenantCode ?? (resolvedTenant.ok ? resolvedTenant.code : null);
  if (isLoading && !tc) return null;
  if (tc === "hakwonplus" || tc === "9999") return <Outlet />;
  return <Navigate to="/" replace />;
}

function RootRedirect() {
  const { user, isLoading, authUnavailable, refreshMe } = useAuth();
  const { program, isLoading: programLoading } = useProgram();
  const navigate = useNavigate();

  const redirectedRef = useRef(false);

  useEffect(() => {
    if (programLoading || !program || isLoading || (authUnavailable && !user)) return;
    if (redirectedRef.current) return;

    redirectedRef.current = true;

    if (!user) {
      navigate(resolveRootDestination({
        tenantCode: program.tenantCode,
        role: null,
        isAuthenticated: false,
      }), { replace: true });
      return;
    }

    const isMobile = window.matchMedia("(max-width: 1023px)").matches;
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches
      || (navigator as Navigator & { standalone?: boolean }).standalone;
    navigate(resolveRootDestination({
      tenantCode: program.tenantCode,
      role: user.tenantRole,
      isAuthenticated: true,
      isMobile,
      isStandalone,
      prefersFullWorkspace: prefersFullWorkspace(),
    }), { replace: true });
  }, [programLoading, program, isLoading, authUnavailable, user, navigate]);

  if (programLoading) return null;

  if (!program) {
    return <Navigate to="/error/tenant-required" replace />;
  }

  if (authUnavailable && !user) {
    return <AuthUnavailableState retry={refreshMe} />;
  }

  return null;
}

export default function AppRouter() {
  const { program } = useProgram();
  const location = useLocation();
  const tenantCode = program?.tenantCode;
  const maintenanceExempt = tenantCode === "hakwonplus" || tenantCode === "9999";
  const maintenanceOn = Boolean(program?.feature_flags?.maintenance_mode) && !maintenanceExempt;
  const pathname = location.pathname || "/";
  const developerConsoleDestination = resolveDeveloperConsoleDestination({
    isPrimaryApp: isPrimaryAppHost(),
    pathname,
    search: location.search,
    hash: location.hash,
  });

  if (developerConsoleDestination) {
    return <ExternalRedirect to={developerConsoleDestination} />;
  }

  if (
    isDeveloperConsoleHost()
    && !DEV_HOST_ALLOWED_PATHS.some(
      (allowed) => pathname === allowed || pathname.startsWith(`${allowed}/`),
    )
  ) {
    return <Navigate to="/dev/inbox" replace />;
  }

  return (
    <ProductAnalyticsProvider>
      <Routes>
      <Route path="/login/*" element={<AuthRouter />} />
      <Route path="/terms" element={<TermsPage />} />
      <Route path="/privacy" element={<PrivacyPage />} />
      <Route element={<PromoGuard />}>
        <Route
          path="/promo/*"
          element={
            <Suspense fallback={<RouteFallback />}>
              <PromoRouter />
            </Suspense>
          }
        />
      </Route>
      <Route
        path="/landing/*"
        element={
          <Suspense fallback={<RouteFallback fullPage />}>
            <LandingRouter />
          </Suspense>
        }
      />
      <Route path="/maintenance" element={<MaintenancePage />} />

      <Route
        path="/error/tenant-required"
        element={<TenantRequiredPage />}
      />

      <Route element={<MaintenanceGate enabled={maintenanceOn} />}>
        <Route
          element={
            <ProtectedRoute allow={["owner"]} tenantOnly={["hakwonplus", "9999"]} />
          }
        >
          <Route
            path="/dev/*"
            element={
              <ErrorBoundary>
                <Suspense
                  fallback={<RouteFallback />}
                >
                  <DevAppRouter />
                </Suspense>
              </ErrorBoundary>
            }
          />
        </Route>

        <Route path="/" element={<RootRedirect />} />

        <Route element={<ProtectedRoute allow={["student", "parent"]} />}>
          <Route
            path="/student/*"
            element={
              <ErrorBoundary>
                <Suspense
                  fallback={<RouteFallback />}
                >
                  <StudentRouter />
                </Suspense>
              </ErrorBoundary>
            }
          />
        </Route>

        <Route
          element={
            <ProtectedRoute allow={["owner", "admin", "teacher", "staff"]} />
          }
        >
          <Route element={<MobileWorkspaceRedirect />}>
            <Route
              path={`${WORKSPACE_PATHS.full}/*`}
              element={
                <ErrorBoundary>
                  <Suspense
                    fallback={<RouteFallback />}
                  >
                    <FullWorkspaceRouter />
                  </Suspense>
                </ErrorBoundary>
              }
            />
          </Route>
          <Route
            path={`${WORKSPACE_PATHS.mobile}/*`}
            element={
              <ErrorBoundary>
                <Suspense
                  fallback={<RouteFallback />}
                >
                  <MobileWorkspaceRouter />
                </Suspense>
              </ErrorBoundary>
            }
          />
          <Route
            path={`${WORKSPACE_PATHS.legacyFull}/*`}
            element={<LegacyWorkspaceRedirect />}
          />
          <Route
            path={`${WORKSPACE_PATHS.legacyMobile}/*`}
            element={<LegacyWorkspaceRedirect />}
          />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ProductAnalyticsProvider>
  );
}
