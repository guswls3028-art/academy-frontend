/**
 * PATH: src/features/results/components/AdminExamResultsTable.tsx
 *
 * ✅ AdminExamResultsTable (Backend Contract Aligned)
 *
 * 변경 요약:
 * - 석차(등수) 컬럼 추가
 * - 점수 내림차순 기본 정렬
 * - 백분위 표시
 */

import { useMemo } from "react";
import { AdminExamResultRow } from "../types/results.types";
import { deriveFrontResultStatus } from "../utils/deriveFrontResultStatus";
import FrontResultStatusBadge from "./FrontResultStatusBadge";
import StudentNameWithLectureChip from "@/shared/ui/chips/StudentNameWithLectureChip";

function scoreCell(r: AdminExamResultRow) {
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
  // 점수 내림차순 정렬 (등수순)
  const sorted = useMemo(
    () =>
      [...rows].sort((a, b) => {
        const ra = a.rank ?? Infinity;
        const rb = b.rank ?? Infinity;
        return ra - rb;
      }),
    [rows],
  );

  return (
    <div className="ds-table-wrap">
      <table className="ds-table w-full text-sm">
        <thead>
          <tr>
            <th style={{ textAlign: "center", width: 56 }}>등수</th>
            <th style={{ textAlign: "left" }}>학생</th>
            <th>최종점수</th>
            <th>상태</th>
            <th>합격</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => {
            const frontStatus = deriveFrontResultStatus(r);
            const passed = r.passed;

            return (
              <tr
                key={r.enrollment_id}
                className="cursor-pointer"
                onClick={() => onSelectEnrollment(r.enrollment_id)}
              >
                <td style={{ textAlign: "center", fontWeight: 700, fontSize: 13 }}>
                  {r.rank != null ? (
                    <span
                      title={
                        r.cohort_size != null
                          ? `${r.cohort_size}명 중 ${r.rank}등`
                          : undefined
                      }
                    >
                      {r.rank}
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 400,
                          color: "var(--color-text-muted)",
                          marginLeft: 2,
                        }}
                      >
                        /{r.cohort_size}
                      </span>
                    </span>
                  ) : (
                    <span style={{ color: "var(--color-text-muted)" }}>—</span>
                  )}
                </td>

                <td style={{ textAlign: "left" }}>
                  <StudentNameWithLectureChip
                    name={r.student_name}
                    lectures={r.lecture_title ? [{ lectureName: r.lecture_title, color: r.lecture_color, chipLabel: r.lecture_chip_label }] : undefined}
                    profilePhotoUrl={r.profile_photo_url}
                    avatarSize={24}
                    clinicHighlight={r.name_highlight_clinic_target}
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
