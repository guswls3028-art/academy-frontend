// PATH: src/features/submissions/components/AdminSubmissionDetailModal.tsx
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { Submission } from "@/features/submissions/types";
import SubmissionStatusBadge from "@/features/submissions/components/SubmissionStatusBadge";
import { useSubmissionPolling } from "@/features/submissions/hooks/useSubmissionPolling";
import { retryAnySubmission, fetchSubmissionManualReview, saveSubmissionManualReview } from "@/features/submissions/api/adminSubmissions";

function safeManualReview(meta: any): { required: boolean; reasons: string[]; updated_at?: string } {
  const mr = meta?.manual_review;
  return {
    required: Boolean(mr?.required),
    reasons: Array.isArray(mr?.reasons) ? mr.reasons.map(String) : [],
    updated_at: mr?.updated_at ? String(mr.updated_at) : undefined,
  };
}

function invalidReasonFromMeta(meta: any): string | null {
  const r = meta?.grading?.invalid_reason ?? meta?.invalid_reason;
  if (!r) return null;
  return String(r);
}

export default function AdminSubmissionDetailModal({
  open,
  onClose,
  submissionId,
  examId,
  onGoResults,
}: {
  open: boolean;
  onClose: () => void;
  submissionId: number | null;
  examId?: number;
  onGoResults?: (examId: number) => void;
}) {
  const qc = useQueryClient();

  const poll = useSubmissionPolling(submissionId ?? undefined, open && !!submissionId);
  const submission: Submission | null = poll.data ?? null;

  const manualReview = useMemo(() => safeManualReview(submission?.meta), [submission?.meta]);
  const needsManual = (submission?.status === "answers_ready") && manualReview.required;

  const [identifier, setIdentifier] = useState<string>("");
  const [answers, setAnswers] = useState<Array<{ question_id?: number; question_no?: number; answer: string; meta?: any }>>([]);

  const loadReviewMut = useMutation({
    mutationFn: async () => fetchSubmissionManualReview(submissionId!),
    onSuccess: (data) => {
      setIdentifier(String(data?.identifier ?? ""));
      const list = Array.isArray(data?.answers) ? data.answers : [];
      setAnswers(
        list.map((a: any) => ({
          question_id: Number.isFinite(a?.question_id) ? Number(a.question_id) : undefined,
          question_no: Number.isFinite(a?.question_no) ? Number(a.question_no) : undefined,
          answer: String(a?.answer ?? ""),
          meta: a?.meta,
        }))
      );
    },
  });

  useEffect(() => {
    if (!open || !submissionId) return;
    setIdentifier("");
    setAnswers([]);
    // only load manual review payload when review is required OR operator wants to edit
    loadReviewMut.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, submissionId]);

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!submissionId) throw new Error("submissionId required");
      return saveSubmissionManualReview(submissionId, {
        identifier: identifier.trim() ? identifier.trim() : null,
        answers: answers.map((a) => ({
          question_id: a.question_id,
          question_no: a.question_no,
          answer: String(a.answer ?? ""),
        })),
      });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["submission", submissionId] });
      await qc.invalidateQueries({ queryKey: ["admin-submissions"] });
      alert("저장 완료: 재채점이 진행됩니다.");
    },
    onError: (e: any) => {
      alert(e?.response?.data?.detail || e?.message || "저장 실패");
    },
  });

  const retryMut = useMutation({
    mutationFn: async () => retryAnySubmission(submissionId!),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["submission", submissionId] });
      await qc.invalidateQueries({ queryKey: ["admin-submissions"] });
      alert("재처리 요청 완료");
    },
    onError: (e: any) => {
      alert(e?.response?.data?.detail || e?.message || "재처리 실패");
    },
  });

  const stageLabel = useMemo(() => {
    const st = submission?.status;
    if (!st) return "불러오는 중";
    if (st === "submitted" || st === "dispatched" || st === "extracting") return "처리 중";
    if (st === "answers_ready") return manualReview.required ? "수동 검토 필요" : "답안 생성됨";
    if (st === "grading") return "채점 중";
    if (st === "done") return "완료";
    if (st === "failed") return "실패";
    return st;
  }, [submission?.status, manualReview.required]);

  const canRetry = submission?.status === "failed";
  const canSave = needsManual && !saveMut.isPending;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-5xl overflow-hidden rounded-xl border border-neutral-800 bg-neutral-950 shadow-xl">
        <div className="flex items-center justify-between border-b border-neutral-800 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="text-sm font-semibold text-neutral-100">제출 상세</div>
            <div className="text-xs text-neutral-400">
              {submissionId ? `submission #${submissionId}` : "-"}
              {submission?.target_id ? ` · exam #${submission.target_id}` : ""}
              {submission?.enrollment_id ? ` · enrollment #${submission.enrollment_id}` : ""}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              className="rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-sm text-neutral-100 hover:bg-neutral-800"
              onClick={onClose}
            >
              닫기
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 p-4 lg:grid-cols-3">
          {/* Left: Status & Actions */}
          <div className="space-y-3 lg:col-span-1">
            <div className="rounded-xl border border-neutral-800 bg-neutral-900/30 p-4">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-xs font-semibold text-neutral-200">현재 상태</div>
                <SubmissionStatusBadge status={submission?.status ?? null} />
              </div>

              <div className="text-sm text-neutral-200">{stageLabel}</div>

              {manualReview.required ? (
                <div className="mt-2 rounded-lg border border-yellow-900 bg-yellow-950/40 p-3 text-xs text-yellow-200">
                  <div className="font-semibold">⚠️ 수동 검토 필요</div>
                  <div className="mt-1 text-yellow-200/90">
                    사유:{" "}
                    <span className="font-medium">
                      {manualReview.reasons.length ? manualReview.reasons.join(", ") : "-"}
                    </span>
                  </div>
                  {manualReview.updated_at ? (
                    <div className="mt-1 text-yellow-200/70">updated_at: {manualReview.updated_at}</div>
                  ) : null}
                </div>
              ) : null}

              {submission?.status === "failed" ? (
                <div className="mt-2 rounded-lg border border-red-900 bg-red-950/40 p-3 text-xs text-red-200">
                  <div className="font-semibold">실패 원인</div>
                  <div className="mt-1 whitespace-pre-wrap break-words text-red-200/90">
                    {submission?.error_message || "error_message 없음"}
                  </div>
                </div>
              ) : null}

              <div className="mt-3 flex flex-wrap gap-2">
                {submission?.status === "done" && typeof onGoResults === "function" ? (
                  <button
                    className="rounded-lg bg-emerald-100 px-3 py-2 text-sm text-emerald-950"
                    onClick={() => {
                      const tid = Number(submission?.target_id ?? examId ?? 0);
                      if (Number.isFinite(tid) && tid > 0) onGoResults(tid);
                    }}
                  >
                    결과 보기
                  </button>
                ) : null}

                {canRetry ? (
                  <button
                    className="rounded-lg bg-red-100 px-3 py-2 text-sm text-red-950 disabled:opacity-50"
                    onClick={() => retryMut.mutate()}
                    disabled={retryMut.isPending || !submissionId}
                  >
                    {retryMut.isPending ? "재처리 중..." : "재처리"}
                  </button>
                ) : null}
              </div>
            </div>

            <div className="rounded-xl border border-neutral-800 bg-neutral-900/30 p-4">
              <div className="text-xs font-semibold text-neutral-200">진행 상황</div>
              <div className="mt-2 text-xs text-neutral-400">
                - submitted / dispatched / extracting: 처리 중<br />
                - answers_ready: 답안 생성됨 (수동 검토 필요 여부 확인)<br />
                - grading: 채점 중<br />
                - done: 완료 (결과 보기 가능)<br />
                - failed: 실패 (재처리 가능)
              </div>
            </div>
          </div>

          {/* Right: Manual Review Editor */}
          <div className="space-y-3 lg:col-span-2">
            {needsManual ? (
              <div className="rounded-xl border border-yellow-900 bg-yellow-950/20 p-4">
                <div className="mb-2 text-sm font-semibold text-yellow-200">수동 검토</div>
                <div className="text-xs text-yellow-200/80">
                  이 화면은 “표시 및 수정”만 합니다. 점수/정답 비교/AI 해석은 하지 않습니다.
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-neutral-800 bg-neutral-900/30 p-4">
                <div className="text-sm font-semibold text-neutral-100">검토 · 수정</div>
                <div className="mt-1 text-xs text-neutral-400">
                  수동 검토가 필요할 때만 저장이 활성화됩니다.
                </div>
              </div>
            )}

            <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="text-sm font-semibold text-neutral-100">식별자 (identifier)</div>
                <div className="text-xs text-neutral-500">
                  {loadReviewMut.isPending ? "불러오는 중..." : ""}
                </div>
              </div>

              <input
                className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 outline-none"
                placeholder="예: 학생 식별자 (운영 정책에 따라 사용)"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                disabled={!needsManual}
              />

              <div className="mt-2 text-xs text-neutral-500">
                ※ identifier는 “표시/수정”만 합니다. 학생 매칭/판단 로직은 서버 단일진실입니다.
              </div>
            </div>

            <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="text-sm font-semibold text-neutral-100">문항 답안 수정</div>
                <div className="text-xs text-neutral-500">
                  {answers.length ? `${answers.length}개 문항` : "문항 데이터 없음"}
                </div>
              </div>

              {answers.length === 0 ? (
                <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-3 text-sm text-neutral-400">
                  문항 데이터가 없습니다. (서버 manual-edit 응답을 확인하세요)
                </div>
              ) : (
                <div className="max-h-[52vh] overflow-auto rounded-lg border border-neutral-800">
                  <table className="min-w-full text-sm">
                    <thead className="sticky top-0 bg-neutral-950 text-xs text-neutral-400">
                      <tr className="border-b border-neutral-800">
                        <th className="px-3 py-2 text-left">문항</th>
                        <th className="px-3 py-2 text-left">답</th>
                        <th className="px-3 py-2 text-left">invalid_reason</th>
                      </tr>
                    </thead>
                    <tbody className="text-neutral-100">
                      {answers.map((a, idx) => {
                        const qLabel =
                          Number.isFinite(a.question_no) && (a.question_no as number) > 0
                            ? `#${a.question_no}`
                            : Number.isFinite(a.question_id) && (a.question_id as number) > 0
                              ? `id:${a.question_id}`
                              : `row:${idx + 1}`;

                        const inv = invalidReasonFromMeta(a.meta);

                        return (
                          <tr key={idx} className="border-b border-neutral-900">
                            <td className="px-3 py-2 text-xs text-neutral-300">{qLabel}</td>
                            <td className="px-3 py-2">
                              <input
                                className="w-full rounded-md border border-neutral-800 bg-neutral-900 px-2 py-1 text-sm text-neutral-100 outline-none"
                                value={a.answer}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  setAnswers((prev) =>
                                    prev.map((p, i) => (i === idx ? { ...p, answer: v } : p))
                                  );
                                }}
                                disabled={!needsManual}
                              />
                            </td>
                            <td className="px-3 py-2 text-xs text-neutral-400">
                              {inv ? (
                                <span className="rounded-full border border-neutral-800 bg-neutral-900 px-2 py-0.5">
                                  {inv}
                                </span>
                              ) : (
                                "-"
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="mt-3 flex items-center justify-between gap-2">
                <div className="text-xs text-neutral-500">
                  ※ invalid_reason은 표시만 합니다. 판단/점수 계산은 하지 않습니다.
                </div>

                <button
                  className="rounded-lg bg-yellow-100 px-4 py-2 text-sm text-yellow-950 disabled:opacity-40"
                  disabled={!canSave || saveMut.isPending || !submissionId}
                  onClick={() => saveMut.mutate()}
                  title={!needsManual ? "수동 검토 필요 상태에서만 저장 가능" : ""}
                >
                  {saveMut.isPending ? "저장 중..." : "저장 + 재채점"}
                </button>
              </div>
            </div>

            {submission?.meta?.manual_edits ? (
              <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4">
                <div className="mb-2 text-sm font-semibold text-neutral-100">수정 이력 (meta.manual_edits)</div>
                <pre className="max-h-[240px] overflow-auto rounded-lg border border-neutral-800 bg-neutral-900 p-3 text-xs text-neutral-300">
                  {JSON.stringify(submission.meta.manual_edits, null, 2)}
                </pre>
              </div>
            ) : null}
          </div>
        </div>

        <div className="border-t border-neutral-800 px-4 py-3 text-xs text-neutral-500">
          {poll.isFetching ? "상태 업데이트 중..." : " "}
        </div>
      </div>
    </div>
  );
}
