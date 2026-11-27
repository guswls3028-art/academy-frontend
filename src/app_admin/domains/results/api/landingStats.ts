// PATH: src/app_admin/domains/results/api/landingStats.ts
import api from "@/shared/api/axios";

export type LandingSubmissionSummary = {
  id: number;
  target_type: "exam" | "homework" | string;
  target_id: number;
  target_title: string;
  lecture_id: number | null;
  lecture_title: string;
  session_id: number | null;
  session_origin_recorded?: boolean;
  score_lecture_id?: number | null;
  session_choices?: Array<{ lecture_id: number; lecture_title: string; session_id: number; session_title: string }>;
  enrollment_id: number | null;
  student_name: string;
  status: string;
  created_at: string | null;
};

export type ResultsLandingStats = {
  active_lectures: number;
  active_exams: number;
  pending_submissions: number;
  done_last_7d: number;
  failed_last_24h: number;
  pending_top: LandingSubmissionSummary[];
  recent_done_top: LandingSubmissionSummary[];
};

export async function fetchResultsLandingStats(): Promise<ResultsLandingStats> {
  const res = await api.get<ResultsLandingStats>("/results/admin/landing-stats/", { params: { session_choices: 1 } });
  return res.data;
}
