// PATH: src/app_teacher/domains/today/pages/TodayPage.tsx
// 오늘 홈 — 지금 처리할 일 + 오늘 수업
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { EmptyState } from "@/shared/ui/ds";
import { useAdminNotificationCounts } from "@admin/domains/admin-notifications/useAdminNotificationCounts";
import type { AdminNotificationItem } from "@admin/domains/admin-notifications/api";
import { Card, SectionTitle } from "@teacher/shared/ui/Card";
import { Badge } from "@teacher/shared/ui/Badge";
import { fetchTodaySessions } from "../api";
import SessionCard from "../components/SessionCard";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

const PENDING_ROUTES: Record<AdminNotificationItem["type"], string> = {
  qna: "/teacher/comms",
  counsel: "/teacher/comms",
  clinic: "/teacher/clinic",
  registration_requests: "/teacher/students",
  submissions: "/teacher/submissions",
  score_pending: "/teacher/submissions",
  matchup_review_pending: "/admin/storage/matchup",
  video_failed: "/teacher/videos",
};

export default function TodayPage() {
  const today = todayISO();
  const navigate = useNavigate();

  const { data: sessions, isLoading } = useQuery({
    queryKey: ["today-sessions", today],
    queryFn: () => fetchTodaySessions(today),
    staleTime: 60_000,
  });

  const { items: pendingItems } = useAdminNotificationCounts();

  const dateStr = new Date().toLocaleDateString("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
  });

  const sessionCount = sessions?.length ?? 0;

  return (
    <div className="flex flex-col gap-3">
      {pendingItems.length > 0 && (
        <>
          <SectionTitle>지금 처리할 일</SectionTitle>
          <Card style={{ padding: 0, overflow: "hidden" }}>
            {pendingItems.map((item, idx) => (
              <PendingRow
                key={item.type}
                label={item.label}
                count={item.count}
                isLast={idx === pendingItems.length - 1}
                onClick={() => navigate(PENDING_ROUTES[item.type])}
              />
            ))}
          </Card>
        </>
      )}

      <SectionTitle
        right={
          <span className="text-xs font-normal" style={{ color: "var(--tc-text-muted)" }}>
            {dateStr}
          </span>
        }
      >
        오늘의 수업{sessionCount > 0 ? ` (${sessionCount})` : ""}
      </SectionTitle>

      {isLoading ? (
        <EmptyState scope="panel" tone="loading" title="불러오는 중…" />
      ) : sessions && sessions.length > 0 ? (
        <div className="flex flex-col gap-3">
          {sessions.map((s) => (
            <SessionCard key={s.id} session={s} />
          ))}
        </div>
      ) : (
        <EmptyState scope="panel" tone="empty" title="오늘 예정된 수업이 없습니다" />
      )}
    </div>
  );
}

function PendingRow({
  label,
  count,
  isLast,
  onClick,
}: {
  label: string;
  count: number;
  isLast: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex justify-between items-center w-full text-left cursor-pointer"
      style={{
        padding: "var(--tc-space-3) var(--tc-space-4)",
        background: "none",
        border: "none",
        borderBottom: isLast ? "none" : "1px solid var(--tc-border)",
      }}
    >
      <span className="text-sm" style={{ color: "var(--tc-text)" }}>
        {label}
      </span>
      <Badge tone="danger" pill>
        {count}건
      </Badge>
    </button>
  );
}
