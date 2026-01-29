/**
 * ✅ AttemptMetaPanel
 *
 * 책임:
 * - confidence
 * - invalid_reason
 * - detected answer 등 "이유 설명"
 */

type Props = {
  fact: {
    meta?: any;
    answer?: string;
  } | null;
};

export default function AttemptMetaPanel({ fact }: Props) {
  if (!fact) return null;

  const omr = fact.meta?.omr;
  const grading = fact.meta?.grading;

  return (
    <div className="rounded border bg-gray-50 p-3 text-sm">
      <div className="mb-1 font-semibold">채점 정보</div>

      <ul className="space-y-1 text-xs">
        <li>감지 답안: {fact.answer || "-"}</li>

        {typeof omr?.confidence === "number" && (
          <li>
            신뢰도:{" "}
            <span
              className={
                omr.confidence < 0.7
                  ? "font-semibold text-red-600"
                  : ""
              }
            >
              {omr.confidence}
            </span>
          </li>
        )}

        {grading?.invalid_reason && (
          <li className="font-semibold text-red-600">
            처리 사유: {grading.invalid_reason}
          </li>
        )}
      </ul>
    </div>
  );
}
