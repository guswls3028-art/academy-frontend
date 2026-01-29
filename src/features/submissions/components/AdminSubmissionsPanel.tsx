// PATH: src/features/submissions/components/AdminSubmissionsPanel.tsx
import { useMemo, useState } from "react";
import type { Submission } from "@/features/submissions/types";
import SubmissionStatusBadge from "@/features/submissions/components/SubmissionStatusBadge";
import ManualReviewBadge from "@/features/submissions/components/ManualReviewBadge";
import AdminSubmissionDetailModal from "@/features/submissions/components/AdminSubmissionDetailModal";
import { useAdminSubmissions } from "@/features/submissions/hooks/useAdminSubmissions";
import { retryAnySubmission } from "@/features/submissions/api/adminSubmissions";
import { useMutation, useQueryClient } from "@tanstack/react-query";

function safeManualReview(meta: any): { required: boolean; reasons: string[]; updated_at?: string } {
  const mr = meta?.manual_review;
  return {
    required: Boolean(mr?.required),
    reasons: Array.isArray(mr?.reasons) ? mr.reasons.map(String) : [],
    updated_at: mr?.updated_at ? String(mr.updated_at) : undefined,
  };
}

export default function AdminSubmissionsPanel({
  examId,
  onGoResults,
}: {
  examId: number;
  onGoResults?: (examId: number) => void;
}) {
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const q = useAdminSubmissions({
    examId,
    enabled: Number.isFinite(examId) && examId > 0,
    limit: 100,
    polling: true,
  });

  const list: Submission[] = q.data ?? [];

  const stats = useMemo(() => {
    const out = {
      total: list.length,
      manual: 0,
      done: 0,
      failed: 0,
      processing: 0,
    };
    for (const s of list) {
      const mr = safeManualReview(s.meta);
      if (mr.required && s.status === "answers_ready") out.manual++;
      if (s.status === "done") out.done++;
      else if (s.status === "failed") out.failed++;
      else out.processing++;
    }
    return out;
  }, [list]);

  const retryMut = useMutation({
    mutationFn: async (id: number) => retryAnySubmission(id),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["admin-submissions", examId] });
      await qc.invalidateQueries({ queryKey: ["admin-submissions"] });
      alert("재처리 요청 완료");
    },
    onError: (e: any) => {
      alert(e?.response?.data?.detail || e?.message || "재처리 실패");
    },
  });

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4">
        <div className="mb-2 flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-neutral-100">제출 현황</div>
            <div className="text-xs text-neutral-500">
              업로드 → 인식 → (필요 시 수동 검토) → 채점 → 결과 확정
            </div>
          </div>
          <div className="text-xs text-neutral-400">
            exam_id: <span className="text-neutral-200">{examId}</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded-full border border-neutral-800 bg-neutral-900 px-3 py-1 text-neutral-300">
            전체 {stats.total}
          </span>
          <span className="rounded-full border border-neutral-800 bg-neutral-900 px-3 py-1 text-neutral-300">
            처리중 {stats.processing}
          </span>
          <span className="rounded-full border border-yellow-900 bg-yellow-950 px-3 py-1 text-yellow-200">
            수동검토 {stats.manual}
          </span>
          <span className="rounded-full border border-emerald-900 bg-emerald-950 px-3 py-1 text-emerald-200">
            완료 {stats.done}
          </span>
          <span className="rounded-full border border-red-900 bg-red-950 px-3 py-1 text-red-200">
            실패 {stats.failed}
          </span>
        </div>
      </div>

      <div className="rounded-xl border border-neutral-800 bg-neutral-950">
        <div className="border-b border-neutral-800 px-4 py-3">
          <div className="text-xs font-semibold text-neutral-300">제출 목록</div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-xs text-neutral-500">
              <tr className="border-b border-neutral-800">
                <th className="px-3 py-2 text-left">submission</th>
                <th className="px-3 py-2 text-left">enrollment</th>
                <th className="px-3 py-2 text-left">status</th>
                <th className="px-3 py-2 text-left">manual_review</th>
                <th className="px-3 py-2 text-left">action</th>
              </tr>
            </thead>

            <tbody className="text-neutral-100">
              {q.isLoading ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-neutral-500">
                    불러오는 중...
                  </td>
                </tr>
              ) : q.isError ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-red-300">
                    제출 목록 조회 실패
                  </td>
                </tr>
              ) : list.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-neutral-500">
                    아직 제출이 없습니다. 위에서 OMR 업로드 후 submission_id가 생성됩니다.
                  </td>
                </tr>
              ) : (
                list.map((s) => {
                  const mr = safeManualReview(s.meta);
                  const canRetry = s.status === "failed";

                  return (
                    <tr key={s.id} className="border-b border-neutral-900 hover:bg-neutral-900/30">
                      <td className="px-3 py-2">
                        <button
                          className="text-left text-sm text-neutral-100 underline decoration-neutral-700 underline-offset-2 hover:decoration-neutral-200"
                          onClick={() => setSelectedId(s.id)}
                        >
                          #{s.id}
                        </button>
                        <div className="text-xs text-neutral-500">exam #{s.target_id}</div>
                      </td>
                      <td className="px-3 py-2">
                        <div className="text-sm">{s.enrollment_id ?? "-"}</div>
                        <div className="text-xs text-neutral-500">{s.source}</div>
                      </td>
                      <td className="px-3 py-2">
                        <SubmissionStatusBadge status={s.status} />
                      </td>
                      <td className="px-3 py-2">
                        <ManualReviewBadge required={mr.required && s.status === "answers_ready"} reasons={mr.reasons} />
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-2">
                          <button
                            className="rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-xs text-neutral-100 hover:bg-neutral-800"
                            onClick={() => setSelectedId(s.id)}
                          >
                            상세
                          </button>

                          {s.status === "done" && typeof onGoResults === "function" ? (
                            <button
                              className="rounded-lg bg-emerald-100 px-3 py-1.5 text-xs text-emerald-950"
                              onClick={() => onGoResults(Number(s.target_id))}
                            >
                              결과
                            </button>
                          ) : null}

                          {canRetry ? (
                            <button
                              className="rounded-lg bg-red-100 px-3 py-1.5 text-xs text-red-950 disabled:opacity-50"
                              disabled={retryMut.isPending}
                              onClick={() => retryMut.mutate(s.id)}
                            >
                              {retryMut.isPending ? "재처리..." : "재처리"}
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="border-t border-neutral-800 px-4 py-3 text-xs text-neutral-500">
          {q.isFetching ? "상태 업데이트 중..." : " "}
        </div>
      </div>

      <AdminSubmissionDetailModal
        open={selectedId != null}
        submissionId={selectedId}
        examId={examId}
        onClose={() => setSelectedId(null)}
        onGoResults={onGoResults}
      />
    </div>
  );
}
