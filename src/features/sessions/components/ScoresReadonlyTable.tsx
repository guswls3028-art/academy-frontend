/**
 * PATH: src/features/sessions/components/ScoresReadonlyTable.tsx
 *
 * ✅ Sessions Readonly Scores Table
 *
 * 책임:
 * - 세션 단위 학생 목록 + 점수 "정보 표시"
 *
 * ❌ 금지:
 * - 합격/불합격 판단 강조
 * - 클리닉 대상 여부 강조
 * - 결과 해석 UX
 *
 * 👉 상세 판단은 results 도메인으로 위임
 */

import type { SessionScoreRow } from "../api/sessionScores";

type Props = {
  rows: SessionScoreRow[];
  selectedEnrollmentId: number | null;
  onSelectRow: (row: SessionScoreRow) => void;
};

export default function ScoresReadonlyTable({
  rows,
  selectedEnrollmentId,
  onSelectRow,
}: Props) {
  return (
    <div className="overflow-hidden rounded border bg-white">
      <table className="w-full text-sm">
        <thead className="border-b bg-gray-50 text-gray-600">
          <tr>
            <th className="px-3 py-2 text-left">학생</th>
            <th className="px-3 py-2 text-left">점수</th>
            <th className="px-3 py-2 text-left">비고</th>
          </tr>
        </thead>

        <tbody>
          {rows.map((row) => {
            const selected =
              selectedEnrollmentId === row.enrollment_id;

            return (
              <tr
                key={row.enrollment_id}
                className={[
                  "border-t cursor-pointer",
                  selected ? "bg-purple-50" : "hover:bg-gray-50",
                ].join(" ")}
                onClick={() => onSelectRow(row)}
              >
                <td className="px-3 py-2 font-medium">
                  {row.student_name}
                </td>

                {/* 🔒 점수는 정보용 표시만 */}
                <td className="px-3 py-2">
                  {row.final_score == null
                    ? "-"
                    : row.final_score}
                </td>

                <td className="px-3 py-2 text-xs text-gray-400">
                  결과 상세에서 확인
                </td>
              </tr>
            );
          })}

          {rows.length === 0 && (
            <tr>
              <td
                colSpan={3}
                className="px-3 py-8 text-center text-gray-400"
              >
                성적 데이터가 없습니다.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
