// PATH: src/app_teacher/domains/notifications/pages/NotificationsPage.tsx
// 알림 센터 — 미처리 알림 목록 + 탭 필터
import { useNavigate } from "react-router-dom";
import { useAdminNotificationCounts } from "@admin/domains/admin-notifications/useAdminNotificationCounts";
import { buildAdminNotificationItems } from "@admin/domains/admin-notifications/api";
import { EmptyState } from "@/shared/ui/ds";

export default function NotificationsPage() {
  const navigate = useNavigate();
  const { counts, isLoading } = useAdminNotificationCounts();
  const items = counts ? buildAdminNotificationItems(counts) : [];

  const routeMap: Record<string, string> = {
    qna: "/teacher/comms",
    clinic: "/teacher/comms",
    registration_requests: "/teacher/comms",
    submissions: "/teacher/comms",
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center gap-2 py-0.5">
        <BackBtn onClick={() => navigate(-1)} />
        <h1 className="text-lg font-bold" style={{ color: "var(--tc-text)" }}>
          알림 센터
        </h1>
      </div>

      {isLoading ? (
        <EmptyState scope="panel" tone="loading" title="불러오는 중…" />
      ) : items.length > 0 ? (
        <div className="flex flex-col gap-2">
          {items.map((item) => (
            <button
              key={item.type}
              onClick={() => navigate(routeMap[item.type] ?? "/teacher/comms")}
              className="w-full text-left cursor-pointer rounded-xl"
              style={{
                padding: "var(--tc-space-3) var(--tc-space-4)",
                background: "var(--tc-surface)",
                border: "1px solid var(--tc-border-subtle)",
              }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold" style={{ color: "var(--tc-text)" }}>
                    {item.label}
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: "var(--tc-text-muted)" }}>
                    처리 대기
                  </div>
                </div>
                <span
                  className="text-base font-bold rounded-full"
                  style={{
                    minWidth: 28,
                    height: 28,
                    lineHeight: "28px",
                    textAlign: "center",
                    background: "var(--tc-danger-bg)",
                    color: "var(--tc-danger)",
                  }}
                >
                  {item.count}
                </span>
              </div>
            </button>
          ))}

          {/* 총 미처리 */}
          <div
            className="text-center text-xs py-2"
            style={{ color: "var(--tc-text-muted)" }}
          >
            총 {counts?.total ?? 0}건 처리 대기
          </div>
        </div>
      ) : (
        <EmptyState scope="panel" tone="empty" title="새로운 알림이 없습니다" />
      )}
    </div>
  );
}

function BackBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex p-1 cursor-pointer"
      style={{ background: "none", border: "none", color: "var(--tc-text-secondary)" }}
    >
      <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <polyline points="15 18 9 12 15 6" />
      </svg>
    </button>
  );
}
