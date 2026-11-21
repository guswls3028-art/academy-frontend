import { useQuery } from "@tanstack/react-query";
import { Link, type To } from "react-router";
import { assessmentQueryKeys } from "@/shared/api/queryKeys/assessments";
import { fetchAssessmentPages } from "@/shared/api/contracts/assessmentPages";
import { fetchAllSessions, fetchLectures } from "@/shared/api/contracts/sessions";
import { useOperationalNotificationCounts } from "@/shared/hooks/useOperationalNotificationCounts";
import { Badge, Button, EmptyState } from "@/shared/ui/ds";

export default function HomeworkReviewPicker({
  homeworkPath,
  fromInbox,
  pendingOnly,
}: {
  homeworkPath: (id: number) => To;
  fromInbox?: boolean;
  pendingOnly: boolean;
}) {
  const notifications = useOperationalNotificationCounts();
  const reviewCounts = notifications.counts.homeworkReviewByHomework;
  const shouldLoadHomeworks = !pendingOnly || (reviewCounts !== null && notifications.counts.homeworkReviewPending > 0);
  const homework = useQuery({
    queryKey: assessmentQueryKeys.staffHomeworks,
    queryFn: () => fetchAssessmentPages("/homeworks/", { homework_type: "regular" }),
    enabled: shouldLoadHomeworks,
    staleTime: 60_000,
  });
  const sessions = useQuery({
    queryKey: assessmentQueryKeys.allLectureSessions,
    queryFn: fetchAllSessions,
    enabled: shouldLoadHomeworks && Boolean(homework.data?.length),
    staleTime: 60_000,
  });
  const lectures = useQuery({
    queryKey: assessmentQueryKeys.allLectures,
    queryFn: () => fetchLectures(),
    enabled: shouldLoadHomeworks && Boolean(homework.data?.length),
    staleTime: 60_000,
  });

  if (pendingOnly && notifications.isLoading) {
    return <EmptyState scope="panel" tone="loading" title="확인 대기 과제 불러오는 중…" />;
  }
  if (pendingOnly && reviewCounts === null) {
    return <EmptyState scope="panel" tone="error" title="확인 대기 과제를 불러오지 못했습니다" actions={
      <Button onClick={() => void notifications.refetch()}>다시 시도</Button>
    } />;
  }
  if (pendingOnly && !shouldLoadHomeworks) {
    return <EmptyState scope="panel" tone="empty" title="확인 대기 과제가 없습니다" />;
  }
  if (homework.isError || sessions.isError || lectures.isError) {
    return <EmptyState scope="panel" tone="error" title="과제 목록을 불러오지 못했습니다" actions={
      <Button onClick={() => {
        if (homework.isError) void homework.refetch();
        if (sessions.isError) void sessions.refetch();
        if (lectures.isError) void lectures.refetch();
      }}>다시 시도</Button>
    } />;
  }
  if (homework.isPending || sessions.isLoading || lectures.isLoading) {
    return <EmptyState scope="panel" tone="loading" title="과제 목록 불러오는 중…" />;
  }
  const choices = (homework.data ?? []).filter((item) => !pendingOnly || reviewCounts?.[item.id]);
  if (pendingOnly && choices.length !== Object.keys(reviewCounts ?? {}).length) {
    return <EmptyState scope="panel" tone="error" title="과제 목록을 다시 확인해 주세요" actions={
      <Button onClick={() => { void homework.refetch(); void notifications.refetch(); }}>다시 시도</Button>
    } />;
  }
  if (!choices.length) {
    return <EmptyState scope="panel" tone="empty" title="등록된 과제가 없습니다" />;
  }

  const sessionsById = new Map(sessions.data?.map((session) => [session.id, session]));
  const lecturesById = new Map(lectures.data?.map((lecture) => [lecture.id, lecture]));
  return (
    <ul className="grid gap-2 sm:grid-cols-2" aria-label="검토할 과제">
      {choices.map((item) => {
        const session = sessionsById.get(Number(item.session));
        const lecture = session && lecturesById.get(session.lecture);
        return (
          <li key={item.id} className="min-w-0">
            <Link
              to={homeworkPath(item.id)}
              state={fromInbox ? { fromHomeworkInbox: true } : undefined}
              className="block h-full rounded-xl border border-[var(--tc-border,var(--color-border-divider))] bg-[var(--tc-surface,var(--color-bg-surface))] px-4 py-3 text-[var(--tc-text,var(--color-text-primary))] transition-colors hover:border-[var(--color-primary)] focus-visible:outline focus-visible:outline-[var(--color-primary)] motion-reduce:transition-none"
            >
              <span className="flex flex-wrap items-center gap-2">
                <span className="min-w-0 break-words text-sm font-semibold">{item.title}</span>
                {pendingOnly && reviewCounts && <Badge tone="warning">확인 대기 {reviewCounts[item.id]}건</Badge>}
              </span>
              {session && (
                <span className="mt-1 block break-words text-xs text-[var(--tc-text-muted,var(--color-text-muted))]">
                  {[lecture?.title || lecture?.name, session.display_label || session.title, session.date].filter(Boolean).join(" · ")}
                </span>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
