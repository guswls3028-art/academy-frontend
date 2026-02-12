import { useQuery } from "@tanstack/react-query";
import { Button } from "@/shared/ui/ds";
import { fetchExamSubmissions } from "../api/adminSubmissionsApi";

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
    <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4 space-y-3">
      <div className="flex justify-between items-center">
        <div className="text-sm font-semibold text-neutral-100">
          제출 / 처리 상태
        </div>

        <Button type="button" intent="ghost" size="sm" onClick={() => q.refetch()} className="text-xs bg-neutral-800 text-neutral-200">
          새로고침
        </Button>
      </div>

      {rows.length === 0 && (
        <div className="text-xs text-neutral-400">
          아직 제출된 OMR이 없습니다.
        </div>
      )}

      <div className="divide-y divide-neutral-800">
        {rows.map((r) => (
          <div
            key={r.id}
            className="flex justify-between items-center py-2 text-xs text-neutral-200"
          >
            <div>
              <div className="font-medium">
                {r.student_name} (#{r.enrollment_id})
              </div>
              <div className="text-neutral-400">
                {new Date(r.created_at).toLocaleString()}
              </div>
            </div>

            <div className="flex items-center gap-4">
              <span>
                {r.status === "pending" && "대기"}
                {r.status === "processing" && "처리중"}
                {r.status === "done" && "완료"}
                {r.status === "failed" && "실패"}
              </span>

              <span className="font-semibold">
                {r.score ?? "-"}
              </span>
            </div>
          </div>
        ))}
      </div>

      {rows.some((r) => r.status === "done") && onGoResults && (
        <div className="pt-3 text-right">
          <Button type="button" intent="primary" size="sm" onClick={() => onGoResults(examId)}>
            결과 보기
          </Button>
        </div>
      )}
    </div>
  );
}
