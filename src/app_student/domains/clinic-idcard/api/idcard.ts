// PATH: src/app_student/domains/clinic-idcard/api/idcard.ts
// 실제 API: GET /api/v1/clinic/idcard/ (차시별 합불 단일 진실: progress.ClinicLink)

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
  background_colors: [string, string, string];  // 위조 방지용 배경 그라데이션 색상 3개
  server_date: string;
  server_datetime: string;
  histories: ClinicIdcardHistoryItem[];
  current_targets: ClinicCurrentTarget[];
  lectures: ClinicIdcardLecture[];
  current_result: ClinicIdcardResult;
};

export async function fetchClinicIdcard(): Promise<ClinicIdcardData> {
  const res = await api.get("/clinic/idcard/");
  const data = res.data as ClinicIdcardData;
  const defaultColors: [string, string, string] = ["#ef4444", "#3b82f6", "#22c55e"];
  const bgColors = Array.isArray(data.background_colors) && data.background_colors.length >= 3
    ? [data.background_colors[0], data.background_colors[1], data.background_colors[2]] as [string, string, string]
    : defaultColors;
  
  return {
    student_name: data.student_name ?? "",
    profile_photo_url: data.profile_photo_url ?? null,
    background_colors: bgColors,
    server_date: data.server_date ?? "",
    server_datetime: data.server_datetime ?? "",
    histories: Array.isArray(data.histories) ? data.histories : [],
    current_targets: Array.isArray(data.current_targets) ? data.current_targets : [],
    lectures: Array.isArray(data.lectures) ? data.lectures : [],
    current_result: data.current_result === "FAIL" ? "FAIL" : "SUCCESS",
  };
}
