// PATH: src/features/scores/components/HomeworkStatusBadge.tsx
/**
 * HomeworkStatusBadge
 *
 * ⚠️ 중요 계약:
 * - score 기준 판정 ❌
 * - backend HomeworkScore.passed 사실만 표시
 */

export function HomeworkStatusBadge({
  passed,
}: {
  passed: boolean | null;
}) {
  if (passed == null) {
    return (
      <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
        미산출
      </span>
    );
  }

  return passed ? (
    <span className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-700">
      완료
    </span>
  ) : (
    <span className="rounded bg-red-100 px-2 py-0.5 text-xs text-red-700">
      미통과
    </span>
  );
}
