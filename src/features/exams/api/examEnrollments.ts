import api from "@/shared/api/axios";

export type ExamEnrollmentRow = {
  enrollment_id: number;
  student_name: string;
  is_selected: boolean;
};

export type ExamEnrollmentManageResponse = {
  exam_id: number;
  session_id: number;
  items: ExamEnrollmentRow[];
};

/**
 * 단일 진실:
 * - enrollment_id만 사용 (student_id 금지)
 *
 * GET /api/v1/exams/{examId}/enrollments/?session_id=
 */
export async function fetchExamEnrollmentRows(params: {
  examId: number;
  sessionId: number;
}): Promise<ExamEnrollmentManageResponse> {
  const res = await api.get(
    `/exams/${params.examId}/enrollments/`,
    { params: { session_id: params.sessionId } }
  );
  return res.data;
}

/**
 * PUT /api/v1/exams/{examId}/enrollments/?session_id=
 */
export async function updateExamEnrollmentRows(params: {
  examId: number;
  sessionId: number;
  enrollment_ids: number[];
}) {
  const res = await api.put(
    `/exams/${params.examId}/enrollments/`,
    { enrollment_ids: params.enrollment_ids },
    { params: { session_id: params.sessionId } }
  );

  return res.data;
}
