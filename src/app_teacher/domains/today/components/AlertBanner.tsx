// PATH: src/app_teacher/domains/today/components/AlertBanner.tsx
// 미처리 알림 배너 — 탭하면 소통 탭으로 이동
import { useNavigate } from "react-router-dom";
import type { AdminNotificationCounts } from "@admin/domains/admin-notifications/api";

interface Props {
  counts: AdminNotificationCounts;
}

export default function AlertBanner({ counts }: Props) {
  const navigate = useNavigate();
  if (counts.total === 0) return null;

  const parts: string[] = [];
  if (counts.qnaPending > 0) parts.push(`Q&A ${counts.qnaPending}건`);
  if (counts.registrationRequestsPending > 0)
    parts.push(`등록요청 ${counts.registrationRequestsPending}건`);
  if (counts.recentSubmissions > 0)
    parts.push(`제출물 ${counts.recentSubmissions}건`);

  return (
    <button
      onClick={() => navigate("/teacher/comms")}
      className="w-full flex items-center gap-2 rounded-lg text-left"
      style={{
        padding: "var(--tc-space-3) var(--tc-space-4)",
        background: "var(--tc-warn-bg)",
        border: "1px solid rgba(245,158,11,0.2)",
      }}
    >
      <span className="text-base shrink-0">&#9888;&#65039;</span>
      <div>
        <div
          className="text-[13px] font-bold"
          style={{ color: "var(--tc-text)" }}
        >
          미처리 {counts.total}건
        </div>
        <div className="text-xs" style={{ color: "var(--tc-text-secondary)" }}>
          {parts.join(" · ")}
        </div>
      </div>
    </button>
  );
}
