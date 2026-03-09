/**
 * 답안 등록 모달 — 객관식/주관식 문항 수·배점 입력 후, 선택형/서술형 섹션으로 정답 입력.
 * 예시 이미지와 동일: 선택형(1~5 번호), 서술형(해설참조), 총점 표시·저장.
 */

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AdminModal, ModalHeader, ModalBody, ModalFooter, MODAL_WIDTH } from "@/shared/ui/modal";
import { Button } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";
import { fetchQuestionsByExam, type ExamQuestion } from "../api/questionApi";
import { initExamQuestions } from "../api/questionInitApi";
import {
  createAnswerKey,
  fetchAnswerKeyByExam,
  updateAnswerKey,
  type AnswerKey,
} from "../api/answerKeyApi";

type Props = {
  open: boolean;
  onClose: () => void;
  examId: number;
  structureOwnerId: number;
};

const CHOICES = ["1", "2", "3", "4", "5"];

function normalizeAnswers(input: Record<string, string>) {
  const out: Record<string, string> = {};
  Object.entries(input || {}).forEach(([k, v]) => {
    out[String(k)] = String(v ?? "").trim();
  });
  return out;
}

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

  const { data: answerKeyList } = useQuery({
    queryKey: ["answer-key", examId],
    queryFn: () => fetchAnswerKeyByExam(examId),
    enabled: open && questions.length > 0,
  });
  const answerKey = (answerKeyList?.data ?? [])[0] ?? null;

  const [choiceCount, setChoiceCount] = useState<number | "">("");
  const [choiceScore, setChoiceScore] = useState<number | "">(5);
  const [essayCount, setEssayCount] = useState<number | "">("");
  const [essayScore, setEssayScore] = useState<number | "">(5);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saveBusy, setSaveBusy] = useState(false);

  const sortedQuestions = useMemo(
    () => [...questions].sort((a, b) => a.number - b.number),
    [questions]
  );

  const effectiveChoiceCount =
    questions.length > 0 && (choiceCount === "" || essayCount === "")
      ? questions.length
      : Math.max(0, Number(choiceCount) || 0);
  const effectiveEssayCount =
    questions.length > 0 && (choiceCount === "" || essayCount === "")
      ? 0
      : Math.max(0, Number(essayCount) || 0);
  const choiceQuestions = sortedQuestions.slice(0, effectiveChoiceCount);
  const essayQuestions = sortedQuestions.slice(effectiveChoiceCount);

  const totalScore = useMemo(
    () => sortedQuestions.reduce((sum, q) => sum + (q.score ?? 0), 0),
    [sortedQuestions]
  );
  const choiceTotalScore = choiceQuestions.reduce((sum, q) => sum + (q.score ?? 0), 0);
  const essayTotalScore = essayQuestions.reduce((sum, q) => sum + (q.score ?? 0), 0);

  useEffect(() => {
    if (!answerKey || !answerKey.answers) return;
    setDraft(normalizeAnswers(answerKey.answers));
  }, [answerKey?.id]);

  const initMut = useMutation({
    mutationFn: async () => {
      const cc = Number(choiceCount) || 0;
      const ec = Number(essayCount) || 0;
      const cs = Number(choiceScore) || 5;
      const es = Number(essayScore) || 5;
      if (cc + ec === 0) throw new Error("객관식+주관식 문항 수 합이 1 이상이어야 합니다.");
      return initExamQuestions({
        examId: structureOwnerId,
        choice_count: cc,
        choice_score: cs,
        essay_count: ec,
        essay_score: es,
      });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["exam-questions", examId] });
      await qc.invalidateQueries({ queryKey: ["exam-questions", structureOwnerId] });
      await qc.invalidateQueries({ queryKey: ["answer-key", examId] });
      feedback.success("문항이 반영되었습니다.");
    },
    onError: (e: any) => {
      feedback.error(e?.response?.data?.detail ?? "문항 반영 실패");
    },
  });

  const handleSave = async () => {
    setSaveBusy(true);
    try {
      const normalized = normalizeAnswers(draft);
      const targetExamId = structureOwnerId ?? examId;
      if (!answerKey) {
        await createAnswerKey({ exam: targetExamId, answers: normalized });
      } else {
        await updateAnswerKey(answerKey.id, { answers: normalized });
      }
      await qc.invalidateQueries({ queryKey: ["answer-key", examId] });
      feedback.success("저장되었습니다.");
    } catch (e: any) {
      feedback.error(e?.response?.data?.detail ?? "저장 실패");
    } finally {
      setSaveBusy(false);
    }
  };

  if (!open) return null;

  const hasQuestions = questions.length > 0;

  return (
    <AdminModal open onClose={onClose} type="action" width={MODAL_WIDTH.wide}>
      <ModalHeader
        type="action"
        title="답안 등록"
        description={
          hasQuestions
            ? "선택형·서술형 문항별 정답을 입력하고 저장합니다. 채점 시 사용됩니다."
            : "객관식·주관식 문항 수와 배점을 입력한 뒤 문항 반영을 누르세요."
        }
      />
      <ModalBody>
        <div className="modal-scroll-body modal-scroll-body--compact space-y-6">
          {/* 문항 수·배점 입력 (항상 표시) */}
          <div className="space-y-3">
            <div className="text-sm font-semibold text-[var(--text-primary)]">문항 구성</div>
            <div className="rounded border border-[var(--border-divider)] bg-[var(--color-bg-surface-soft)] px-4 py-3">
              <div className="flex flex-wrap items-end gap-4">
                <label className="grid gap-1">
                  <span className="text-xs text-[var(--text-muted)]">객관식(선택형) 문항 수</span>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={choiceCount}
                    onChange={(e) =>
                      setChoiceCount(e.target.value === "" ? "" : Number(e.target.value))
                    }
                    placeholder="예: 19"
                    className="h-9 w-[120px] rounded border border-[var(--border-divider)] bg-[var(--bg-app)] px-3 text-sm"
                  />
                </label>
                <label className="grid gap-1">
                  <span className="text-xs text-[var(--text-muted)]">객관식 기본 점수</span>
                  <input
                    type="number"
                    min={0}
                    step={0.5}
                    value={choiceScore}
                    onChange={(e) =>
                      setChoiceScore(e.target.value === "" ? "" : Number(e.target.value))
                    }
                    className="h-9 w-[100px] rounded border border-[var(--border-divider)] bg-[var(--bg-app)] px-3 text-sm"
                  />
                </label>
                <label className="grid gap-1">
                  <span className="text-xs text-[var(--text-muted)]">주관식(서술형) 문항 수</span>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={essayCount}
                    onChange={(e) =>
                      setEssayCount(e.target.value === "" ? "" : Number(e.target.value))
                    }
                    placeholder="예: 1"
                    className="h-9 w-[120px] rounded border border-[var(--border-divider)] bg-[var(--bg-app)] px-3 text-sm"
                  />
                </label>
                <label className="grid gap-1">
                  <span className="text-xs text-[var(--text-muted)]">주관식 기본 점수</span>
                  <input
                    type="number"
                    min={0}
                    step={0.5}
                    value={essayScore}
                    onChange={(e) =>
                      setEssayScore(e.target.value === "" ? "" : Number(e.target.value))
                    }
                    className="h-9 w-[100px] rounded border border-[var(--border-divider)] bg-[var(--bg-app)] px-3 text-sm"
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
              {hasQuestions && (
                <p className="mt-2 text-xs text-[var(--text-muted)]">
                  현재 문항 <strong>{questions.length}</strong>개 (선택형 {effectiveChoiceCount}
                  문항, 서술형 {effectiveEssayCount}문항)
                </p>
              )}
            </div>
          </div>

          {!hasQuestions && (
            <div className="rounded border border-[var(--border-divider)] bg-[var(--bg-surface)] px-4 py-6 text-center text-sm text-[var(--text-muted)]">
              위에서 객관식·주관식 문항 수와 배점을 입력한 뒤 &quot;문항 반영&quot;을 누르면
              아래에 선택형·서술형 답안 입력란이 나타납니다.
            </div>
          )}

          {hasQuestions && (
            <>
              {/* 선택형 (객관식) */}
              {choiceQuestions.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                    선택형 (객관식) — {choiceTotalScore}점 · {choiceQuestions.length}문항
                  </h3>
                  <div className="rounded border border-[var(--border-divider)] bg-[var(--bg-surface)]">
                    <ul className="divide-y divide-[var(--border-divider)]">
                      {choiceQuestions.map((q) => (
                        <ChoiceRow
                          key={q.id}
                          question={q}
                          draft={draft[String(q.id)] ?? ""}
                          onChange={(value) =>
                            setDraft((prev) => ({ ...prev, [String(q.id)]: value }))
                          }
                        />
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {/* 서술형 (주관식) */}
              {essayQuestions.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                    서술형 (주관식) — {essayTotalScore}점 · {essayQuestions.length}문항
                  </h3>
                  <div className="rounded border border-[var(--border-divider)] bg-[var(--bg-surface)]">
                    <ul className="divide-y divide-[var(--border-divider)]">
                      {essayQuestions.map((q) => (
                        <EssayRow
                          key={q.id}
                          question={q}
                          draft={draft[String(q.id)] ?? ""}
                          onChange={(value) =>
                            setDraft((prev) => ({ ...prev, [String(q.id)]: value }))
                          }
                        />
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              <p className="text-xs text-[var(--text-muted)]">
                선택형 {effectiveChoiceCount}문항, 서술형 {effectiveEssayCount}문항 등록됨
              </p>
            </>
          )}
        </div>
      </ModalBody>
      <ModalFooter
        right={
          <>
            <Button intent="secondary" onClick={onClose}>
              {hasQuestions ? "취소" : "닫기"}
            </Button>
            {hasQuestions && (
              <Button
                intent="primary"
                onClick={handleSave}
                disabled={saveBusy}
                loading={saveBusy}
              >
                저장 (총 {Math.round(totalScore)}점)
              </Button>
            )}
          </>
        }
      />
    </AdminModal>
  );
}

function ChoiceRow({
  question,
  draft,
  onChange,
}: {
  question: ExamQuestion;
  draft: string;
  onChange: (value: string) => void;
}) {
  return (
    <li className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm">
      <div className="w-8 text-right font-semibold text-[var(--text-primary)]">
        {question.number}
      </div>
      <div className="flex items-center gap-2">
        {CHOICES.map((c) => (
          <label key={c} className="flex cursor-pointer items-center gap-1.5">
            <input
              type="radio"
              name={`q-${question.id}`}
              value={c}
              checked={draft === c}
              onChange={() => onChange(c)}
              className="h-4 w-4 accent-[var(--color-brand-primary)]"
            />
            <span className="text-[var(--text-primary)]">{c}</span>
          </label>
        ))}
      </div>
      <div className="ml-auto w-12 text-right text-xs text-[var(--text-muted)]">
        {question.score}점
      </div>
    </li>
  );
}

function EssayRow({
  question,
  draft,
  onChange,
}: {
  question: ExamQuestion;
  draft: string;
  onChange: (value: string) => void;
}) {
  return (
    <li className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm">
      <div className="w-8 text-right font-semibold text-[var(--text-primary)]">
        {question.number}
      </div>
      <div className="flex-1">
        <input
          type="text"
          value={draft}
          onChange={(e) => onChange(e.target.value)}
          placeholder="해설참조"
          className="w-full max-w-[200px] rounded border border-[var(--border-divider)] bg-[var(--bg-app)] px-3 py-2 text-sm placeholder:text-[var(--text-muted)]"
        />
      </div>
      <div className="w-12 text-right text-xs text-[var(--text-muted)]">
        {question.score}점
      </div>
    </li>
  );
}
