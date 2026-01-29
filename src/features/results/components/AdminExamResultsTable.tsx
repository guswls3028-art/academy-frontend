/**
 * PATH: src/features/results/components/AdminExamResultsTable.tsx
 *
 * ✅ AdminExamResultsTable (Backend Contract Aligned)
 *
 * 변경 요약:
 * - exam_score / exam_max_score 의존 제거 (백엔드 리스트 계약에 없음)
 * - final_score / passed 기반 표시
 * - 대표 attempt/최종 점수 없는 케이스를 "—" 로 명확화
 *
 * ❗ 기존 props / 구조 유지
 */

import { AdminExamResultRow } from "../types/results.types";
import { deriveFrontResultStatus } from "../utils/deriveFrontResultStatus";
import FrontResultStatusBadge from "./FrontResultStatusBadge";

function scoreCell(r: AdminExamResultRow) {
  // 대표 attempt 기준 final_score가 단일 진실
  const fs = r.final_score;
  if (fs === null || fs === undefined) return "—";
  if (typeof fs === "number") return String(fs);
  return "—";
}

export default function AdminExamResultsTable({
  rows,
  onSelectEnrollment,
}: {
  rows: AdminExamResultRow[];
  onSelectEnrollment: (id: number) => void;
}) {
  return (
    <table className="w-full text-sm border">
      <thead className="bg-gray-100">
        <tr>
          <th className="p-2 text-left">학생</th>
          <th className="p-2 text-center">최종점수</th>
          <th className="p-2 text-center">상태</th>
          <th className="p-2 text-center">합격</th>
        </tr>
      </thead>

      <tbody>
        {rows.map((r) => {
          const frontStatus = deriveFrontResultStatus(r);
          const passed = r.passed;

          return (
            <tr
              key={r.enrollment_id}
              className="cursor-pointer hover:bg-gray-50"
              onClick={() => onSelectEnrollment(r.enrollment_id)}
              title={`enrollment_id: ${r.enrollment_id}`}
            >
              <td className="p-2">{r.student_name}</td>

              <td className="p-2 text-center font-semibold">
                {scoreCell(r)}
              </td>

              <td className="p-2 text-center">
                <FrontResultStatusBadge status={frontStatus} />
              </td>

              <td className="p-2 text-center">
                {passed === true ? (
                  <span className="text-emerald-700 font-semibold">합격</span>
                ) : passed === false ? (
                  <span className="text-red-700 font-semibold">불합격</span>
                ) : (
                  <span className="text-gray-400">—</span>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
