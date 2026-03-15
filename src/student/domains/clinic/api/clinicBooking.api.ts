// PATH: src/student/domains/clinic/api/clinicBooking.api.ts
// 학생 앱 클리닉 예약 API

import api from "@/student/shared/api/studentApi";

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
};

/**
 * 학생의 클리닉 예약 신청 정보
 */
export type ClinicBookingRequest = {
  id: number;
  session: number | null; // ✅ 세션이 없을 수 있음
  session_date: string;
  session_start_time: string;
  session_location: string | null; // ✅ 세션이 없으면 null
  status: "pending" | "approved" | "rejected" | "cancelled" | "booked";
  memo?: string;
  created_at: string;
  updated_at?: string;
  status_changed_at?: string;
};

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

  const res = await api.get("/clinic/sessions/", {
    params: {
      date_from: dateFrom,
      date_to: dateTo,
    },
  });

  const sessions = Array.isArray(res.data)
    ? res.data
    : Array.isArray(res.data?.results)
    ? res.data.results
    : [];

  return sessions as ClinicSession[];
}

/**
 * 학생의 클리닉 예약 신청 목록 조회
 * GET /clinic/participants/
 * 백엔드에서 자동으로 현재 로그인한 학생의 예약만 반환
 */
export async function fetchMyClinicBookingRequests(): Promise<ClinicBookingRequest[]> {
  const res = await api.get("/clinic/participants/");

  const participants = Array.isArray(res.data)
    ? res.data
    : Array.isArray(res.data?.results)
    ? res.data.results
    : [];

  // 예약 신청 상태인 것만 필터링 (pending, booked 등)
  return participants
    .filter((p: any) =>
      p.status === "pending" ||
      p.status === "booked" ||
      p.status === "approved" ||
      p.status === "rejected"
    )
    .map((p: any) => ({
      id: p.id,
      session: p.session || null, // ✅ 세션이 없을 수 있음
      session_date: p.session_date,
      session_start_time: p.session_start_time,
      session_location: p.session_location || null, // ✅ 세션이 없으면 null
      status: p.status === "approved" ? "booked" : p.status, // approved는 booked로 매핑
      memo: p.memo,
      created_at: p.created_at,
      updated_at: p.updated_at,
      status_changed_at: p.status_changed_at,
    }));
}

/**
 * 클리닉 예약 신청
 * POST /clinic/participants/
 *
 * ✅ 이미 생성된 클리닉(세션)만 예약 가능 — session 필수
 * 백엔드에서 student, source, status, enrollment_id 자동 설정
 */
export async function createClinicBookingRequest(data: {
  session: number;
  memo?: string;
}): Promise<ClinicBookingRequest> {
  if (!data.session) {
    throw new Error("등록 가능한 클리닉 시간을 선택해주세요.");
  }
  const res = await api.post("/clinic/participants/", {
    source: "student_request",
    status: "pending",
    session: data.session,
    memo: data.memo ?? undefined,
  });

  return {
    id: res.data.id,
    session: res.data.session,
    session_date: res.data.session_date,
    session_start_time: res.data.session_start_time,
    session_location: res.data.session_location || null,
    status: res.data.status,
    memo: res.data.memo,
    created_at: res.data.created_at,
  };
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
  memo?: string
): Promise<ClinicBookingRequest> {
  const res = await api.post(
    `/clinic/participants/${oldParticipantId}/change-booking/`,
    {
      new_session_id: newSessionId,
      memo: memo ?? undefined,
    }
  );

  return {
    id: res.data.id,
    session: res.data.session,
    session_date: res.data.session_date,
    session_start_time: res.data.session_start_time,
    session_location: res.data.session_location || null,
    status: res.data.status,
    memo: res.data.memo,
    created_at: res.data.created_at,
  };
}
