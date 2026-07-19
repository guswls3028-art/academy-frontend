import api from "@/shared/api/axios";

export type StudentPerformancePeriod = 30 | 90 | 180 | 365 | "all";
export type StudentScoreBand = "under_60" | "60_to_79" | "80_plus" | "unscored";
export type StudentTrendDirection = "up" | "down" | "flat" | "insufficient";
export type StudentPerformanceSource = "overall" | "academy" | "school" | "mock";

export type StudentPerformanceSourceSummary = {
  scored_count: number;
  average_score_pct: number | null;
  latest_score_pct: number | null;
  change_pct_points: number | null;
  first_to_latest_pct_points: number | null;
  best_score_pct: number | null;
  score_band: StudentScoreBand;
  trend_direction: StudentTrendDirection;
};

export type StudentReportedScore = {
  id: number;
  student_id: number;
  student_name?: string;
  school?: string | null;
  grade?: number | null;
  source: "school_exam" | "national_mock" | "kice_mock";
  source_group: "school" | "mock";
  label: string;
  academic_year: number;
  semester: number | null;
  exam_round: "first" | "second" | null;
  exam_month: number | null;
  exam_date: string | null;
  subject: string;
  score: number;
  max_score: number;
  score_pct: number | null;
  standard_score: number | null;
  percentile: number | null;
  grade_rank: number | null;
  grade_scale: "five" | "nine" | null;
  achievement_level: "A" | "B" | "C" | "D" | "E" | null;
  subject_average: number | null;
  standard_deviation: number | null;
  cohort_size: number | null;
  status: "pending" | "verified" | "rejected";
  review_note: string;
  evidence_file_id: number;
  evidence_r2_key: string;
  created_at: string | null;
  reviewed_at: string | null;
};

export type StudentPerformanceLecture = {
  id: number;
  title: string;
  color: string | null;
  chip_label: string | null;
  is_active: boolean;
  enrollment_id?: number;
  enrollment_status?: string;
};

export type StudentPerformanceRow = {
  student_id: number;
  name: string;
  display_name: string;
  grade: number | null;
  school_type: string | null;
  school: string | null;
  lectures: StudentPerformanceLecture[];
  scored_count: number;
  average_score_pct: number | null;
  latest_score_pct: number | null;
  change_pct_points: number | null;
  first_to_latest_pct_points: number | null;
  best_score_pct: number | null;
  latest_exam_title: string | null;
  last_recorded_at: string | null;
  score_band: StudentScoreBand;
  trend_direction: StudentTrendDirection;
  source_summaries: Record<StudentPerformanceSource, StudentPerformanceSourceSummary>;
  subject_summaries: {
    school: Record<string, StudentPerformanceSourceSummary>;
    mock: Record<string, StudentPerformanceSourceSummary>;
  };
  reported_scores: StudentReportedScore[];
  pending_reported_score_count: number;
};

export type StudentPerformanceConsoleResponse = {
  period: {
    days: number | null;
    from: string | null;
    to: string;
  };
  summary: {
    student_count: number;
    scored_student_count: number;
    result_count: number;
    average_score_pct: number | null;
    under_60_student_count: number;
    improving_student_count: number;
    declining_student_count: number;
    pending_reported_score_count: number;
    verified_school_score_count: number;
    verified_mock_score_count: number;
  };
  filter_options: {
    lectures: StudentPerformanceLecture[];
    grades: number[];
    reported_subjects: string[];
  };
  pending_reported_scores: StudentReportedScore[];
  students: StudentPerformanceRow[];
};

export async function fetchStudentPerformanceConsole({
  period,
  lectureId,
}: {
  period: StudentPerformancePeriod;
  lectureId: number | null;
}): Promise<StudentPerformanceConsoleResponse> {
  const response = await api.get<StudentPerformanceConsoleResponse>(
    "/results/admin/student-performance/",
    {
      params: {
        days: period,
        lecture_id: lectureId ?? undefined,
      },
    },
  );
  return {
    ...response.data,
    filter_options: {
      lectures: Array.isArray(response.data?.filter_options?.lectures)
        ? response.data.filter_options.lectures
        : [],
      grades: Array.isArray(response.data?.filter_options?.grades)
        ? response.data.filter_options.grades
        : [],
      reported_subjects: Array.isArray(response.data?.filter_options?.reported_subjects)
        ? response.data.filter_options.reported_subjects
        : [],
    },
    students: Array.isArray(response.data?.students) ? response.data.students : [],
    pending_reported_scores: Array.isArray(response.data?.pending_reported_scores)
      ? response.data.pending_reported_scores
      : [],
  };
}

export async function reviewStudentReportedScore({
  scoreId,
  action,
  reviewNote,
}: {
  scoreId: number;
  action: "verify" | "reject";
  reviewNote?: string;
}): Promise<StudentReportedScore> {
  const response = await api.patch<StudentReportedScore>(
    `/results/admin/reported-scores/${scoreId}/review/`,
    { action, review_note: reviewNote ?? "" },
  );
  return response.data;
}
