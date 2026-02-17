// PATH: src/features/staff/StaffLayout.tsx
// 내부 헤더 없음. 좌측 DB 직원 선택 + 우측 내용물 형식. 최소 탭만 상단 링크로.
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import DomainPanel from "@/shared/ui/domain/DomainPanel";

const STAFF_TABS = [
  { key: "home", label: "홈", path: "/admin/staff/home" },
  { key: "attendance", label: "근태", path: "/admin/staff/attendance" },
  { key: "expenses", label: "비용/경비", path: "/admin/staff/expenses" },
  { key: "month-lock", label: "월 마감", path: "/admin/staff/month-lock" },
  { key: "payroll-snapshot", label: "급여 스냅샷", path: "/admin/staff/payroll-snapshot" },
  { key: "reports", label: "리포트/명세", path: "/admin/staff/reports" },
];

export default function StaffLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="min-h-full bg-[var(--bg-page)]" data-app="admin">
      <div style={{ padding: "var(--space-6)" }}>
        <nav
          className="staff-nav-strip"
          aria-label="직원 관리 메뉴"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "2px",
            marginBottom: "var(--space-4)",
            flexWrap: "wrap",
          }}
        >
          {STAFF_TABS.map((tab) => {
            const active =
              location.pathname === tab.path || location.pathname.startsWith(tab.path + "/");
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => navigate(tab.path)}
                className={active ? "staff-nav-strip__link--active" : "staff-nav-strip__link"}
                style={{
                  padding: "6px 12px",
                  fontSize: 13,
                  fontWeight: active ? 600 : 500,
                  color: active
                    ? "var(--color-primary)"
                    : "var(--color-text-secondary)",
                  background: active
                    ? "color-mix(in srgb, var(--color-primary) 10%, transparent)"
                    : "transparent",
                  border: "none",
                  borderRadius: 6,
                  cursor: "pointer",
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>
        <DomainPanel>
          <Outlet />
        </DomainPanel>
      </div>
    </div>
  );
}
