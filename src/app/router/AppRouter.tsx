// PATH: src/app/router/AppRouter.tsx
import { Routes, Route, Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { lazy, Suspense, useEffect, useRef } from "react";
import ProtectedRoute from "./ProtectedRoute";

import StudentRouter from "@/student/app/StudentRouter";
import AuthRouter from "./AuthRouter";

import TenantRequiredPage from "@/features/auth/pages/TenantRequiredPage";
import MaintenancePage from "@/features/maintenance/pages/MaintenancePage";
import useAuth from "@/features/auth/hooks/useAuth";
import { useProgram } from "@/shared/program";

const AdminRouter = lazy(() => import("@/app/router/AdminRouter"));
const DevAppRouter = lazy(() => import("@/dev_app/router/DevAppRouter"));

function MaintenanceGate({ enabled }: { enabled: boolean }) {
  const location = useLocation();
  if (!enabled) return <Outlet />;

  const p = location.pathname || "";
  if (p.startsWith("/dev") || p.startsWith("/login") || p.startsWith("/maintenance")) {
    return <Outlet />;
  }

  return <Navigate to="/maintenance" replace />;
}

function RootRedirect() {
  const { user, isLoading } = useAuth();
  const { program, isLoading: programLoading } = useProgram();
  const navigate = useNavigate();

  const redirectedRef = useRef(false);

  useEffect(() => {
    if (programLoading) return;
    if (!program) return;

    if (isLoading) return;
    if (redirectedRef.current) return;

    redirectedRef.current = true;

    // ✅ 핵심 수정: 비로그인 상태 명시 처리
    if (!user) {
      navigate("/login", { replace: true });
      return;
    }

    const role = user.tenantRole;

    // 테넌트 1번(hakwonplus) 및 9999번(로컬 개발) owner는 dev_app(개발자 앱)으로 리다이렉트
    if ((program.tenantCode === "hakwonplus" || program.tenantCode === "9999") && role === "owner") {
      navigate("/dev/home", { replace: true });
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
      <Route path="/maintenance" element={<MaintenancePage />} />

      <Route
        path="/error/tenant-required"
        element={<TenantRequiredPage />}
      />

      <Route element={<MaintenanceGate enabled={maintenanceOn} />}>
        <Route
          element={
            <ProtectedRoute allow={["owner"]} />
          }
        >
          <Route
            path="/dev/*"
            element={
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
                <DevAppRouter />
              </Suspense>
            }
          />
        </Route>

        <Route path="/" element={<RootRedirect />} />

        <Route element={<ProtectedRoute allow={["student", "parent"]} />}>
          <Route path="/student/*" element={<StudentRouter />} />
        </Route>

        <Route
          element={
            <ProtectedRoute allow={["owner", "admin", "teacher", "staff"]} />
          }
        >
          <Route
            path="/admin/*"
            element={
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
            }
          />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
