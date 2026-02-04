// PATH: src/features/exams/components/QuestionEditorRow.tsx
import { ExamQuestion } from "../api/questionApi";

interface Props {
  question: ExamQuestion;
  disabled: boolean;
}

export function QuestionEditorRow({ question, disabled }: Props) {
  return (
    <div
      className="flex items-center gap-3 border-b py-2 text-sm"
      tabIndex={0}
    >
      <div className="w-10 text-right font-medium">
        {question.number}
      </div>

      <div className="flex-1 text-gray-700">
        점수: {question.score}
        {question.region_meta && (
          <span className="ml-2 text-xs text-gray-400">
            bbox 있음
          </span>
        )}
      </div>

      {disabled && (
        <div className="text-xs text-red-500">
          LOCKED
        </div>
      )}
    </div>
  );
}
