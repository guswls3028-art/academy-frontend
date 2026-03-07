// PATH: src/features/clinic/api/clinicSessions.api.ts
import api from "@/shared/api/axios";
import dayjs from "dayjs";

export type ClinicSessionTreeNode = {
  id: number;
  date: string; // YYYY-MM-DD
  start_time: string; // "HH:MM:SS" or "HH:MM"
  location: string;

  participant_count: number;
  booked_count: number;
  no_show_count: number;
  /** 정원. 있으면 날짜 상태 dot(🟢🟡🔴) 계산에 사용 */
  max_participants?: number | null;
};

function normalizeDate(s: string): string {
  const d = dayjs(s);
  return d.isValid() ? d.format("YYYY-MM-DD") : s;
}

/**
 * 운영 좌측 트리 전용
 * GET /clinic/sessions/tree/?year=YYYY&month=MM
 * 응답 date를 YYYY-MM-DD로 정규화해 색상/필터 정합성 보장
 */
export async function fetchClinicSessionTree(params: {
  year: number;
  month: number; // 1~12
}) {
  const res = await api.get("/clinic/sessions/tree/", { params });

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
