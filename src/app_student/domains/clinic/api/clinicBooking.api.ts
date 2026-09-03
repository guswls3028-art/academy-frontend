// PATH: src/app_student/domains/clinic/api/clinicBooking.api.ts
// 학생 앱 클리닉 예약 API

import api from "@student/shared/api/student.api";
import { richHtmlToPlainText } from "@/shared/utils/richHtml";

/** DRF Paginated wrapper — list endpoint 가 page_size param 으로 응답할 때. */
type Paginated<T> = { results?: T[]; count?: number; next?: string | null; previous?: string | null };

export type ClinicBookingStatus = "pending" | "rejected" | "cancelled" | "booked";

/** 학생앱이 실제로 사용하는 ClinicParticipant 응답 필드 (어드민 ClinicParticipant 보다 좁음). */
type ClinicParticipantRaw = {
  id: number;
  session: number | null;
  session_title?: string;
  session_date: string;
  session_start_time: string;
  session_location: string | null;
  status: ClinicBookingStatus | "approved" | "attended" | "no_show";
  student_request_memo?: string;
  preferred_start_time?: string | null;
  preferred_end_time?: string | null;
  booking_start_time?: string | null;
  booking_end_time?: string | null;
  created_at: string;
  updated_at?: string;
  status_changed_at?: string;
};

/**
 * 클리닉 세션 정보
 */
export type ClinicSession = {
  id: number;
  title?: string;
  date: string; // YYYY-MM-DD
  start_time: string; // HH:MM:SS or HH:MM
  end_time?: string;
  location: string;
  /** 대상 학년 (null = 전체). 백엔드가 학생 학년에 맞는 세션만 반환 */
  target_grade?: number | null;
  participant_count: number;
  booked_count: number;
  max_participants?: number;
  /** 백엔드가 내려주면 사용, 없으면 booked_count >= max_participants로 계산 */
  is_full?: boolean;
  allow_time_preference?: boolean;
  allow_multi_slot_booking?: boolean;
  booking_mode?: "fixed_slot" | "time_range";
  booking_interval_minutes?: 30 | 60;
  booking_max_stay_minutes?: number;
  target_lecture_names?: Array<{
    id: number;
    title: string;
    color?: string | null;
    chip_label?: string | null;
  }>;
};

/**
 * 학생의 클리닉 예약 신청 정보
 */
export type ClinicBookingRequest = {
  id: number;
  session: number | null; // ✅ 세션이 없을 수 있음
  session_title?: string;
  session_date: string;
  session_start_time: string;
  session_location: string | null; // ✅ 세션이 없으면 null
  status: ClinicBookingStatus;
  student_request_memo?: string;
  preferred_start_time?: string | null;
  preferred_end_time?: string | null;
  booking_start_time?: string | null;
  booking_end_time?: string | null;
  created_at: string;
  updated_at?: string;
  status_changed_at?: string;
};

function normalizeBookingStatus(status: ClinicParticipantRaw["status"]): ClinicBookingStatus | null {
  if (status === "approved") return "booked";
  if (status === "pending" || status === "booked" || status === "rejected" || status === "cancelled") {
    return status;
  }
  return null;
}

function normalizeClinicSession(session: ClinicSession): ClinicSession {
  return {
    ...session,
    allow_multi_slot_booking: session.allow_multi_slot_booking === true,
    booking_mode: session.booking_mode === "time_range" ? "time_range" : "fixed_slot",
    booking_interval_minutes: session.booking_interval_minutes === 30 ? 30 : 60,
    booking_max_stay_minutes: session.booking_max_stay_minutes ?? 240,
    title: session.title == null ? session.title : richHtmlToPlainText(session.title),
    location: richHtmlToPlainText(session.location),
    target_lecture_names: Array.isArray(session.target_lecture_names)
      ? session.target_lecture_names.map((lecture) => ({
          ...lecture,
          title: richHtmlToPlainText(lecture.title),
          chip_label: lecture.chip_label == null
            ? lecture.chip_label
            : richHtmlToPlainText(lecture.chip_label),
        }))
      : session.target_lecture_names,
  };
}

