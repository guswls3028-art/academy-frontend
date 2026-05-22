import api from "@/shared/api/axios";

export type ClinicReason = "exam" | "homework" | "both";

export type ResolutionType =
  | "EXAM_PASS"
  | "HOMEWORK_PASS"
  | "MANUAL_OVERRIDE"
  | "WAIVED"
  | "BOOKING_LEGACY"
  | null;

export type AttemptHistoryEntry = {
  attempt_index: number;
  score: number | null;
  max_score: number | null;
  passed: boolean;
  at: string | null;
};

export type ClinicTarget = {
  enrollment_id: number;
  student_id?: number | null;
  student_name: string;
  session_title: string;
  clinic_reason?: ClinicReason;
  reason?: "score" | "confidence" | "missing";
  exam_score?: number | null;
  cutline_score?: number;
  homework_score?: number;
  homework_cutline?: number;
  clinic_link_id?: number;
  cycle_no?: number;
  resolution_type?: ResolutionType;
  resolved_at?: string | null;
  session_id?: number;
  lecture_id?: number;
  exam_id?: number | null;
  source_type?: "exam" | "homework" | null;
  source_id?: number | null;
  source_title?: string | null;
  lecture_title?: string | null;
  lecture_color?: string | null;
  lecture_chip_label?: string | null;
  name_highlight_clinic_target?: boolean;
  parent_phone?: string;
  student_phone?: string;
  school?: string;
  school_type?: string;
  grade?: number | null;
  profile_photo_url?: string | null;
  max_score?: number | null;
  latest_attempt_index?: number;
  attempt_history?: AttemptHistoryEntry[];
  created_at: string;
};

export type RetakeResponse = {
  passed: boolean;
  score: number;
  max_score: number;
  pass_score?: number | null;
  attempt_index: number;
  resolution_type: ResolutionType;
  resolved_at: string | null;
  clinic_link_id: number;
};

export async function fetchClinicTargets(params?: { section_id?: number }) {
  const res = await api.get("/results/admin/clinic-targets/", { params });
  return res.data as ClinicTarget[];
}
