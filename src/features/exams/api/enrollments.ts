// PATH: src/features/exams/api/enrollments.ts

import api from "@/shared/api/axios";

export type ExamEnrollment = {
  id: number;
  student_id: number;
  student_name: string;
};

export async function fetchExamEnrollments(
  examId: number
): Promise<ExamEnrollment[]> {
  const res = await api.get(`/exams/${examId}/enrollments/`);

  const d = res.data;

  // ✅ 안전 파싱 (DRF pagination 대응)
  const items =
    Array.isArray(d?.results)
      ? d.results
      : Array.isArray(d)
      ? d
      : [];

  return items.map((x: any) => ({
    id: Number(x.id),
    student_id: Number(x.student_id),
    student_name: String(x.student_name ?? ""),
  }));
}
