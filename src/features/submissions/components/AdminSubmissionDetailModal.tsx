// src/features/submissions/components/AdminSubmissionDetailModal.tsx
import { useEffect, useState } from "react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { Button } from "@/shared/ui/ds";
import { useSubmissionPolling } from "../hooks/useSubmissionPolling";
import SubmissionStatusBadge from "./SubmissionStatusBadge";
import {
  retryAnySubmission,
  fetchSubmissionManualReview,
  saveSubmissionManualReview,
} from "../api/adminSubmissions";

export default function AdminSubmissionDetailModal({
  open,
  onClose,
  submissionId,
  onGoResults,
}: {
  open: boolean;
  onClose: () => void;
  submissionId: number;
  examId?: number;
  onGoResults?: (examId: number) => void;
}) {
  const qc = useQueryClient();
  const poll = useSubmissionPolling(submissionId, open);
  const submission = poll.data;

  const [answers, setAnswers] = useState<any[]>([]);

  const load = useMutation({
    mutationFn: () => fetchSubmissionManualReview(submissionId),
    onSuccess: (d) => setAnswers(d?.answers ?? []),
  });

  useEffect(() => {
    if (open) load.mutate();
  }, [open]);

  const save = useMutation({
    mutationFn: () =>
      saveSubmissionManualReview(submissionId, {
        answers: answers.map((a) => ({
          question_id: a.question_id,
          question_no: a.question_no,
          answer: a.answer,
        })),
      }),
    onSuccess: () => qc.invalidateQueries(),
  });

  if (!open || !submission) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-[var(--bg-surface)] w-full max-w-4xl rounded-xl border">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="text-sm font-semibold">Submission #{submission.id}</div>
          <Button type="button" intent="ghost" size="sm" onClick={onClose}>닫기</Button>
        </div>

        <div className="p-4 space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <SubmissionStatusBadge status={submission.status} />
            {(submission.meta?.manual_review?.required || submission.meta?.ai_result?.result?.flags?.review_candidate) && (
              <span className="inline-flex items-center rounded-full border border-amber-700 bg-amber-950/50 px-2 py-1 text-xs text-amber-200">
                검토 후보
              </span>
            )}
          </div>

          {submission.meta?.manual_review?.required && (
            <>
              <div className="text-xs text-[var(--text-muted)]">
                일부 답안이 인식되지 않았습니다. 필요한 부분만 수정하세요.
              </div>

              <table className="table">
                <tbody>
                  {answers.map((a, i) => (
                    <tr key={i}>
                      <td>{a.question_no ?? a.question_id}</td>
                      <td>
                        <input
                          className="form-input"
                          value={a.answer ?? ""}
                          onChange={(e) =>
                            setAnswers((prev) =>
                              prev.map((p, idx) =>
                                idx === i ? { ...p, answer: e.target.value } : p
                              )
                            )
                          }
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <Button type="button" intent="primary" size="md" onClick={() => save.mutate()}>
                저장 후 재채점
              </Button>
            </>
          )}

          {(submission.status === "failed" || submission.status === "needs_identification") && (
            <Button type="button" intent="secondary" size="md" onClick={() => retryAnySubmission(submissionId)}>
              {submission.status === "needs_identification" ? "식별 확인 후 재채점" : "다시 처리"}
            </Button>
          )}

          {(submission.status === "done" || submission.status === "answers_ready") && onGoResults && (
            <Button type="button" intent="primary" size="md" onClick={() => onGoResults(submission.target_id)}>
              결과 보기
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