function normalizeClinicBookingRequest(request: ClinicBookingRequest): ClinicBookingRequest {
  return {
    ...request,
    session_title: request.session_title == null
      ? request.session_title
      : richHtmlToPlainText(request.session_title),
    session_location: request.session_location == null
      ? request.session_location
      : richHtmlToPlainText(request.session_location),
    student_request_memo: request.student_request_memo == null
      ? request.student_request_memo
      : richHtmlToPlainText(request.student_request_memo),
  };
}

/**
 * 예약 가능한 클리닉 세션 목록 조회
 * GET /clinic/sessions/?date_from=YYYY-MM-DD&date_to=YYYY-MM-DD
 * ✅ 이미 생성된 클리닉만 반환 — 학생은 이 목록에서만 예약 가능
 */
export async function fetchAvailableClinicSessions(params?: {
  date_from?: string;
  date_to?: string;
}): Promise<ClinicSession[]> {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const future = new Date(now);
  future.setDate(now.getDate() + 14);
  const futureStr = `${future.getFullYear()}-${pad(future.getMonth() + 1)}-${pad(future.getDate())}`;

  const dateFrom = params?.date_from || todayStr;
  const dateTo = params?.date_to || futureStr;

  const res = await api.get<ClinicSession[] | Paginated<ClinicSession>>("/clinic/sessions/", {
    params: {
      date_from: dateFrom,
      date_to: dateTo,
      page_size: 200,
    },
  });

  const sessions: ClinicSession[] = Array.isArray(res.data)
    ? res.data
    : Array.isArray(res.data?.results)
    ? res.data.results
    : [];

  return sessions.map(normalizeClinicSession);
}

/**
 * 학생의 클리닉 예약 신청 목록 조회
 * GET /clinic/participants/
 * 백엔드에서 자동으로 현재 로그인한 학생의 예약만 반환
 */
export async function fetchMyClinicBookingRequests(): Promise<ClinicBookingRequest[]> {
  const res = await api.get<ClinicParticipantRaw[] | Paginated<ClinicParticipantRaw>>(
    "/clinic/participants/",
    { params: { page_size: 200 } },
  );

  const participants: ClinicParticipantRaw[] = Array.isArray(res.data)
    ? res.data
    : Array.isArray(res.data?.results)
    ? res.data.results
    : [];

  // 예약 신청 상태인 것만 필터링 (pending, booked 등)
  return participants
    .map((p) => ({ raw: p, status: normalizeBookingStatus(p.status) }))
    .filter((p): p is { raw: ClinicParticipantRaw; status: ClinicBookingStatus } => p.status !== null)
    .map(({ raw, status }) => normalizeClinicBookingRequest({
      id: raw.id,
      session: raw.session ?? null, // ✅ 세션이 없을 수 있음
      session_title: raw.session_title,
      session_date: raw.session_date,
      session_start_time: raw.session_start_time,
      session_location: raw.session_location ?? null, // ✅ 세션이 없으면 null
      status,
      student_request_memo: raw.student_request_memo,
      preferred_start_time: raw.preferred_start_time,
      preferred_end_time: raw.preferred_end_time,
      booking_start_time: raw.booking_start_time,
      booking_end_time: raw.booking_end_time,
      created_at: raw.created_at,
      updated_at: raw.updated_at,
      status_changed_at: raw.status_changed_at,
    }));
}

/**
 * 클리닉 예약 신청
 * POST /clinic/participants/bulk-create/
 *
 * ✅ 이미 생성된 같은 날짜의 클리닉(세션)만 예약 가능 — session_ids 필수
 * 백엔드에서 student, source, status, enrollment_id 자동 설정
 */
