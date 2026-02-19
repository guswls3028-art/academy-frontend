// PATH: src/student/domains/clinic-idcard/api/idcard.ts
// 실제 API: GET /api/v1/clinic/idcard/ (차시별 합불 단일 진실: progress.ClinicLink)

import api from "@/student/shared/api/studentApi";

export type ClinicIdcardResult = "SUCCESS" | "FAIL";

export type ClinicIdcardHistoryItem = {
  session_order: number;
  passed: boolean;
  clinic_required: boolean;
};

export type ClinicIdcardData = {
  student_name: string;
  profile_photo_url: string | null;
  server_date: string;
  server_datetime: string;
  histories: ClinicIdcardHistoryItem[];
  current_result: ClinicIdcardResult;
};

export async function fetchClinicIdcard(): Promise<ClinicIdcardData> {
  const res = await api.get("/clinic/idcard/");
  const data = res.data as ClinicIdcardData;
  return {
    student_name: data.student_name ?? "",
    profile_photo_url: data.profile_photo_url ?? null,
    server_date: data.server_date ?? "",
    server_datetime: data.server_datetime ?? "",
    histories: Array.isArray(data.histories) ? data.histories : [],
    current_result: data.current_result === "FAIL" ? "FAIL" : "SUCCESS",
  };
}
