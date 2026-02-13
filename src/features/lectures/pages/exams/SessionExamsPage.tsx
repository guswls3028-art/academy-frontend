// PATH: src/features/lectures/pages/exams/SessionExamsPage.tsx
// 차시(세션) 시험 탭 — 해당 차시에 연결된 시험 목록 및 요약

import { useQuery } from "@tanstack/react-query";
import { fetchAdminSessionExams } from "@/features/results/api/adminSessionExams";
import SessionExamSummaryPanel from "@/features/results/panels/SessionExamSummaryPanel";
import { EmptyState } from "@/shared/ui/ds";

type Props = {
  sessionId: number;
};

export default function SessionExamsPage({ sessionId }: Props) {
  const { data: exams = [], isLoading } = useQuery({
    queryKey: ["admin-session-exams", sessionId],
    queryFn: () => fetchAdminSessionExams(sessionId),
    enabled: Number.isFinite(sessionId),
  });

  if (isLoading) {
    return <EmptyState scope="panel" tone="loading" title="불러오는 중…" />;
  }

  if (!exams.length) {
    return (
      <EmptyState
        scope="panel"
        title="이 차시에 연결된 시험이 없습니다."
        description="좌측 평가 패널에서 시험을 추가할 수 있습니다."
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <SessionExamSummaryPanel sessionId={sessionId} />
      <div className="text-sm text-[var(--color-text-muted)]">
        시험 {exams.length}건 연결됨 · 채점/상세는 성적 탭에서 이용하세요.
      </div>
    </div>
  );
}
