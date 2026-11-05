import type { components } from '@/shared/api/generated/schema';

export type SessionScheduleDate = components['schemas']['SessionScheduleSummary'];

export function sessionScheduleDateLabel(session: { date?: string | null; schedule_dates?: SessionScheduleDate[] }, schedule?: string, date?: string | null) {
  if (schedule === '0') return '수업일 미배정';
  const dates = session.schedule_dates ?? [];
  if (schedule !== undefined) {
    const selected = dates.find(s => String(s.id) === schedule);
    return selected ? `${selected.date} · ${selected.label}` : '선택한 수업일을 찾을 수 없습니다';
  }
  if (dates.length) return (date ? dates.filter(s => s.date === date) : dates).map(s => `${s.date} · ${s.label}`).join(' / ') || '수업일 확인 필요';
  return session.date || '날짜 미정';
}
