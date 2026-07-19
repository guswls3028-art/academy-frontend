import api from "@/shared/api/axios";

export type StudentPerformancePeriod = 30 | 90 | 180 | 365 | "all";
export type StudentScoreBand = "under_60" | "60_to_79" | "80_plus" | "unscored";
export type StudentTrendDirection = "up" | "down" | "flat" | "insufficient";

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
  };
  filter_options: {
    lectures: StudentPerformanceLecture[];
    grades: number[];
  };
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
    },
    students: Array.isArray(response.data?.students) ? response.data.students : [],
  };
}
