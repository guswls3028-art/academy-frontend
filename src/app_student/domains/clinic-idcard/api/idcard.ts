import api from "@student/shared/api/student.api";

export type ClinicIdcardResult = "SUCCESS" | "FAIL";

export type ClinicIdcardHistoryItem = {
  enrollment_id?: number;
  lecture_id?: number;
  lecture_title?: string;
  lecture_color?: string | null;
  lecture_chip_label?: string | null;
  session_id?: number;
  session_order: number;
  session_title?: string;
  passed: boolean;
  clinic_required: boolean;
};

export type ClinicIdcardLecture = {
  id: number;
  title: string;
  color?: string | null;
  chip_label?: string | null;
};

export type ClinicCurrentTarget = {
  clinic_link_id: number;
  enrollment_id: number;
  lecture_id: number;
  lecture_title: string;
  lecture_color?: string | null;
  lecture_chip_label?: string | null;
  session_id: number;
  session_order: number;
  session_title?: string;
  source_type?: "exam" | "homework" | null;
};

export type ClinicIdcardData = {
  student_name: string;
  profile_photo_url: string | null;
  background_colors: [string, string, string];
  server_date: string;
  server_datetime: string;
  histories: ClinicIdcardHistoryItem[];
  current_targets: ClinicCurrentTarget[];
  lectures: ClinicIdcardLecture[];
  current_result: ClinicIdcardResult;
};

const DEFAULT_COLORS: [string, string, string] = ["#ef4444", "#3b82f6", "#22c55e"];

export async function fetchClinicIdcard(): Promise<ClinicIdcardData> {
  const res = await api.get("/clinic/idcard/");
  const raw = res.data as Partial<ClinicIdcardData>;
  if (raw.current_result !== "SUCCESS" && raw.current_result !== "FAIL") {
    throw new Error("Invalid clinic passcard result");
  }
  const colors = Array.isArray(raw.background_colors) && raw.background_colors.length >= 3
    ? raw.background_colors.slice(0, 3) as [string, string, string]
    : DEFAULT_COLORS;

  return {
    student_name: raw.student_name ?? "",
    profile_photo_url: raw.profile_photo_url ?? null,
    background_colors: colors,
    server_date: raw.server_date ?? "",
    server_datetime: raw.server_datetime ?? "",
    histories: Array.isArray(raw.histories) ? raw.histories : [],
    current_targets: Array.isArray(raw.current_targets) ? raw.current_targets : [],
    lectures: Array.isArray(raw.lectures) ? raw.lectures : [],
    current_result: raw.current_result,
  };
}
