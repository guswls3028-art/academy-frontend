/**
 * PATH: src/app_teacher/layout/TeacherTopBar.tsx
 * 상단 바 — 좌: 햄버거(사이드바) + 테넌트명 / 우: 알림 벨
 * 데스크톱 헤더와 동일 구조
 */
import { useNavigate } from "react-router-dom";
import { useProgram } from "@/shared/program";
import { useAdminNotificationCounts } from "@admin/domains/admin-notifications/useAdminNotificationCounts";
import { Menu, Bell } from "@teacher/shared/ui/Icons";

interface Props {
  tenantCode: string | null;
  onMenuClick: () => void;
}

export default function TeacherTopBar({ tenantCode, onMenuClick }: Props) {
  const navigate = useNavigate();
  const { program } = useProgram();
  const { counts } = useAdminNotificationCounts();
  const tenantName = program?.display_name || "학원플러스";
  const badge = counts?.total ?? 0;

  return (
    <div
      style={{
        height: "var(--tc-header-h)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 var(--tc-space-3)",
        maxWidth: "var(--tc-page-max-w)",
        margin: "0 auto",
        width: "100%",
      }}
    >
      {/* Left: Hamburger + Tenant name */}
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <button
          onClick={onMenuClick}
          aria-label="메뉴"
          style={{
            background: "none",
            border: "none",
            padding: 8,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--tc-text-secondary)",
            borderRadius: "var(--tc-radius)",
            minWidth: "var(--tc-touch-min)",
            minHeight: "var(--tc-touch-min)",
          }}
        >
          <Menu size={22} />
        </button>
        <button
          onClick={() => navigate("/teacher")}
          style={{
            background: "none",
            border: "none",
            padding: "4px 0",
            cursor: "pointer",
          }}
        >
          <span
            style={{
              fontSize: 17,
              fontWeight: 700,
              color: "var(--tc-text)",
              letterSpacing: "-0.02em",
            }}
          >
            {tenantName}
          </span>
        </button>
      </div>

      {/* Right: Notification bell */}
      <button
        onClick={() => navigate("/teacher/notifications")}
        aria-label="알림"
        style={{
          background: "none",
          border: "none",
          padding: 8,
          cursor: "pointer",
          borderRadius: "var(--tc-radius-full)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--tc-text-secondary)",
          position: "relative",
          minWidth: "var(--tc-touch-min)",
          minHeight: "var(--tc-touch-min)",
        }}
      >
        <Bell size={22} />
        {badge > 0 && (
          <span
            style={{
              position: "absolute",
              top: 4,
              right: 4,
              minWidth: 16,
              height: 16,
              lineHeight: "16px",
              fontSize: 9,
              fontWeight: 700,
              textAlign: "center",
              borderRadius: 8,
              padding: "0 4px",
              background: "var(--tc-danger)",
              color: "#fff",
            }}
          >
            {badge > 99 ? "99+" : badge}
          </span>
        )}
      </button>
    </div>
  );
}
