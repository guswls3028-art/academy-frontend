import api from "@/shared/api/axios";

export type ExamLectureAssignmentSession = {
  session_id: number;
  session_title: string;
  session_label: string;
  session_date?: string | null;
  section_label?: string | null;
};

export type ExamLectureAssignment = {
  lecture_id: number;
  lecture_title: string;
  lecture_color?: string | null;
  lecture_chip_label?: string | null;
  pass_score: number;
  uses_default_pass_score: boolean;
  roster_count: number;
  selected_count: number;
  sessions: ExamLectureAssignmentSession[];
};

export type ExamLectureAssignmentsPayload = {
  exam_id: number;
  default_pass_score: number;
  total_roster_count: number;
  total_selected_count: number;
  assignments: ExamLectureAssignment[];
};

export async function fetchExamLectureAssignments(
  examId: number,
): Promise<ExamLectureAssignmentsPayload> {
  const response = await api.get(`/exams/${examId}/lecture-assignments/`);
  return response.data;
}

export async function attachExamSession(
  examId: number,
  payload: { session_id: number; pass_score: number },
): Promise<ExamLectureAssignmentsPayload> {
  const response = await api.post(
    `/exams/${examId}/lecture-assignments/`,
    payload,
  );
  return response.data;
}

export async function updateExamLectureCutoff(
  examId: number,
  payload: { lecture_id: number; pass_score: number },
): Promise<ExamLectureAssignmentsPayload> {
  const response = await api.patch(
    `/exams/${examId}/lecture-assignments/`,
    payload,
  );
  return response.data;
}
