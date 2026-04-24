// PATH: src/app_admin/domains/clinic/api/clinicSessions.api.ts
import api from "@/shared/api/axios";
import dayjs from "dayjs";

export type ClinicSessionTreeNode = {
  id: number;
  title?: string;
  date: string; // YYYY-MM-DD
  start_time: string; // "HH:MM:SS" or "HH:MM"
  location: string;
  /** 대상 학년 (null = 전체) */
  target_grade?: number | null;
  /** 세션 길이(분) */
  duration_minutes?: number;

  participant_count: number;
  booked_count: number;
  no_show_count: number;
  /** 정원. 있으면 날짜 상태 dot(🟢🟡🔴) 계산에 사용 */
  max_participants?: number | null;
  /** section FK (section_mode=true에서 사용) */
  section?: number | null;
  /** section 라벨 (예: "A") — 정규형 클리닉에서 노출 */
  section_label?: string | null;
  /** section 타입 ("CLASS" | "CLINIC") — 필터/표시용 */
  section_type?: "CLASS" | "CLINIC" | null;
};

function normalizeDate(s: string): string {
  const d = dayjs(s);
  return d.isValid() ? d.format("YYYY-MM-DD") : s;
}

/**
 * 운영 좌측 트리 전용
 * GET /clinic/sessions/tree/?year=YYYY&month=MM[&section=ID|unassigned]
 * 응답 date를 YYYY-MM-DD로 정규화해 색상/필터 정합성 보장
 */
export async function fetchClinicSessionTree(params: {
  year: number;
  month: number; // 1~12
  /** 반 FK ID 또는 "unassigned" (미지정만). 생략 = 전체 */
  section?: number | "unassigned" | null;
}) {
  const { section, ...rest } = params;
  const query: Record<string, string | number> = { ...rest };
  if (section === "unassigned") query.section = "unassigned";
  else if (typeof section === "number") query.section = section;
  const res = await api.get("/clinic/sessions/tree/", { params: query });

  const raw = Array.isArray(res.data)
    ? res.data
    : Array.isArray(res.data?.results)
    ? res.data.results
    : [];
  return (raw as ClinicSessionTreeNode[]).map((s) => ({
    ...s,
    date: normalizeDate(s.date),
  }));
}

/**
 * 클리닉 생성 시 장소 불러오기
 * GET /clinic/sessions/locations/
 */
export async function fetchClinicLocations(): Promise<string[]> {
  const res = await api.get("/clinic/sessions/locations/");
  return Array.isArray(res.data) ? res.data : [];
}

/**
 * 클리닉(세션) 삭제 — 참가자·테스트 등 CASCADE 삭제됨
 * DELETE /clinic/sessions/{id}/
 */
export async function deleteClinicSession(sessionId: number): Promise<void> {
  await api.delete(`/clinic/sessions/${sessionId}/`);
}

/**
 * 클리닉 세션 수정
 * PATCH /clinic/sessions/{id}/
 */
export async function updateClinicSession(
  sessionId: number,
  payload: {
    title?: string;
    date?: string;
    start_time?: string;
    duration_minutes?: number;
    location?: string;
    max_participants?: number;
    target_grade?: number | null;
    target_school_type?: string | null;
    target_lecture_ids?: number[];
    section?: number | null;
  }
): Promise<void> {
  await api.patch(`/clinic/sessions/${sessionId}/`, payload);
}

/**
 * 특정 날짜 범위의 세션 목록 조회 (이전 주 불러오기용)
 * GET /clinic/sessions/?date_from=...&date_to=...
 */
export async function fetchClinicSessions(params: {
  date_from?: string;
  date_to?: string;
}): Promise<ClinicSessionDetail[]> {
  const res = await api.get("/clinic/sessions/", { params });
  const raw = Array.isArray(res.data)
    ? res.data
    : Array.isArray(res.data?.results)
    ? res.data.results
    : [];
  return raw;
}

export type ClinicSessionDetail = {
  id: number;
  title: string;
  date: string;
  start_time: string;
  duration_minutes: number;
  location: string;
  max_participants: number;
  target_grade: number | null;
  target_school_type: string | null;
  target_lecture_ids?: number[];
  participant_count: number;
  booked_count: number;
  section?: number | null;
  section_label?: string | null;
  section_type?: "CLASS" | "CLINIC" | null;
};
