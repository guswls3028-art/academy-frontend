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
  pending_count?: number;
  booked_confirmed_count?: number;
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function normalizeListPayload(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (isRecord(value) && Array.isArray(value.results)) return value.results;
  return [];
}

function toNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toOptionalNumber(value: unknown): number | undefined {
  if (value == null) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function toNullableNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toStringValue(value: unknown, fallback = ""): string {
  if (value == null) return fallback;
  return String(value);
}

function toNumberArray(value: unknown): number[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.map((item) => Number(item)).filter(Number.isFinite);
}

function toSectionType(value: unknown): "CLASS" | "CLINIC" | null {
  return value === "CLASS" || value === "CLINIC" ? value : null;
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

  return normalizeListPayload(res.data)
    .filter(isRecord)
    .map((row) => ({
      id: toNumber(row.id),
      title: row.title == null ? undefined : toStringValue(row.title),
      date: normalizeDate(toStringValue(row.date)),
      start_time: toStringValue(row.start_time),
      location: toStringValue(row.location),
      target_grade: toNullableNumber(row.target_grade),
      duration_minutes: toOptionalNumber(row.duration_minutes),
      participant_count: toNumber(row.participant_count),
      booked_count: toNumber(row.booked_count),
      pending_count: toNumber(row.pending_count),
      booked_confirmed_count: toNumber(row.booked_confirmed_count),
      no_show_count: toNumber(row.no_show_count),
      max_participants: toNullableNumber(row.max_participants),
      section: toNullableNumber(row.section),
      section_label: row.section_label == null ? null : toStringValue(row.section_label),
      section_type: toSectionType(row.section_type),
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
  ordering?: string;
}): Promise<ClinicSessionDetail[]> {
  const res = await api.get("/clinic/sessions/", { params });
  return normalizeListPayload(res.data)
    .filter(isRecord)
    .map((row) => ({
      id: toNumber(row.id),
      title: toStringValue(row.title),
      date: normalizeDate(toStringValue(row.date)),
      start_time: toStringValue(row.start_time),
      duration_minutes: toNumber(row.duration_minutes),
      location: toStringValue(row.location),
      max_participants: toNumber(row.max_participants),
      target_grade: toNullableNumber(row.target_grade),
      target_school_type: row.target_school_type == null ? null : toStringValue(row.target_school_type),
      target_lecture_ids: toNumberArray(row.target_lecture_ids),
      participant_count: toNumber(row.participant_count),
      booked_count: toNumber(row.booked_count),
      pending_count: toNumber(row.pending_count),
      booked_confirmed_count: toNumber(row.booked_confirmed_count),
      section: toNullableNumber(row.section),
      section_label: row.section_label == null ? null : toStringValue(row.section_label),
      section_type: toSectionType(row.section_type),
    }));
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
  pending_count?: number;
  booked_confirmed_count?: number;
  section?: number | null;
  section_label?: string | null;
  section_type?: "CLASS" | "CLINIC" | null;
};
