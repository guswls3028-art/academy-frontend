import api from "@/shared/api/axios";

interface StoredExamResult {
  target_id: number;
  enrollment_id: number;
  total_score: number | null;
  max_score: number | null;
}

export async function fetchStoredExamResult<T extends StoredExamResult = StoredExamResult>(examId: number, enrollmentId: number): Promise<T> {
  const { data } = await api.get<T>(`/results/admin/exams/${examId}/enrollments/${enrollmentId}/`);
  return data;
}
