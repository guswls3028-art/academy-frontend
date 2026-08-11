import api from "@/shared/api/axios";
import { runWithScoreEditLease } from "@/shared/scoring/scoreEditLease";

export type StudentAchievement = "PASS" | "FAIL" | "REMEDIATED" | "NOT_SUBMITTED";

export type StudentExamGrade = {
  exam_id: number;
  enrollment_id: number;
  title: string;
  total_score: number | null;
  max_score: number | null;
  is_pass?: boolean | null;
  achievement?: StudentAchievement | null;
  meta_status?: string | null;
  remediated?: boolean | null;
  final_pass?: boolean | null;
  retake_count?: number | null;
  display_order?: number;
  session_id?: number | null;
  session_title?: string | null;
  session_order?: number | null;
  session_regular_order?: number | null;
  session_type?: "REGULAR" | "SUPPLEMENT" | null;
  session_date?: string | null;
  lecture_id?: number | null;
  lecture_title?: string | null;
  lecture_color?: string | null;
  lecture_chip_label?: string | null;
  submitted_at?: string | null;
  recorded_at?: string | null;
  archived?: boolean;
};

export type StudentHomeworkGrade = {
  homework_id: number;
  enrollment_id: number;
  title: string;
  grading_mode: "SCORE" | "COMPLETION";
  score: number | null;
  max_score: number | null;
  passed?: boolean | null;
  is_locked?: boolean;
  lock_reason?: string | null;
  score_updated_at?: string | null;
  meta_status?: string | null;
  achievement?: StudentAchievement | null;
  retake_count?: number | null;
  display_order?: number;
  session_id?: number | null;
  session_title?: string | null;
  session_order?: number | null;
  session_regular_order?: number | null;
  session_type?: "REGULAR" | "SUPPLEMENT" | null;
  lecture_id?: number | null;
  lecture_title?: string | null;
  lecture_color?: string | null;
  lecture_chip_label?: string | null;
};

export type StudentExamTrendPoint = {
  round_index: number;
  exam_id: number;
  enrollment_id: number;
  title: string;
  score: number;
  max_score: number;
  score_pct: number;
  recorded_at: string | null;
  session_id: number | null;
  session_title: string | null;
  session_order: number | null;
  session_regular_order: number | null;
  session_type?: "REGULAR" | "SUPPLEMENT" | null;
  session_date: string | null;
  lecture_id: number | null;
  lecture_title: string | null;
  lecture_color: string | null;
  lecture_chip_label: string | null;
  rank?: number | null;
  percentile?: number | null;
  cohort_size?: number | null;
  cohort_avg?: number | null;
  retake_count: number;
  archived: boolean;
};

export type StudentExamSummary = {
  scored_count: number;
  average_score_pct: number | null;
  latest_score_pct: number | null;
  change_pct_points: number | null;
  best_score_pct: number | null;
};

export type StudentScoreLectureOption = {
  id: number;
  title: string;
  color: string | null;
  chip_label: string | null;
};

export type StudentGradesResponse = {
  exams: StudentExamGrade[];
  homeworks: StudentHomeworkGrade[];
  exam_trend: StudentExamTrendPoint[];
  exam_summary: StudentExamSummary;
};

const EMPTY_SUMMARY: StudentExamSummary = {
  scored_count: 0,
  average_score_pct: null,
  latest_score_pct: null,
  change_pct_points: null,
  best_score_pct: null,
};

export async function fetchAdminStudentGrades(studentId: number): Promise<StudentGradesResponse> {
  const res = await api.get<Partial<StudentGradesResponse>>("/results/admin/student-grades/", {
    params: { student_id: studentId },
  });
  const data = res.data ?? {};
  return {
    exams: Array.isArray(data.exams) ? data.exams : [],
    homeworks: Array.isArray(data.homeworks) ? data.homeworks : [],
    exam_trend: Array.isArray(data.exam_trend) ? data.exam_trend : [],
    exam_summary: data.exam_summary ?? EMPTY_SUMMARY,
  };
}

export async function updateStudentHomeworkGrade(
  grade: Pick<StudentHomeworkGrade, "homework_id" | "enrollment_id" | "session_id">,
  score: number,
) {
  const sessionId = Number(grade.session_id);
  if (!Number.isInteger(sessionId) || sessionId <= 0) {
    throw new Error("과제 차시를 확인할 수 없습니다.");
  }
  return runWithScoreEditLease(sessionId, async (headers) => {
    const res = await api.patch(
      "/homework/scores/quick/",
      {
        session_id: sessionId,
        enrollment_id: grade.enrollment_id,
        homework_id: grade.homework_id,
        score,
      },
      { headers },
    );
    return res.data;
  });
}
