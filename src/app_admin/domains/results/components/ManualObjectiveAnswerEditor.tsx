import { useEffect, useMemo, useState } from "react";

import { Button } from "@/shared/ui/ds";
import type { ManualGradeQuestion, ManualGradeRow } from "../api/manualExamGrading";
import {
  submitManualExamAnswers,
  fetchManualExamAnswers,
  type ManualAnswerPreview,
} from "../api/manualExamAnswers";
import { formatChoiceAnswer, requiredChoiceTokens } from "../utils/choiceAnswerMatching";

type Props = {
  examId: number;
  row: ManualGradeRow;
  questions: ManualGradeQuestion[];
  onClose: () => void;
  onSaved: () => Promise<void>;
};

function messageFromError(error: unknown): string {
  const response = (error as { response?: { data?: Record<string, unknown> } })?.response?.data;
  for (const key of ["detail", "expected_version", "preview_token", "answers", "note", "enrollment_id"]) {
    const value = response?.[key];
    if (typeof value === "string") return value;
    if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  }
  return "답안을 처리하지 못했습니다. 입력을 확인하고 다시 시도해 주세요.";
}

export default function ManualObjectiveAnswerEditor({ examId, row, questions, onClose, onSaved }: Props) {
  const objectiveQuestions = useMemo(
    () => questions.filter((question) => question.kind === "choice" || question.answer_type === "numeric_short_answer"),
    [questions],
  );
  const [answers, setAnswers] = useState<Record<string, string>>(() =>
    Object.fromEntries(objectiveQuestions.map((question) => [String(question.question_id), ""])),
  );
  const [note, setNote] = useState("오프라인 제출 답안 입력");
  const [preview, setPreview] = useState<ManualAnswerPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [version, setVersion] = useState<string | null>(row.expected_version);

  useEffect(() => {
    let active = true;
    void fetchManualExamAnswers(examId, row.enrollment_id).then((draft) => {
      if (!active) return;
      setAnswers(Object.fromEntries(objectiveQuestions.map((question) => [
        String(question.question_id), draft.answers[String(question.question_id)] ?? "",
      ])));
      setVersion(draft.expected_version);
      setLoaded(true);
    }).catch((caught) => {
      if (active) setError(messageFromError(caught));
    });
    return () => { active = false; };
  }, [examId, row.enrollment_id, objectiveQuestions, loadAttempt]);

  const updateAnswer = (questionId: number, value: string) => {
    setAnswers((current) => ({ ...current, [String(questionId)]: value }));
    setPreview(null);
    setError(null);
  };

  const toggleChoice = (questionId: number, choice: string) => {
    const selected = new Set(requiredChoiceTokens(answers[String(questionId)] ?? ""));
    if (selected.has(choice)) selected.delete(choice);
    else selected.add(choice);
    updateAnswer(questionId, formatChoiceAnswer([...selected]));
  };

  const submit = async (apply: boolean) => {
    setBusy(true);
    setError(null);
    try {
      const result = await submitManualExamAnswers(examId, row.enrollment_id, {
        answers,
        expected_version: version,
        note: note.trim(),
        apply,
        preview_token: apply ? preview?.preview_token : undefined,
      });
      if (apply) {
        setPreview(null);
        await onSaved();
      }
      else setPreview(result);
    } catch (caught) {
      setPreview(null);
      setError(messageFromError(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="min-w-0 flex-1 space-y-4 rounded-xl border border-[var(--color-border-divider)] bg-[var(--color-bg-surface)] p-4 max-md:fixed max-md:inset-x-0 max-md:top-14 max-md:bottom-16 max-md:z-50 max-md:overflow-y-auto max-md:overscroll-contain max-md:rounded-none max-md:pb-20" aria-label={`${row.student_name} 오프라인 답안 입력`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold">{row.student_name} · 오프라인 답안 입력</h2>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">OMR 제출 없이 답안을 입력합니다. 미리보기 후 확정해야 성적에 반영됩니다.</p>
        </div>
        <Button type="button" intent="ghost" size="sm" onClick={onClose} disabled={busy}>닫기</Button>
      </div>

      {!loaded && !error && <p role="status" className="text-sm">기존 답안을 불러오는 중…</p>}
      {!loaded && error && (
        <Button type="button" intent="secondary" size="sm" onClick={() => { setError(null); setLoadAttempt((value) => value + 1); }}>
          답안 다시 불러오기
        </Button>
      )}

      {objectiveQuestions.length === 0 ? (
        <p role="alert" className="text-sm text-[var(--color-error)]">채점 문항을 불러오지 못했습니다. 시험 문항 등록을 확인해 주세요.</p>
      ) : (
        <div className="max-h-[55vh] space-y-3 overflow-y-auto pr-1">
          {objectiveQuestions.map((question) => {
            const answer = answers[String(question.question_id)] ?? "";
            const numeric = question.answer_type === "numeric_short_answer";
            return (
              <div key={question.question_id} className="flex flex-wrap items-center gap-3 border-b border-[var(--color-border-divider)] pb-3">
                <span className="w-14 shrink-0 text-sm font-semibold">{question.number}번</span>
                {numeric ? (
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]{0,3}"
                    maxLength={3}
                    className="ds-input w-28"
                    aria-label={`${question.number}번 숫자 답안`}
                    value={answer}
                    onChange={(event) => updateAnswer(question.question_id, event.target.value)}
                    disabled={busy || !loaded}
                  />
                ) : (
                  <div className="flex flex-wrap gap-2" role="group" aria-label={`${question.number}번 답안`}>
                    {["1", "2", "3", "4", "5"].map((choice) => (
                      <button
                        key={choice}
                        type="button"
                        aria-pressed={requiredChoiceTokens(answer).includes(choice)}
                        onClick={() => toggleChoice(question.question_id, choice)}
                        disabled={busy || !loaded}
                        className="h-11 w-11 rounded-full border border-[var(--color-border-divider)] text-sm font-semibold transition-transform hover:-translate-y-0.5 aria-pressed:border-[var(--color-primary)] aria-pressed:bg-[var(--color-primary)] aria-pressed:text-white motion-reduce:transition-none"
                      >{choice}</button>
                    ))}
                  </div>
                )}
                <span className="text-xs text-[var(--color-text-muted)]">{question.max_score}점</span>
              </div>
            );
          })}
        </div>
      )}

      <label className="block text-sm font-medium">
        입력 사유
        <input
          className="ds-input mt-1 w-full"
          value={note}
          maxLength={500}
          onChange={(event) => { setNote(event.target.value); setPreview(null); }}
          disabled={busy || !loaded}
        />
      </label>

      {error && <p role="alert" className="text-sm text-[var(--color-error)]">{error}</p>}
      {preview && (
        <div role="status" className="rounded-lg bg-[var(--color-bg-surface-soft)] p-3 text-sm">
          <strong>미리보기 · {preview.total_score}/{preview.max_score}점</strong>
          <p className="mt-1 text-[var(--color-text-muted)]">
            정답 {preview.questions.filter((question) => question.is_correct).length}문항 · 빈 답안 {preview.questions.filter((question) => !question.answer).length}문항
          </p>
          <p className="mt-1 text-[var(--color-text-muted)]">확정하면 이 학생의 시험 결과와 후속 판정에 반영됩니다.</p>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="button" intent="secondary" onClick={() => void submit(false)} disabled={busy || !loaded || objectiveQuestions.length === 0} loading={busy && !preview}>채점 미리보기</Button>
        <Button type="button" intent="primary" onClick={() => void submit(true)} disabled={busy || !preview}>답안 확정</Button>
      </div>
    </section>
  );
}
