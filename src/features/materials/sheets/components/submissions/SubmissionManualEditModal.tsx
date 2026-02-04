// PATH: src/features/materials/sheets/components/submissions/SubmissionManualEditModal.tsx
// SSOT ALIGN (domains/submissions):
// - manual-edit: POST /submissions/submissions/<submission_id>/manual-edit/
//   payload:
//     {
//       identifier: any,
//       answers: [{ exam_question_id, answer }],
//       note: string
//     }
//
// NOTE (중요):
// - 현재 백엔드에는 "submission answers 조회" 전용 endpoint가 제공되지 않는다.
// - 따라서 이 모달은 운영자가 "필요한 문항만" 직접 입력하여 보정하는 방식으로 설계한다.
// - 입력이 비어있는 문항은 서버에 보내지지 않는다(불필요 update 방지).

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useMutation } from "@tanstack/react-query";
import type { SheetQuestionEntity } from "../../sheets.api";
import { manualEditSubmissionApi } from "./submissions.api";

export default function SubmissionManualEditModal({
  open,
  onClose,
  examId,
  submissionId,
  questions,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  examId: number;
  submissionId: number;
  questions: SheetQuestionEntity[];
  onDone: () => void;
}) {
  const sorted = useMemo(() => (questions ?? []).slice().sort((a, b) => a.number - b.number), [questions]);

  // identifier override: enrollment_id 등 (백엔드에서 그대로 meta에 저장)
  const [identifierEnrollmentId, setIdentifierEnrollmentId] = useState<string>("");
  const [note, setNote] = useState<string>("manual_edit");

  // answers: key=exam_question_id(string)
  const [localAnswers, setLocalAnswers] = useState<Record<string, string>>({});

  const mut = useMutation({
    mutationFn: async () => {
      const answers = Object.entries(localAnswers)
        .map(([k, v]) => ({
          exam_question_id: Number(k),
          answer: String(v ?? ""),
        }))
        .filter((a) => Number.isFinite(a.exam_question_id) && a.exam_question_id > 0)
        // 비어있는 답은 보내지지 않게 (운영 실수 방지)
        .filter((a) => String(a.answer).trim().length > 0);

      const identifier =
        identifierEnrollmentId.trim().length > 0
          ? { enrollment_id: Number(identifierEnrollmentId.trim()) || identifierEnrollmentId.trim() }
          : null;

      return await manualEditSubmissionApi({
        submissionId,
        identifier,
        note: note.trim() || "manual_edit",
        answers,
      });
    },
    onSuccess: () => {
      alert("수동 수정이 반영되었습니다. 채점이 재시도되었을 수 있습니다(서버 로직).");
      onDone();
    },
    onError: (e: any) => alert(e?.message || "수동 수정 실패"),
  });

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-[1px] flex items-center justify-center p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-5xl rounded-2xl bg-[var(--bg-page)] shadow-2xl overflow-hidden border">
        <div className="px-6 py-4 border-b bg-[var(--bg-surface)] flex items-center justify-between">
          <div>
            <div className="text-base font-extrabold">제출 수동 수정</div>
            <div className="text-xs text-[var(--text-muted)] mt-1">
              exam_id: {examId} · submission_id: {submissionId}
            </div>
          </div>

          <button className="btn" onClick={onClose} disabled={mut.isPending}>
            닫기
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="rounded-xl border bg-[var(--bg-surface-soft)] p-4 space-y-3">
            <div className="text-sm font-semibold">식별자(선택)</div>
            <div className="text-xs text-gray-600">
              enrollment_id 식별이 실패한 경우(backend: needs_identification) 운영자가 강제로 지정할 수 있습니다.
              <br />
              이 값은 submission.meta에 override로 저장됩니다(백엔드 로직).
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <input
                className="input w-56"
                placeholder="enrollment_id (숫자)"
                value={identifierEnrollmentId}
                onChange={(e) => setIdentifierEnrollmentId(e.target.value)}
              />

              <input
                className="input flex-1 min-w-[240px]"
                placeholder="note (예: 조교 수동 보정)"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={120}
              />
            </div>
          </div>

          <div>
            <div className="text-sm font-semibold">답안 입력</div>
            <div className="text-xs text-gray-600 mt-1">
              필요한 문항만 입력하세요. 비어있는 항목은 서버로 전송되지 않습니다.
              <br />
              exam_question_id 기준(단일진실)으로 저장됩니다.
            </div>

            <div className="mt-3 rounded-xl border overflow-hidden">
              <table className="table">
                <thead>
                  <tr>
                    <th className="w-24">번호</th>
                    <th>exam_question_id</th>
                    <th className="w-64">답안</th>
                    <th className="w-28 text-right">작업</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((q) => {
                    const key = String(q.id);
                    return (
                      <tr key={q.id}>
                        <td>#{q.number}</td>
                        <td className="text-xs text-gray-600">{q.id}</td>
                        <td>
                          <input
                            className="input w-full"
                            placeholder="예: A 또는 3 또는 주관식 텍스트"
                            value={localAnswers[key] ?? ""}
                            onChange={(e) =>
                              setLocalAnswers((prev) => ({
                                ...prev,
                                [key]: e.target.value,
                              }))
                            }
                          />
                        </td>
                        <td className="text-right">
                          <button
                            type="button"
                            className="btn"
                            onClick={() =>
                              setLocalAnswers((prev) => {
                                const next = { ...prev };
                                delete next[key];
                                return next;
                              })
                            }
                          >
                            지우기
                          </button>
                        </td>
                      </tr>
                    );
                  })}

                  {sorted.length === 0 && (
                    <tr>
                      <td colSpan={4}>
                        <div className="p-4 text-xs text-gray-600">
                          문항이 없습니다. 먼저 “문항 자동 복구”로 문항을 생성하세요.
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2">
            <button className="btn" onClick={onClose} disabled={mut.isPending}>
              취소
            </button>
            <button
              className="btn-primary"
              disabled={mut.isPending}
              onClick={() => mut.mutate()}
            >
              {mut.isPending ? "저장 중..." : "저장 및 채점 재개"}
            </button>
          </div>

          <div className="text-[11px] text-gray-600">
            ⚠️ 수동 수정은 운영 권한이 필요한 작업입니다. 서버 정책(채점/결과 도메인)에 따라 즉시 채점이 재개될 수 있습니다.
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
