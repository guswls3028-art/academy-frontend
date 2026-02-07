// PATH: src/features/lectures/pages/lectures/LectureStudentsPage.tsx

import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { PageHeader, Section, Panel, EmptyState } from "@/shared/ui/ds";
import {
  fetchLectureStudents,
  type LectureStudent,
} from "@/features/lectures/api/students";

export default function LectureStudentsPage() {
  const { lectureId } = useParams<{ lectureId: string }>();
  const lectureIdNum = Number(lectureId);

  const { data: students = [], isLoading } = useQuery<LectureStudent[]>({
    queryKey: ["lecture-students", lectureIdNum],
    queryFn: () => fetchLectureStudents(lectureIdNum),
    enabled: Number.isFinite(lectureIdNum),
  });

  return (
    <Section>
      <PageHeader title="수강 학생" />

      <Panel>
        {isLoading ? (
          <div className="py-12 text-center text-sm text-[var(--text-muted)]">
            불러오는 중…
          </div>
        ) : students.length === 0 ? (
          <EmptyState
            title="수강 중인 학생이 없습니다."
            description="학생이 등록되면 여기에 표시됩니다."
          />
        ) : (
          <div className="overflow-hidden rounded border border-[var(--border-divider)]">
            <table className="w-full text-sm">
              <thead className="bg-[var(--bg-surface-soft)]">
                <tr>
                  <th className="px-4 py-2 text-left">이름</th>
                  <th className="px-4 py-2 text-left">학년</th>
                  <th className="px-4 py-2 text-left">학교</th>
                  <th className="px-4 py-2 text-left">상태</th>
                </tr>
              </thead>
              <tbody>
                {students.map((s) => (
                  <tr
                    key={s.id}
                    className="border-t border-[var(--border-divider)]"
                  >
                    <td className="px-4 py-2 font-medium">{s.name}</td>
                    <td className="px-4 py-2">{s.grade}</td>
                    <td className="px-4 py-2">{s.school}</td>
                    <td className="px-4 py-2 text-[var(--text-muted)]">
                      {s.status_label}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </Section>
  );
}
