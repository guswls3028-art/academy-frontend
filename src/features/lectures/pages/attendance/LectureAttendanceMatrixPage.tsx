// PATH: src/features/lectures/pages/attendance/LectureAttendanceMatrixPage.tsx
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  fetchAttendanceMatrix,
  type AttendanceMatrixResponse,
} from "@/features/lectures/api/attendance";
import AttendanceStatusBadge from "@/shared/ui/badges/AttendanceStatusBadge";
import { EmptyState } from "@/shared/ui/ds";

const TH_STYLE = {
  background: "color-mix(in srgb, var(--color-primary) 12%, var(--bg-surface))",
  color: "var(--color-text-muted)",
};

export default function LectureAttendanceMatrixPage() {
  const { lectureId } = useParams<{ lectureId: string }>();
  const lectureIdNum = Number(lectureId);

  const { data, isLoading } = useQuery<AttendanceMatrixResponse>({
    queryKey: ["attendance-matrix", lectureIdNum],
    queryFn: () => fetchAttendanceMatrix(lectureIdNum),
    enabled: Number.isFinite(lectureIdNum),
  });

  if (isLoading) return <EmptyState scope="panel" tone="loading" title="불러오는 중…" />;
  if (!data?.students?.length)
    return (
      <EmptyState
        scope="panel"
        title="출결 데이터가 없습니다."
        description="차시에 수강생을 등록한 뒤 출결을 기록하면 표시됩니다."
      />
    );

  const { sessions, students } = data;

  return (
    <div style={{ overflowX: "auto" }}>
      <div style={{ overflow: "hidden", borderRadius: 14, border: "1px solid var(--color-border-divider)" }}>
        <table className="w-full" style={{ tableLayout: "fixed" }}>
          <thead>
            <tr>
              <th
                className="px-4 py-3 text-sm font-semibold border-b border-[var(--color-border-divider)]"
                style={{ textAlign: "left", whiteSpace: "nowrap", ...TH_STYLE }}
              >
                학생
              </th>
              {sessions.map((s) => (
                <th
                  key={s.id}
                  className="px-3 py-3 text-sm font-semibold border-b border-[var(--color-border-divider)]"
                  style={{ textAlign: "center", whiteSpace: "nowrap", ...TH_STYLE }}
                >
                  {s.order ?? "-"}차시{s.date ? ` (${s.date})` : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border-divider)]">
            {students.map((row) => (
              <tr key={row.student_id} className="hover:bg-[var(--color-bg-surface-soft)]">
                <td className="px-4 py-3 text-left text-[15px] font-bold text-[var(--color-text-primary)] truncate">
                  {row.name}
                </td>
                {sessions.map((s) => {
                  const cell = row.attendance[String(s.id)];
                  return (
                    <td
                      key={s.id}
                      className="px-3 py-3 text-center align-middle"
                    >
                      {cell?.status ? (
                        <AttendanceStatusBadge status={cell.status as any} variant="short" />
                      ) : (
                        <span className="text-[var(--color-text-muted)]">－</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
