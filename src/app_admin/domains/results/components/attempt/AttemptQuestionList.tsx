/**
 * ✅ AttemptQuestionList
 *
 * 책임:
 * - 문항 목록 표시
 * - 정답/오답 상태 시각화
 * - 선택 상태 관리 (상위에서 제어)
 */

type Fact = {
  question_id: number;
  is_correct: boolean;
  meta?: any;
};

type Props = {
  facts: Fact[];
  selectedQuestionId: number | null;
  onSelect: (qid: number) => void;
};

export default function AttemptQuestionList({
  facts,
  selectedQuestionId,
  onSelect,
}: Props) {
  return (
    <ul className="space-y-1 text-sm">
      {facts.map((f) => {
        const invalidReason =
          f.meta?.grading?.invalid_reason ?? null;

        return (
          <li
            key={f.question_id}
            className={`cursor-pointer rounded px-2 py-1
              ${
                selectedQuestionId === f.question_id
                  ? "bg-blue-100 font-semibold"
                  : "hover:bg-gray-100"
              }
            `}
            onClick={() => onSelect(f.question_id)}
          >
            Q{f.question_id}{" "}
            {f.is_correct ? "✅" : "❌"}
            {invalidReason && (
              <span className="ml-1 text-xs text-red-600">
                ({invalidReason})
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
