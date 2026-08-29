import api from "@student/shared/api/student.api";

export type ClinicIdcardResult = "SUCCESS" | "FAIL";
export type ClinicPasscardState = "PASSED" | "CLINIC_REQUIRED" | "RETURN_ALLOWED";
export type ClinicBookingStatus =
  | "none"
  | "required"
  | "pending"
  | "booked"
  | "attended"
  | "completed";

export type ClinicIdcardBooking = {
  participant_id: number;
  session_id: number | null;
  title: string;
  status: Exclude<ClinicBookingStatus, "none" | "required">;
  status_label: string;
  date: string | null;
  start_time: string | null;
  location: string | null;
};

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
  passcard_state: ClinicPasscardState;
  can_leave: boolean;
  booking_status: ClinicBookingStatus;
  booking_status_label: string;
  current_booking: ClinicIdcardBooking | null;
  valid_bookings: ClinicIdcardBooking[];
};

const DEFAULT_COLORS: [string, string, string] = ["#ef4444", "#3b82f6", "#22c55e"];

export async function fetchClinicIdcard(): Promise<ClinicIdcardData> {
  const res = await api.get("/clinic/idcard/");
  const raw = res.data as Partial<ClinicIdcardData>;
  if (raw.current_result !== "SUCCESS" && raw.current_result !== "FAIL") {
    throw new Error("Invalid clinic passcard result");
  }
  const passcardState = ["PASSED", "CLINIC_REQUIRED", "RETURN_ALLOWED"].includes(
    String(raw.passcard_state),
  )
    ? raw.passcard_state as ClinicPasscardState
    : raw.current_result === "FAIL" ? "CLINIC_REQUIRED" : "PASSED";
  const bookingStatus = ["none", "required", "pending", "booked", "attended", "completed"].includes(
    String(raw.booking_status),
  )
    ? raw.booking_status as ClinicBookingStatus
    : raw.current_result === "FAIL" ? "required" : "none";
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
    passcard_state: passcardState,
    can_leave: passcardState !== "CLINIC_REQUIRED",
    booking_status: bookingStatus,
    booking_status_label: raw.booking_status_label ?? (bookingStatus === "required" ? "예약 필요" : "예약 없음"),
    current_booking: raw.current_booking ?? null,
    valid_bookings: Array.isArray(raw.valid_bookings) ? raw.valid_bookings : [],
  };
}
