// PATH: src/core/router/AppRouter.tsx
import { Routes, Route, Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Suspense, useEffect, useRef } from "react";
import { lazyWithRetry as lazy } from "@/shared/utils/lazyWithRetry";
import ProtectedRoute from "./ProtectedRoute";
import ErrorBoundary from "@/shared/ui/ErrorBoundary";

const StudentRouter = lazy(() => import("@student/app/StudentRouter"));
import AuthRouter from "./AuthRouter";
import { SendMessageModalProvider } from "@admin/domains/messages/context/SendMessageModalContext";

import TenantRequiredPage from "@/auth/pages/TenantRequiredPage";
import MaintenancePage from "@admin/domains/maintenance/pages/MaintenancePage";
import { TermsPage, PrivacyPage } from "@admin/domains/legal";
import useAuth from "@/auth/hooks/useAuth";
import { useProgram } from "@/shared/program";

const AdminRouter = lazy(() => import("@admin/app/AdminRouter"));
const DevAppRouter = lazy(() => import("@dev/app/DevAppRouter"));
const PromoRouter = lazy(() => import("@promo/app/PromoRouter"));
const PublicLandingPage = lazy(() => import("@/landing/pages/PublicLandingPage"));

function MaintenanceGate({ enabled }: { enabled: boolean }) {
  const location = useLocation();
  if (!enabled) return <Outlet />;

  const p = location.pathname || "";
  if (p.startsWith("/dev") || p.startsWith("/login") || p.startsWith("/promo") || p.startsWith("/maintenance") || p.startsWith("/terms") || p.startsWith("/privacy")) {
    return <Outlet />;
  }

  return <Navigate to="/maintenance" replace />;
}

/** 홍보 테넌트(hakwonplus, 9999)만 /promo 접근 허용. 그 외 테넌트는 / 로 리다이렉트. */
function PromoGuard() {
  const { program, isLoading } = useProgram();
  if (isLoading) return null;
  const tc = program?.tenantCode;
  if (tc === "hakwonplus" || tc === "9999") return <Outlet />;
  return <Navigate to="/" replace />;
}

function RootRedirect() {
  const { user, isLoading } = useAuth();
  const { program, isLoading: programLoading } = useProgram();
  const navigate = useNavigate();

  const redirectedRef = useRef(false);

  useEffect(() => {
    if (programLoading || !program || isLoading) return;
    if (redirectedRef.current) return;

    redirectedRef.current = true;

    // 비로그인: 홍보 테넌트(1번/9999)면 홍보 앱, 그 외 로그인
    if (!user) {
      const tc = program.tenantCode;
      if (tc === "hakwonplus" || tc === "9999") {
        navigate("/promo", { replace: true });
      } else {
        navigate("/login", { replace: true });
      }
      return;
    }

    const role = user.tenantRole;

    // 테넌트 1번(hakwonplus) 및 9999번(로컬 개발) owner는 dev_app(개발자 앱)으로 리다이렉트
    if ((program.tenantCode === "hakwonplus" || program.tenantCode === "9999") && role === "owner") {
      navigate("/dev/dashboard", { replace: true });
      return;
    }

    if (role && ["owner", "admin", "teacher", "staff"].includes(role)) {
      navigate("/admin", { replace: true });
      return;
    }

    if (role && ["student", "parent"].includes(role)) {
      navigate("/student", { replace: true });
      return;
    }

    navigate("/login", { replace: true });
  }, [programLoading, program, isLoading, user, navigate]);

  if (programLoading) return null;

  if (!program) {
    return <Navigate to="/error/tenant-required" replace />;
  }

  return null;
}

export default function AppRouter() {
  const { program } = useProgram();
  const tenantCode = program?.tenantCode;
  const maintenanceExempt = tenantCode === "hakwonplus" || tenantCode === "9999";
  const maintenanceOn = Boolean(program?.feature_flags?.maintenance_mode) && !maintenanceExempt;

  return (
    <Routes>
      <Route path="/login/*" element={<AuthRouter />} />
      <Route path="/terms" element={<TermsPage />} />
      <Route path="/privacy" element={<PrivacyPage />} />
      <Route element={<PromoGuard />}>
        <Route
          path="/promo/*"
          element={
            <Suspense
              fallback={
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 200, color: "var(--color-text-tertiary, #666)", fontSize: "var(--text-sm, 13px)" }}>
                  불러오는 중…
                </div>
              }
            >
              <PromoRouter />
            </Suspense>
          }
        />
      </Route>
      {/* 공개 랜딩페이지 (인증 불필요, tenant resolved) */}
      <Route
        path="/landing"
        element={
          <Suspense fallback={<div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}><span style={{ color: "var(--color-text-tertiary, #666)", fontSize: "var(--text-sm, 13px)" }}>불러오는 중…</span></div>}>
            <PublicLandingPage />
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
                  fallback={
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        minHeight: 200,
                        color: "var(--color-text-tertiary, #666)",
                        fontSize: "var(--text-sm, 13px)",
                      }}
                    >
                      불러오는 중…
                    </div>
                  }
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
                  fallback={
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        minHeight: 200,
                        color: "var(--color-text-tertiary, #666)",
                        fontSize: "var(--text-sm, 13px)",
                      }}
                    >
                      불러오는 중…
                    </div>
                  }
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
          <Route
            path="/admin/*"
            element={
              <ErrorBoundary>
                <SendMessageModalProvider>
                  <Suspense
                    fallback={
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          minHeight: 200,
                          color: "#666",
                          fontSize: 14,
                        }}
                      >
                        불러오는 중…
                      </div>
                    }
                  >
                    <AdminRouter />
                  </Suspense>
                </SendMessageModalProvider>
              </ErrorBoundary>
            }
          />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
