// PATH: src/app_admin/domains/exams/components/AnswerKeyEditor.tsx
import { useEffect, useMemo, useState } from "react";
import {
  createAnswerKey,
  fetchAnswerKeyByExam,
  updateAnswerKey,
  AnswerKey,
} from "../api/answerKey.api";
import { fetchQuestionsByExam, ExamQuestion } from "../api/question.api";
import { Button } from "@/shared/ui/ds";

interface Props {
  examId: number; // template or regular id (backend resolves)
  createExamId?: number | null; // create 시 사용할 template exam id
  disabled: boolean;
}

function normalizeAnswers(input: Record<string, string>) {
  const out: Record<string, string> = {};
  Object.entries(input || {}).forEach(([k, v]) => {
    out[String(k)] = String(v ?? "").trim();
  });
  return out;
}

export function AnswerKeyEditor({ examId, createExamId, disabled }: Props) {
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [answerKey, setAnswerKey] = useState<AnswerKey | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string>("");

  useEffect(() => {
    async function load() {
      try {
        const q = await fetchQuestionsByExam(examId);
        setQuestions(q.data ?? []);

        let first: AnswerKey | null = null;
        try {
          const ak = await fetchAnswerKeyByExam(examId);
          first = (ak.data ?? [])[0] ?? null;
        } catch {
          // 404 등: 정답키 미생성 시 빈 상태로 표시 (Uncaught AxiosError 방지)
        }
        setAnswerKey(first);
        setDraft(first ? normalizeAnswers(first.answers) : {});
      } catch (e) {
        setQuestions([]);
        setAnswerKey(null);
        setDraft({});
      }
    }
    load();
  }, [examId]);

  const sorted = useMemo(() => {
    return [...questions].sort((a, b) => a.number - b.number);
  }, [questions]);

  async function save() {
    if (disabled) return;

    setBusy(true);
    setMsg("");

    try {
      const normalized = normalizeAnswers(draft);

      if (!answerKey) {
        const targetExamId = createExamId ?? examId;
        const created = await createAnswerKey({ exam: targetExamId, answers: normalized });
        setAnswerKey(created.data);
        setMsg("저장 완료");
      } else {
        const updated = await updateAnswerKey(answerKey.id, { exam: answerKey.exam, answers: normalized });
        setAnswerKey(updated.data);
        setMsg("저장 완료");
      }
    } catch (e: any) {
      setMsg(e?.response?.data?.detail || "저장 실패");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-medium text-[var(--text-primary)]">정답표</h3>

        <Button
          type="button"
          intent="primary"
          size="sm"
          onClick={save}
          disabled={disabled || busy}
          loading={busy}
        >
          저장
        </Button>
      </div>

      {msg && (
        <div className="text-xs text-[var(--text-muted)]">
          {msg}
        </div>
      )}

      <div className="rounded border border-[var(--border-divider)] bg-[var(--bg-surface)]">
        {sorted.length === 0 && (
          <div className="px-4 py-3 text-sm text-[var(--text-muted)]">
            문항이 없습니다.
          </div>
        )}

        {sorted.map((q, idx) => {
          const key = String(q.id);
          const isLast = idx === sorted.length - 1;
          return (
            <div
              key={q.id}
              className={`flex items-center gap-3 px-4 py-2 text-sm ${isLast ? "" : "border-b border-[var(--border-divider)]"}`}
            >
              <div className="w-10 text-right font-semibold text-[var(--text-primary)]">
                {q.number}
              </div>

              <input
                disabled={disabled}
                value={draft[key] ?? ""}
                onChange={(ev) =>
                  setDraft((prev) => ({ ...prev, [key]: ev.target.value }))
                }
                className="flex-1 rounded border border-[var(--border-divider)] bg-[var(--bg-app)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] disabled:opacity-60"
                placeholder="정답 입력"
              />

              <div className="w-12 text-right text-xs text-[var(--text-muted)]">
                {q.score}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
