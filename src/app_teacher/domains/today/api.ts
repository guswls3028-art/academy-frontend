// PATH: src/app_teacher/domains/today/api.ts
// 오늘 수업 데이터 — 기존 sessions/attendance API 래핑
import api from "@/shared/api/axios";
import type { SessionScheduleDate } from '@/shared/product/sessions/sessionScheduleDisplay';

export interface TodaySession {
  id: number;
  lecture: number;
  section?: number | null;
  section_label?: string | null;
  order: number;
  title: string;
  date: string | null;
  schedule_dates?: SessionScheduleDate[];
  lecture_title?: string;
  lecture_color?: string | null;
  lecture_chip_label?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  location?: string | null;
  // 진척률 (?include_progress=1)
  attendance_filled?: number | null;
  attendance_total?: number | null;
}

/** Resolve each actual class date before choosing a Today shortcut. */
export function todaySessionEntries(sessions: TodaySession[], date: string) {
  return sessions.flatMap(session => {
    const route = `/workspace/mobile/classes/${session.lecture}/sessions/${session.id}`;
    const title = session.lecture_title || session.title;
    if (!session.schedule_dates?.length) {
      return [{ startTime: session.start_time ?? null, label: title, route }];
    }
    return session.schedule_dates.filter(schedule => schedule.date === date).map(schedule => ({
      startTime: schedule.start_time ?? null,
      label: `${title} · ${schedule.label}`,
      route: `${route}?schedule=${schedule.id}`,
    }));
  });
}

/**
 * 오늘 세션 목록 — GET /api/v1/lectures/sessions/?date=YYYY-MM-DD&include_progress=1
 *
 * include_progress=1: 출결 입력 진척(attendance_filled / attendance_total) 포함.
 * 모바일 "오늘" 카드에서만 사용 — 다른 리스트 페이지 응답은 변경 없음.
 */
export async function fetchTodaySessions(date: string): Promise<TodaySession[]> {
  const res = await api.get("/lectures/sessions/", {
    params: { date, page_size: 50, include_progress: 1 },
  });
  const raw = res.data;
  return Array.isArray(raw?.results) ? raw.results : Array.isArray(raw) ? raw : [];
}
