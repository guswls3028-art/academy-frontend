// PATH: src/features/lectures/layout/LecturesLayout.tsx
import { Outlet, useLocation, useNavigate } from "react-router-dom";

export default function LecturesLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  const activeKey = location.pathname.includes("/lectures/past")
    ? "past"
    : "list";

  return (
    <div className="min-h-full bg-[var(--bg-page)]" data-app="admin">
      {/* DOMAIN HEADER */}
      <div className="border-b border-[var(--border-divider)] bg-[var(--bg-surface)]">
        <div className="px-6 pt-6 pb-4">
          <div className="relative">
            <div className="absolute left-0 top-1 h-6 w-1 rounded-full bg-[var(--color-primary)]" />
            <div className="pl-4">
              <div className="text-2xl font-bold tracking-tight">
                강의 관리
              </div>
              <div className="text-base text-[var(--text-muted)] mt-1">
                강의 목록 · 지난 강의 · 수강생 · 출결 · 리포트
              </div>
            </div>
          </div>
        </div>

        {/* DOMAIN TABS */}
        <div className="px-6">
          <div className="ds-tabs">
            <button
              className={`ds-tab text-[15px] font-semibold ${
                activeKey === "list" ? "is-active" : ""
              }`}
              onClick={() => navigate("/admin/lectures")}
            >
              강의목록
            </button>

            <button
              className={`ds-tab text-[15px] font-semibold ${
                activeKey === "past" ? "is-active" : ""
              }`}
              onClick={() => navigate("/admin/lectures/past")}
            >
              지난강의
            </button>
          </div>
        </div>
      </div>

      {/* DOMAIN CARD */}
      <div className="px-6 py-6">
        <div className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-divider)]">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
