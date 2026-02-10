// PATH: src/features/staff/StaffLayout.tsx
import { Outlet, useNavigate, useLocation } from "react-router-dom";

export default function StaffLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  const activeKey = location.pathname.includes("/operations")
    ? "operations"
    : location.pathname.includes("/reports")
    ? "reports"
    : "home";

  return (
    <div className="min-h-full bg-[var(--bg-page)]" data-app="admin">
      {/* ===============================
          DOMAIN HEADER
      =============================== */}
      <div className="border-b border-[var(--border-divider)] bg-[var(--bg-surface)]">
        <div className="px-6 pt-6 pb-4">
          <div className="relative">
            {/* accent line */}
            <div className="absolute left-0 top-1 h-6 w-1 rounded-full bg-[var(--color-primary)]" />

            <div className="pl-4">
              <div className="text-2xl font-bold tracking-tight">
                직원 관리
              </div>
              <div className="text-sm text-[var(--text-muted)] mt-0.5">
                직원 정보 · 근무 · 비용 · 급여 관리
              </div>
            </div>
          </div>
        </div>

        {/* ===============================
            SUB NAV — DS TABS
        =============================== */}
        <div className="px-6">
          <div className="ds-tabs">
            <button
              className={`ds-tab ${activeKey === "home" ? "is-active" : ""}`}
              onClick={() => navigate("/admin/staff/home")}
            >
              홈
            </button>

            <button
              className={`ds-tab ${activeKey === "operations" ? "is-active" : ""}`}
              onClick={() => navigate("/admin/staff/operations")}
            >
              작업
            </button>

            <button
              className={`ds-tab ${activeKey === "reports" ? "is-active" : ""}`}
              onClick={() => navigate("/admin/staff/reports")}
            >
              리포트
            </button>
          </div>
        </div>
      </div>

      {/* ===============================
          DOMAIN CONTENT
      =============================== */}
      <div className="px-6 py-6">
        <div className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-divider)]">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
