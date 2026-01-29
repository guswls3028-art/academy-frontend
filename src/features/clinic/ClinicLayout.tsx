import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { Tabs } from "antd";

function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

export default function ClinicLayout() {
  const nav = useNavigate();
  const loc = useLocation();

  const activeKey = loc.pathname.includes("/operations")
    ? "operations"
    : loc.pathname.includes("/bookings")
    ? "bookings"
    : loc.pathname.includes("/reports")
    ? "reports"
    : loc.pathname.includes("/settings")
    ? "settings"
    : "home";

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <div className="text-xl font-semibold">클리닉</div>
          <div className="text-xs text-[var(--text-muted)]">
            * 대상자 판정/상태는 서버 단일진실이며 프론트는 표시/액션만 수행합니다.
          </div>
        </div>
      </div>

      <div
        className={cx(
          "rounded-2xl border border-[var(--border-divider)]",
          "bg-[var(--bg-surface)] px-4 pt-3"
        )}
      >
        <Tabs
          activeKey={activeKey}
          onChange={(key) => nav(`/admin/clinic/${key}`)}
          className="
            [&_.ant-tabs-tab]:text-[var(--text-secondary)]
            [&_.ant-tabs-tab-active]:text-[var(--text-primary)]
          "
          items={[
            { key: "home", label: "홈" },
            { key: "operations", label: "운영" },
            { key: "bookings", label: "예약대상자" },
            { key: "reports", label: "리포트" },
            { key: "settings", label: "설정" },
          ]}
        />
      </div>

      <Outlet />
    </div>
  );
}
