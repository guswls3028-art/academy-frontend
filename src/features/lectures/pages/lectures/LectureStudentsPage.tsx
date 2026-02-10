// PATH: src/features/lectures/pages/lectures/LectureStudentsPage.tsx
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { EmptyState } from "@/shared/ui/ds";
import { fetchLectureStudents, type LectureStudent } from "@/features/lectures/api/students";

const TH_STYLE = {
  background:
    "color-mix(in srgb, var(--color-brand-primary) 6%, var(--color-bg-surface-hover))",
  color:
    "color-mix(in srgb, var(--color-brand-primary) 55%, var(--color-text-secondary))",
};

export default function LectureStudentsPage() {
  const { lectureId } = useParams<{ lectureId: string }>();
  const lectureIdNum = Number(lectureId);

  const { data: students = [], isLoading } = useQuery<LectureStudent[]>({
    queryKey: ["lecture-students", lectureIdNum],
    queryFn: () => fetchLectureStudents(lectureIdNum),
    enabled: Number.isFinite(lectureIdNum),
  });

  if (!Number.isFinite(lectureIdNum)) {
    return <div className="p-2 text-sm" style={{ color: "var(--color-error)" }}>잘못된 lectureId</div>;
  }

  if (isLoading) return <EmptyState scope="panel" tone="loading" title="불러오는 중…" />;
  if (!students.length)
    return (
      <EmptyState
        scope="panel"
        tone="empty"
        title="수강 중인 학생이 없습니다."
        description="학생이 등록되면 여기에 표시됩니다."
      />
    );

  return (
    <div style={{ overflow: "hidden", borderRadius: 14, border: "1px solid var(--color-border-divider)" }}>
      <table className="w-full" style={{ tableLayout: "fixed" }}>
        <thead>
          <tr>
            <th
              className="px-4 py-3 text-sm font-semibold border-b border-[var(--color-border-divider)]"
              style={{ textAlign: "left", whiteSpace: "nowrap", ...TH_STYLE }}
            >
              이름
            </th>
            <th
              className="px-4 py-3 text-sm font-semibold border-b border-[var(--color-border-divider)]"
              style={{ textAlign: "center", width: 120, whiteSpace: "nowrap", ...TH_STYLE }}
            >
              학년
            </th>
            <th
              className="px-4 py-3 text-sm font-semibold border-b border-[var(--color-border-divider)]"
              style={{ textAlign: "left", whiteSpace: "nowrap", ...TH_STYLE }}
            >
              학교
            </th>
            <th
              className="px-4 py-3 text-sm font-semibold border-b border-[var(--color-border-divider)]"
              style={{ textAlign: "center", width: 160, whiteSpace: "nowrap", ...TH_STYLE }}
            >
              상태
            </th>
          </tr>
        </thead>

        <tbody className="divide-y divide-[var(--color-border-divider)]">
          {students.map((s) => (
            <tr key={s.id} className="hover:bg-[var(--color-bg-surface-soft)]">
              <td className="px-4 py-3 text-left text-[15px] font-bold text-[var(--color-text-primary)] truncate">
                {s.name}
              </td>
              <td className="px-4 py-3 text-center text-[14px] text-[var(--color-text-secondary)] truncate">
                {s.grade ?? "-"}
              </td>
              <td className="px-4 py-3 text-left text-[14px] text-[var(--color-text-secondary)] truncate">
                {s.school ?? "-"}
              </td>
              <td className="px-4 py-3 text-center text-[13px] font-semibold text-[var(--color-text-muted)] truncate">
                {s.status_label}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
