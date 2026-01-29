import { useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import StudentsTable from "@/features/students/components/StudentsTable";
import api from "@/shared/api/axios";

import { fetchLectureEnrollments } from "@/features/lectures/api/enrollments";
import { PageSection } from "@/shared/ui/page";
import { EmptyState } from "@/shared/ui/feedback";

export default function LectureStudentsPage() {
  const { lectureId } = useParams<{ lectureId?: string }>();
  const lectureIdNum = Number(lectureId);
  const qc = useQueryClient();

  const { data: enrollments = [], isLoading } = useQuery({
    queryKey: ["lecture-enrollments", lectureIdNum],
    queryFn: () => fetchLectureEnrollments(lectureIdNum),
    enabled: Number.isFinite(lectureIdNum),
  });

  if (isLoading) {
    return (
      <PageSection title="수강생 목록">
        <div className="text-sm text-[var(--text-muted)]">
          로딩중...
        </div>
      </PageSection>
    );
  }

  const studentList = enrollments.map((en: any) => {
    const st = en.student;
    return {
      id: en.id,
      name: st?.name,
      studentPhone: st?.phone,
      parentPhone: st?.parent_phone,
      school: st?.high_school,
      schoolClass: st?.high_school_class,
      major: st?.major,
      grade: st?.grade,
      gender: st?.gender ?? "-",
      registeredAt: en.enrolled_at,
      active: en.status === "ACTIVE",
    };
  });

  return (
    <PageSection title={`수강생 목록 (${studentList.length})`}>
      {studentList.length === 0 ? (
        <EmptyState
          title="수강 중인 학생이 없습니다."
          description="학생을 등록하면 이곳에 표시됩니다."
        />
      ) : (
        <StudentsTable
          data={studentList}
          onDelete={async (enrollmentId: number) => {
            await api.delete(`/enrollments/${enrollmentId}/`);
            qc.invalidateQueries({
              queryKey: ["lecture-enrollments", lectureIdNum],
            });
          }}
          onRowClick={() => {}}
        />
      )}
    </PageSection>
  );
}
