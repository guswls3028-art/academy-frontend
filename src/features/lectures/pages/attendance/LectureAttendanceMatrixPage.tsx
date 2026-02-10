// PATH: src/features/lectures/pages/attendance/LectureAttendanceMatrixPage.tsx
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchAttendanceMatrix, type AttendanceMatrixRow } from "@/features/lectures/api/attendance";
import { EmptyState } from "@/shared/ui/ds";

const TH_STYLE = {
  background:
    "color-mix(in srgb, var(--color-brand-primary) 6%, var(--color-bg-surface-hover))",
  color:
    "color-mix(in srgb, var(--color-brand-primary) 55%, var(--color-text-secondary))",
};

export default function LectureAttendanceMatrixPage() {
  const { lectureId } = useParams<{ lectureId: string }>();
  const lectureIdNum = Number(lectureId);

  const { data, isLoading } = useQuery<AttendanceMatrixRow[]>({
    queryKey: ["attendance-matrix", lectureIdNum],
    queryFn: () => fetchAttendanceMatrix(lectureIdNum),
    enabled: Number.isFinite(lectureIdNum),
  });

  if (isLoading) return <EmptyState scope="panel" tone="loading" title="불러오는 중…" />;
  if (!data || data.length === 0)
    return (
      <EmptyState
        scope="panel"
        title="출결 데이터가 없습니다."
        description="차시 또는 출결 데이터가 아직 없습니다."
      />
    );

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

              {data[0].sessions.map((s) => (
                <th
                  key={s.session_id}
                  className="px-3 py-3 text-sm font-semibold border-b border-[var(--color-border-divider)]"
                  style={{ textAlign: "center", whiteSpace: "nowrap", ...TH_STYLE }}
                >
                  {s.title}
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-[var(--color-border-divider)]">
            {data.map((row) => (
              <tr key={row.student_id} className="hover:bg-[var(--color-bg-surface-soft)]">
                <td className="px-4 py-3 text-left text-[15px] font-bold text-[var(--color-text-primary)] truncate">
                  {row.student_name}
                </td>

                {row.sessions.map((s) => (
                  <td
                    key={s.session_id}
                    className="px-3 py-3 text-center text-[13px] font-semibold text-[var(--color-text-secondary)]"
                  >
                    {s.status_label ?? "-"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
