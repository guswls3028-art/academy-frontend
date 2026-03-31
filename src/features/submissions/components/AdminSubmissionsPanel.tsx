import { useQuery } from "@tanstack/react-query";
import { Button } from "@/shared/ui/ds";
import StudentNameWithLectureChip from "@/shared/ui/chips/StudentNameWithLectureChip";
import { fetchExamSubmissions } from "../api/adminSubmissionsApi";
import { SUBMISSION_STATUS_LABEL } from "../statusMaps";

export default function AdminSubmissionsPanel({
  examId,
  onGoResults,
}: {
  examId: number;
  onGoResults?: (examId: number) => void;
}) {
  const q = useQuery({
    queryKey: ["exam-submissions", examId],
    queryFn: () => fetchExamSubmissions(examId),
    refetchInterval: 3000, // 실운영용: 자동 갱신
  });

  if (q.isLoading) {
    return <div className="text-sm text-muted">제출 목록 불러오는 중…</div>;
  }

  if (q.isError) {
    return (
      <div className="rounded border border-red-600/30 bg-red-600/10 p-4 text-sm text-red-700">
        제출 목록 조회 실패. (submissions API 경로 확인 필요)
      </div>
    );
  }

  const rows = q.data ?? [];

  return (
    <div className="ds-surface rounded-xl p-4 space-y-3" style={{ border: '1px solid var(--color-border-divider)', background: 'var(--color-bg-surface)' }}>
      <div className="flex justify-between items-center">
        <div className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
          제출 / 처리 상태
        </div>

        <Button type="button" intent="ghost" size="sm" onClick={() => q.refetch()} className="text-xs">
          새로고침
        </Button>
      </div>

      {rows.length === 0 && (
        <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
          아직 제출된 OMR이 없습니다.
        </div>
      )}

      <div className="divide-y" style={{ borderColor: 'var(--color-border-divider)' }}>
        {rows.map((r) => (
          <div
            key={r.id}
            className="flex justify-between items-center py-2 text-xs"
            style={{ color: 'var(--color-text-primary)' }}
          >
            <div>
              <div className="font-medium">
                <StudentNameWithLectureChip name={`${r.student_name} (#${r.enrollment_id})`} enrollmentId={r.enrollment_id} />
              </div>
              <div style={{ color: 'var(--color-text-muted)' }}>
                {new Date(r.created_at).toLocaleString()}
              </div>
            </div>

            <div className="flex items-center gap-4">
              <span>
                {SUBMISSION_STATUS_LABEL[r.status] ?? r.status}
              </span>

              <span className="font-semibold">
                {r.score ?? "-"}
              </span>
            </div>
          </div>
        ))}
      </div>

      {rows.some((r) => r.status === "done" || r.status === "answers_ready") && onGoResults && (
        <div className="pt-3 text-right">
          <Button type="button" intent="primary" size="sm" onClick={() => onGoResults(examId)}>
            결과 보기
          </Button>
        </div>
      )}
    </div>
  );
}
