// PATH: src/student/domains/clinic/api/clinicBooking.api.ts
// 학생 앱 클리닉 예약 API

import api from "@/student/shared/api/studentApi";

/**
 * 클리닉 세션 정보
 */
export type ClinicSession = {
  id: number;
  date: string; // YYYY-MM-DD
  start_time: string; // HH:MM:SS or HH:MM
  end_time?: string;
  location: string;
  participant_count: number;
  booked_count: number;
  max_participants?: number;
};

/**
 * 학생의 클리닉 예약 신청 정보
 */
export type ClinicBookingRequest = {
  id: number;
  session: number;
  session_date: string;
  session_start_time: string;
  session_location: string;
  status: "pending" | "approved" | "rejected" | "cancelled" | "booked";
  memo?: string;
  created_at: string;
  updated_at?: string;
  status_changed_at?: string;
};

/**
 * 예약 가능한 클리닉 세션 목록 조회
 * GET /clinic/sessions/?date_from=YYYY-MM-DD&date_to=YYYY-MM-DD
 * 백엔드에서 학생도 조회 가능하도록 권한 설정됨
 */
export async function fetchAvailableClinicSessions(params?: {
  date_from?: string;
  date_to?: string;
}): Promise<ClinicSession[]> {
  try {
    const today = new Date();
    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 14); // 2주 후까지

    const dateFrom = params?.date_from || today.toISOString().slice(0, 10);
    const dateTo = params?.date_to || nextWeek.toISOString().slice(0, 10);

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

    // booked_count에 pending도 포함되므로, max_participants와 비교하여 예약 가능 여부 판단
    return sessions.filter((s: any) => {
      if (!s.max_participants) return true; // 정원 제한 없으면 예약 가능
      const booked = s.booked_count || 0;
      return booked < s.max_participants;
    }) as ClinicSession[];
  } catch (error) {
    console.error("예약 가능 세션 조회 실패:", error);
    return [];
  }
}

/**
 * 학생의 클리닉 예약 신청 목록 조회
 * GET /clinic/participants/
 * 백엔드에서 자동으로 현재 로그인한 학생의 예약만 반환
 */
export async function fetchMyClinicBookingRequests(): Promise<ClinicBookingRequest[]> {
  try {
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
        session: p.session,
        session_date: p.session_date,
        session_start_time: p.session_start_time,
        session_location: p.session_location,
        status: p.status === "approved" ? "booked" : p.status, // approved는 booked로 매핑
        memo: p.memo,
        created_at: p.created_at,
        updated_at: p.updated_at,
        status_changed_at: p.status_changed_at,
      }));
  } catch (error) {
    console.error("내 예약 신청 조회 실패:", error);
    return [];
  }
}

/**
 * 클리닉 예약 신청
 * POST /clinic/participants/
 * 
 * 백엔드에서 자동 처리:
 * - student: 현재 로그인한 학생 자동 설정
 * - source: "student_request" 자동 설정
 * - status: "pending" 자동 설정
 * - enrollment_id: 활성 enrollment 자동 조회
 */
export async function createClinicBookingRequest(data: {
  session: number;
  memo?: string;
}): Promise<ClinicBookingRequest> {
  const payload: any = {
    session: data.session,
    source: "student_request",
    status: "pending",
    memo: data.memo,
  };

  const res = await api.post("/clinic/participants/", payload);

  return {
    id: res.data.id,
    session: res.data.session,
    session_date: res.data.session_date,
    session_start_time: res.data.session_start_time,
    session_location: res.data.session_location,
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
