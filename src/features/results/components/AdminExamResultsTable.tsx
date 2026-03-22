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
import StudentNameWithLectureChip from "@/shared/ui/chips/StudentNameWithLectureChip";

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
    <div className="ds-table-wrap">
      <table className="ds-table w-full text-sm">
        <thead>
          <tr>
            <th style={{ textAlign: "left" }}>학생</th>
            <th>최종점수</th>
            <th>상태</th>
            <th>합격</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const frontStatus = deriveFrontResultStatus(r);
            const passed = r.passed;

            return (
              <tr
                key={r.enrollment_id}
                className="cursor-pointer"
                onClick={() => onSelectEnrollment(r.enrollment_id)}
              >
                <td style={{ textAlign: "left" }}>
                  <StudentNameWithLectureChip
                    name={r.student_name}
                    lectures={r.lecture_title ? [{ lectureName: r.lecture_title, color: r.lecture_color, chipLabel: r.lecture_chip_label }] : undefined}
                    profilePhotoUrl={r.profile_photo_url}
                    avatarSize={24}
                  />
                </td>

                <td style={{ fontWeight: 600 }}>
                  {scoreCell(r)}
                </td>

                <td>
                  <FrontResultStatusBadge status={frontStatus} />
                </td>

                <td>
                  {passed === true ? (
                    <span className="ds-status-badge" data-tone="success">합격</span>
                  ) : passed === false ? (
                    <span className="ds-status-badge" data-tone="danger">불합격</span>
                  ) : (
                    <span style={{ color: "var(--color-text-muted)" }}>—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