export async function createClinicBookingRequests(data: {
  session_ids: number[];
  student_request_memo?: string;
  preferred_start_time?: string;
  preferred_end_time?: string;
  booking_start_time?: string;
  booking_end_time?: string;
}): Promise<ClinicBookingRequest[]> {
  if (data.session_ids.length === 0) {
    throw new Error("등록 가능한 클리닉 시간을 선택해주세요.");
  }
  const res = await api.post<{
    count: number;
    participants: ClinicParticipantRaw[];
  }>("/clinic/participants/bulk-create/", {
    session_ids: data.session_ids,
    student_request_memo: data.student_request_memo ?? undefined,
    preferred_start_time: data.preferred_start_time ?? undefined,
    preferred_end_time: data.preferred_end_time ?? undefined,
    booking_start_time: data.booking_start_time ?? undefined,
    booking_end_time: data.booking_end_time ?? undefined,
  });

  return res.data.participants.map((participant) => {
    const status = normalizeBookingStatus(participant.status) ?? "pending";
    return normalizeClinicBookingRequest({
      id: participant.id,
      session: participant.session,
      session_title: participant.session_title,
      session_date: participant.session_date,
      session_start_time: participant.session_start_time,
      session_location: participant.session_location || null,
      status,
      student_request_memo: participant.student_request_memo,
      preferred_start_time: participant.preferred_start_time,
      preferred_end_time: participant.preferred_end_time,
      booking_start_time: participant.booking_start_time,
      booking_end_time: participant.booking_end_time,
      created_at: participant.created_at,
    });
  });
}

/**
 * 클리닉 예약 신청 취소
 * PATCH /clinic/participants/{id}/set_status/
 */
export async function cancelClinicBookingRequest(id: number): Promise<void> {
  await api.patch(`/clinic/participants/${id}/set_status/`, {
    status: "cancelled",
  });
}

/**
 * 클리닉 예약 변경 (atomic)
 * POST /clinic/participants/{id}/change-booking/
 *
 * 새 세션 예약이 확보된 후에만 기존 예약이 취소됩니다.
 * 새 예약 실패 시 기존 예약이 보존됩니다.
 */
export async function changeClinicBooking(
  oldParticipantId: number,
  newSessionId: number,
  studentRequestMemo?: string,
  preferredStartTime?: string,
  preferredEndTime?: string,
  bookingStartTime?: string,
  bookingEndTime?: string,
): Promise<ClinicBookingRequest> {
  const res = await api.post<ClinicParticipantRaw>(
    `/clinic/participants/${oldParticipantId}/change-booking/`,
    {
      new_session_id: newSessionId,
      student_request_memo: studentRequestMemo ?? undefined,
      preferred_start_time: preferredStartTime ?? undefined,
      preferred_end_time: preferredEndTime ?? undefined,
      booking_start_time: bookingStartTime ?? undefined,
      booking_end_time: bookingEndTime ?? undefined,
    }
  );

  const status = normalizeBookingStatus(res.data.status) ?? "pending";
  return normalizeClinicBookingRequest({
    id: res.data.id,
    session: res.data.session,
    session_title: res.data.session_title,
    session_date: res.data.session_date,
    session_start_time: res.data.session_start_time,
    session_location: res.data.session_location || null,
    status,
    student_request_memo: res.data.student_request_memo,
    preferred_start_time: res.data.preferred_start_time,
    preferred_end_time: res.data.preferred_end_time,
    booking_start_time: res.data.booking_start_time,
    booking_end_time: res.data.booking_end_time,
    created_at: res.data.created_at,
  });
}

export type ClinicAvailability = {
  booking_mode: "fixed_slot" | "time_range";
  interval_minutes: 30 | 60;
  max_stay_minutes: number;
  window: { start_time: string; end_time: string };
  slots: Array<{ start_time: string; end_time: string; remaining_capacity: number }>;
};

export async function fetchClinicAvailability(sessionId: number): Promise<ClinicAvailability> {
  const res = await api.get<ClinicAvailability>(`/clinic/sessions/${sessionId}/availability/`);
  return res.data;
}
