/**
 * PATH: src/app_teacher/layout/TeacherTopBar.tsx
 * 상단 바 — 테넌트명 + 알림 뱃지
 */
import { useNavigate } from "react-router-dom";
import { useProgram } from "@/shared/program";

interface Props {
  tenantCode: string | null;
}

export default function TeacherTopBar({ tenantCode }: Props) {
  const navigate = useNavigate();
  const { program } = useProgram();
  const tenantName = program?.display_name || "학원플러스";

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
        <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
      </button>
    </div>
  );
}
