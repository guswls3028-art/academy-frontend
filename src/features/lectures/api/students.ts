// PATH: src/features/lectures/api/students.ts
import api from "@/shared/api/axios";

/**
 * 수강 학생 (Lecture → Enrollment → Student)
 * 백엔드 기준:
 * - Enrollment 도메인을 통해 Lecture-Student 관계가 형성됨
 * - GET /api/v1/enrollments/?lecture={lectureId}
 */

export type LectureStudent = {
  id: number; // Student ID
  name: string;
  grade: number | null;
  school: string | null;
  status: string; // enrollment.status (raw)
  status_label: string; // enrollment.status_display (serializer 기반)
};

export async function fetchLectureStudents(lectureId: number): Promise<LectureStudent[]> {
  const res = await api.get("/enrollments/", {
    params: {
      lecture: lectureId,
    },
  });

  const list = Array.isArray(res.data?.results)
    ? res.data.results
    : Array.isArray(res.data)
    ? res.data
    : [];

  return list.map((enrollment: any) => ({
    id: enrollment.student.id,
    name: enrollment.student.name,
    grade: enrollment.student.grade ?? null,
    school: enrollment.student.high_school ?? enrollment.student.middle_school ?? null,
    status: enrollment.status,
    status_label:
      enrollment.status_label ?? enrollment.status_display ?? enrollment.status,
  }));
}
