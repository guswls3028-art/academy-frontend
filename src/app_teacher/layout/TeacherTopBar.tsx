/**
 * PATH: src/app_teacher/layout/TeacherTopBar.tsx
 * 상단 바 — 테넌트명 + 알림 뱃지 (Lucide 아이콘)
 */
import { useNavigate } from "react-router-dom";
import { useProgram } from "@/shared/program";
import { useAdminNotificationCounts } from "@admin/domains/admin-notifications/useAdminNotificationCounts";
import { Bell } from "@teacher/shared/ui/Icons";

interface Props {
  tenantCode: string | null;
}

export default function TeacherTopBar({ tenantCode }: Props) {
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
        padding: "0 var(--tc-space-4)",
        maxWidth: "var(--tc-page-max-w)",
        margin: "0 auto",
        width: "100%",
      }}
    >
      {/* Left: Tenant name */}
      <button
        onClick={() => navigate("/teacher")}
        style={{
          background: "none",
          border: "none",
          padding: 0,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 8,
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
