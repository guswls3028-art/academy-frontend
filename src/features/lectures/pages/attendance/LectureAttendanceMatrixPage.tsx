// src/features/lectures/pages/attendance/LectureAttendanceMatrixPage.tsx

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { PageSection } from "@/shared/ui/page";
import { useLectureParams } from "@/features/lectures/hooks/useLectureParams";

import {
  fetchAttendanceMatrix,
  updateAttendance,
  downloadAttendanceExcel,
} from "../../api/attendance";

import "./attendanceMatrix.css";

const STATUS_ORDER = [
  "PRESENT",
  "LATE",
  "ONLINE",
  "SUPPLEMENT",
  "EARLY_LEAVE",
  "ABSENT",
  "RUNAWAY",
  "MATERIAL",
  "INACTIVE",
  "SECESSION",
];

const STATUS_LABEL: Record<string, string> = {
  PRESENT: "출석",
  LATE: "지각",
  ONLINE: "온라인",
  SUPPLEMENT: "보강",
  EARLY_LEAVE: "조퇴",
  ABSENT: "결석",
  RUNAWAY: "출튀",
  MATERIAL: "자료",
  INACTIVE: "부재",
  SECESSION: "탈퇴",
};

function nextStatus(current: string) {
  const idx = STATUS_ORDER.indexOf(current);
  return idx === -1
    ? STATUS_ORDER[0]
    : STATUS_ORDER[(idx + 1) % STATUS_ORDER.length];
}

function statusClass(status: string) {
  return `status-${status.toLowerCase().replace("_", "-")}`;
}

export default function LectureAttendanceMatrixPage() {
  const { lectureId } = useLectureParams();
  const qc = useQueryClient();
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["attendance-matrix", lectureId],
    queryFn: () => fetchAttendanceMatrix(lectureId),
    enabled: Number.isFinite(lectureId),
  });

  const mutation = useMutation({
    mutationFn: ({
      attendanceId,
      status,
    }: {
      attendanceId: number;
      status: string;
    }) => {
      setUpdatingId(attendanceId);
      return updateAttendance(attendanceId, { status });
    },
    onSettled: () => {
      setUpdatingId(null);
      qc.invalidateQueries({ queryKey: ["attendance-matrix", lectureId] });
    },
  });

  return (
    <PageSection
      title="출결 매트릭스"
      actions={
        <button
          className="rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm text-white"
          onClick={() => downloadAttendanceExcel(lectureId)}
        >
          엑셀 다운로드
        </button>
      }
    >
      {isLoading || !data ? (
        <div className="py-12 text-center text-sm text-[var(--text-muted)]">
          출결 데이터를 불러오는 중입니다.
        </div>
      ) : (
        <div className="overflow-auto rounded border border-[var(--border-divider)]">
          <table className="attendance-table">
            <thead className="attendance-sticky-header">
              <tr>
                <th className="attendance-sticky-student">학생</th>
                {data.sessions.map((s: any) => (
                  <th key={s.id}>{s.order}차시</th>
                ))}
              </tr>
            </thead>

            <tbody>
              {data.students.map((st: any) => (
                <tr key={st.student_id} className="attendance-row">
                  <td className="attendance-sticky-student">
                    {st.name}
                  </td>

                  {data.sessions.map((s: any) => {
                    const cell = st.attendance[String(s.id)];
                    if (!cell) return <td key={s.id}>-</td>;

                    const isUpdating =
                      updatingId === cell.attendance_id;
                    const disabled = cell.status === "SECESSION";

                    return (
                      <td
                        key={s.id}
                        className={[
                          "attendance-cell",
                          statusClass(cell.status),
                          disabled ? "disabled" : "",
                          isUpdating ? "updating" : "",
                        ].join(" ")}
                        title={STATUS_LABEL[cell.status]}
                        onClick={() => {
                          if (disabled || isUpdating) return;
                          mutation.mutate({
                            attendanceId: cell.attendance_id,
                            status: nextStatus(cell.status),
                          });
                        }}
                      >
                        {STATUS_LABEL[cell.status]}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PageSection>
  );
}
