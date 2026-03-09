/**
 * 답안 등록 모달 — 문항 수·기본 점수·문항 반영 + 정답표(AnswerKeyEditor)를 한 모달에서 처리.
 * 패널에서는 "답안등록하기" 버튼만 노출하고, 클릭 시 이 모달을 띄운다.
 */

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AdminModal, ModalHeader, ModalBody, ModalFooter, MODAL_WIDTH } from "@/shared/ui/modal";
import { Button } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";
import { fetchQuestionsByExam } from "../../api/questionApi";
import { initExamQuestions } from "../../api/questionInitApi";
import { AnswerKeyEditor } from "../AnswerKeyEditor";

type Props = {
  open: boolean;
  onClose: () => void;
  examId: number;
  /** 구조 소유 시험 ID (template 또는 regular). AnswerKey 생성 시 사용 */
  structureOwnerId: number;
};

export default function AnswerKeyRegisterModal({
  open,
  onClose,
  examId,
  structureOwnerId,
}: Props) {
  const qc = useQueryClient();
  const { data: questions = [] } = useQuery({
    queryKey: ["exam-questions", examId],
    queryFn: () => fetchQuestionsByExam(examId).then((r) => r.data),
    enabled: open && Number.isFinite(examId),
  });

  const [total, setTotal] = useState<number | "">("");
  const [score, setScore] = useState<number | "">(1);

  const initMut = useMutation({
    mutationFn: async () => {
      const t = typeof total === "number" ? total : Number(total);
      const s = typeof score === "number" ? score : Number(score);
      return initExamQuestions({
        examId,
        total_questions: Number.isFinite(t) ? t : 0,
        default_score: Number.isFinite(s) ? s : 1,
      });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["exam-questions", examId] });
      feedback.success("문항이 반영되었습니다.");
    },
    onError: (e: any) => {
      feedback.error(e?.response?.data?.detail ?? "문항 반영 실패");
    },
  });

  if (!open) return null;

  return (
    <AdminModal open onClose={onClose} type="action" width={MODAL_WIDTH.wide}>
      <ModalHeader
        type="action"
        title="답안 등록"
        description="문항 수·기본 점수를 설정하고 문항을 반영한 뒤, 문항별 정답을 입력해 저장합니다. 채점 시 사용됩니다."
      />
      <ModalBody>
        <div className="modal-scroll-body modal-scroll-body--compact space-y-6">
          {/* 문항선택하기 */}
          <div className="space-y-3">
            <div className="text-sm font-semibold text-[var(--text-primary)]">문항선택하기</div>
            <div className="rounded border border-[var(--border-divider)] bg-[var(--color-bg-surface-soft)] px-4 py-3">
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm text-[var(--color-text-secondary)]">
                  현재 문항 <strong className="text-[var(--color-text-primary)]">{questions.length}</strong>개
                </span>
              </div>
              <div className="mt-3 flex flex-wrap items-end gap-2">
                <label className="grid gap-1">
                  <span className="text-xs text-[var(--text-muted)]">문항 수</span>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={total}
                    onChange={(e) => setTotal(e.target.value === "" ? "" : Number(e.target.value))}
                    placeholder="예: 20"
                    className="h-9 w-[140px] rounded border border-[var(--border-divider)] bg-[var(--bg-app)] px-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
                  />
                </label>
                <label className="grid gap-1">
                  <span className="text-xs text-[var(--text-muted)]">기본 점수</span>
                  <input
                    type="number"
                    min={0}
                    step={0.5}
                    value={score}
                    onChange={(e) => setScore(e.target.value === "" ? "" : Number(e.target.value))}
                    className="h-9 w-[140px] rounded border border-[var(--border-divider)] bg-[var(--bg-app)] px-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
                  />
                </label>
                <Button
                  type="button"
                  intent="secondary"
                  size="sm"
                  onClick={() => initMut.mutate()}
                  disabled={initMut.isPending}
                  loading={initMut.isPending}
                >
                  문항 반영
                </Button>
              </div>
            </div>
          </div>

          {/* 정답표 (AnswerKeyEditor) */}
          <div className="space-y-3">
            <AnswerKeyEditor
              examId={examId}
              createExamId={structureOwnerId}
              disabled={false}
            />
          </div>
        </div>
      </ModalBody>
      <ModalFooter
        right={
          <Button intent="secondary" onClick={onClose}>
            닫기
          </Button>
        }
      />
    </AdminModal>
  );
}
