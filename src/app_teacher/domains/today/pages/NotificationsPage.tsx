// PATH: src/app_teacher/domains/today/pages/NotificationsPage.tsx
// 알림 센터 (Phase 1 간소 버전)
import { useNavigate } from "react-router-dom";
import { EmptyState } from "@/shared/ui/ds";

export default function NotificationsPage() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 py-0.5">
        <BackBtn onClick={() => navigate(-1)} />
        <h1 className="text-lg font-bold" style={{ color: "var(--tc-text)" }}>알림 센터</h1>
      </div>
      <EmptyState scope="panel" tone="empty" title="새로운 알림이 없습니다" />
    </div>
  );
}

function BackBtn({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex p-1 cursor-pointer" style={{ background: "none", border: "none", color: "var(--tc-text-secondary)" }}>
      <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <polyline points="15 18 9 12 15 6" />
      </svg>
    </button>
  );
}
