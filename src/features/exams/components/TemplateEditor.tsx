// PATH: src/features/exams/components/TemplateEditor.tsx
import { useEffect, useState } from "react";
import {
  fetchTemplateEditor,
  fetchTemplateValidation,
  TemplateEditorSummary,
} from "../api/templateEditorApi";
import { fetchQuestionsByExam, ExamQuestion } from "../api/questionApi";
import { QuestionEditorRow } from "./QuestionEditorRow";

interface Props {
  examId: number;
}

export function TemplateEditor({ examId }: Props) {
  const [summary, setSummary] = useState<TemplateEditorSummary | null>(null);
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [validation, setValidation] = useState<{
    ok: boolean;
    reason?: string;
  } | null>(null);

  useEffect(() => {
    async function load() {
      const s = await fetchTemplateEditor(examId);
      setSummary(s.data);

      const q = await fetchQuestionsByExam(examId);
      setQuestions(q.data);

      const v = await fetchTemplateValidation(examId);
      setValidation(v.data);
    }

    load();
  }, [examId]);

  if (!summary) {
    return <div className="p-4">로딩 중...</div>;
  }

  return (
    <div className="p-4 space-y-4">
      <header>
        <h2 className="text-xl font-semibold">
          {summary.title}
        </h2>
        <div className="text-sm text-gray-500">
          과목: {summary.subject}
        </div>
      </header>

      <section>
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-medium">
            문항 ({questions.length})
          </h3>

          {summary.is_locked && (
            <span className="text-xs text-red-500">
              이 템플릿은 이미 시험에 사용 중입니다
            </span>
          )}
        </div>

        <div className="border rounded">
          {questions.length === 0 && (
            <div className="p-4 text-sm text-gray-400">
              아직 문항이 없습니다.
            </div>
          )}

          {questions.map((q) => (
            <QuestionEditorRow
              key={q.id}
              question={q}
              disabled={summary.is_locked}
            />
          ))}
        </div>
      </section>

      <section className="flex justify-end gap-2">
        <button
          disabled={!validation?.ok}
          className={`px-4 py-2 rounded text-sm ${
            validation?.ok
              ? "bg-blue-600 text-white"
              : "bg-gray-300 text-gray-500 cursor-not-allowed"
          }`}
        >
          실제 시험 생성
        </button>
      </section>

      {!validation?.ok && validation?.reason && (
        <div className="text-xs text-red-500">
          시험 생성 불가 사유: {validation.reason}
        </div>
      )}
    </div>
  );
}
