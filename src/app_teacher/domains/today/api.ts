// PATH: src/app_teacher/domains/today/api.ts
// 오늘 수업 데이터 — 기존 sessions/attendance API 래핑
import api from "@/shared/api/axios";

export interface TodaySession {
  id: number;
  lecture: number;
  section?: number | null;
  section_label?: string | null;
  order: number;
  title: string;
  date: string | null;
  lecture_title?: string;
  lecture_color?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  location?: string | null;
}

/**
 * 오늘 세션 목록 — GET /api/v1/lectures/sessions/?date=YYYY-MM-DD
 */
export async function fetchTodaySessions(date: string): Promise<TodaySession[]> {
  const res = await api.get("/lectures/sessions/", {
    params: { date, page_size: 50 },
  });
  const raw = res.data;
  return Array.isArray(raw?.results) ? raw.results : Array.isArray(raw) ? raw : [];
}
