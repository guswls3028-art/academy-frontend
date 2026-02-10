// PATH: src/features/students/StudentsLayout.tsx
import { Outlet, useNavigate, useLocation } from "react-router-dom";

export default function StudentsLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  const activeKey = location.pathname.includes("/history")
    ? "history"
    : location.pathname.includes("/scores")
    ? "scores"
    : "home";

  const lockedTabClass =
    "opacity-40 cursor-not-allowed pointer-events-none";

  return (
    <div className="min-h-full bg-[var(--bg-page)]" data-app="admin">
      {/* ===============================
          DOMAIN HEADER
      =============================== */}
      <div className="border-b border-[var(--border-divider)] bg-[var(--bg-surface)]">
        <div className="px-6 pt-6 pb-4">
          <div className="relative">
            <div className="absolute left-0 top-1 h-6 w-1 rounded-full bg-[var(--color-primary)]" />

            <div className="pl-4">
              <div className="text-2xl font-bold tracking-tight">
                학생 관리
              </div>
              <div className="text-base text-[var(--text-muted)] mt-1">
                학생 추가 · 학교 성적 · 상담
              </div>
            </div>
          </div>
        </div>

        <div className="px-6">
          <div className="ds-tabs">
            {/* 홈 */}
            <button
              className={`ds-tab text-[15px] font-semibold ${
                activeKey === "home" ? "is-active" : ""
              }`}
              onClick={() => navigate("/admin/students/home")}
            >
              홈
            </button>

            {/* 학교 성적 (잠금) */}
            <button
              className={`ds-tab text-[15px] font-semibold ${lockedTabClass}`}
              title="준비 중인 기능입니다"
              disabled
            >
              학교 성적
            </button>

            {/* 상담 이력 (잠금) */}
            <button
              className={`ds-tab text-[15px] font-semibold ${lockedTabClass}`}
              title="준비 중인 기능입니다"
              disabled
            >
              상담 이력
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
