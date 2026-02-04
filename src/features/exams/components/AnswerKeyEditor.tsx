// PATH: src/features/exams/components/AnswerKeyEditor.tsx
import { useEffect, useMemo, useState } from "react";
import {
  createAnswerKey,
  fetchAnswerKeyByExam,
  updateAnswerKey,
  AnswerKey,
} from "../api/answerKeyApi";
import { fetchQuestionsByExam, ExamQuestion } from "../api/questionApi";

interface Props {
  examId: number; // template or regular id (backend resolves)
  disabled: boolean; // template locked이면 true (정답 변경 금지 정책 반영)
}

function normalizeAnswers(input: Record<string, string>) {
  const out: Record<string, string> = {};
  Object.entries(input || {}).forEach(([k, v]) => {
    out[String(k)] = String(v ?? "").trim();
  });
  return out;
}

export function AnswerKeyEditor({ examId, disabled }: Props) {
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [answerKey, setAnswerKey] = useState<AnswerKey | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string>("");

  useEffect(() => {
    async function load() {
      const q = await fetchQuestionsByExam(examId);
      setQuestions(q.data);

      const ak = await fetchAnswerKeyByExam(examId);
      const first = (ak.data || [])[0] ?? null;
      setAnswerKey(first);
      setDraft(first ? normalizeAnswers(first.answers) : {});
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
        // ⚠️ backend contract: create needs template exam id
        // 여기서는 backend가 regular->template resolve를 create에 적용하지 않으므로
        // 이 Editor는 "템플릿 화면에서" 쓰는 것이 안전 (SSOT 준수).
        // (정규시험 화면에서는 조회만 허용하는 형태로 사용할 예정)
        const created = await createAnswerKey({ exam: examId, answers: normalized });
        setAnswerKey(created.data);
        setMsg("저장 완료");
      } else {
        const updated = await updateAnswerKey(answerKey.id, { answers: normalized });
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
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">정답표</h3>

        <div className="flex items-center gap-2">
          {disabled && (
            <span className="text-xs text-red-500">
              템플릿이 이미 사용 중이라 정답 수정이 봉인됩니다
            </span>
          )}
          <button
            onClick={save}
            disabled={disabled || busy}
            className={`px-3 py-2 rounded text-sm ${
              disabled || busy
                ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                : "bg-black text-white"
            }`}
          >
            저장
          </button>
        </div>
      </div>

      {msg && <div className="text-xs text-gray-600">{msg}</div>}

      <div className="border rounded">
        {sorted.length === 0 && (
          <div className="p-3 text-sm text-gray-400">문항이 없습니다.</div>
        )}

        {sorted.map((q) => {
          const key = String(q.id);
          return (
            <div key={q.id} className="flex items-center gap-3 border-b p-2 text-sm">
              <div className="w-12 text-right font-medium">{q.number}</div>

              <input
                disabled={disabled}
                value={draft[key] ?? ""}
                onChange={(ev) => setDraft((prev) => ({ ...prev, [key]: ev.target.value }))}
                className={`flex-1 border rounded px-2 py-1 ${
                  disabled ? "bg-gray-100 text-gray-500" : ""
                }`}
                placeholder="정답 입력"
              />

              <div className="w-16 text-right text-gray-500">
                {q.score}
              </div>
            </div>
          );
        })}
      </div>

      <div className="text-xs text-gray-400">
        * 저장 단위: key = ExamQuestion.id (string), value = 정답
      </div>
    </section>
  );
}
