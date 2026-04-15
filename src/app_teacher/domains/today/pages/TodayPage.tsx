// PATH: src/app_teacher/domains/today/pages/TodayPage.tsx
// 오늘 홈 — 수업 카드 목록 + 알림 배너
import { useQuery } from "@tanstack/react-query";
import { EmptyState } from "@/shared/ui/ds";
import { useAdminNotificationCounts } from "@admin/domains/admin-notifications/useAdminNotificationCounts";
import { fetchTodaySessions } from "../api";
import SessionCard from "../components/SessionCard";
import AlertBanner from "../components/AlertBanner";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function TodayPage() {
  const today = todayISO();

  const { data: sessions, isLoading } = useQuery({
    queryKey: ["today-sessions", today],
    queryFn: () => fetchTodaySessions(today),
    staleTime: 60_000,
  });

  const { counts } = useAdminNotificationCounts();

  const dateStr = new Date().toLocaleDateString("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
  });

  return (
    <div className="flex flex-col gap-3">
      {/* 미처리 알림 배너 */}
      {counts && counts.total > 0 && <AlertBanner counts={counts} />}

      {/* 섹션 헤더 */}
      <div className="flex justify-between items-baseline py-1">
        <h2 className="text-base font-bold" style={{ color: "var(--tc-text)" }}>
          오늘의 수업
        </h2>
        <span className="text-xs" style={{ color: "var(--tc-text-muted)" }}>
          {dateStr}
        </span>
      </div>

      {/* 수업 카드 */}
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
