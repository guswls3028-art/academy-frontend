import { useQuery } from '@tanstack/react-query';
import { fetchSessionSchedules, sessionSchedulesKey } from '@/shared/api/contracts/sessionSchedules';

/** Explicit mobile scope. A missing/stale scope is an error, never an unfiltered roster. */
export function useSessionScheduleRoster(sessionId: number, schedule: string | undefined) {
  return useQuery({
    queryKey: [...sessionSchedulesKey(sessionId), 'roster', schedule],
    enabled: Number.isSafeInteger(sessionId) && sessionId > 0 && schedule !== undefined,
    retry: false,
    queryFn: async () => {
      const data = await fetchSessionSchedules(sessionId);
      if (schedule === '0') return { ids: data.unassigned_enrollment_ids, label: '수업일 미배정' };
      const selected = data.schedules.find(s => String(s.id) === schedule);
      if (!selected) throw new Error('선택한 수업일을 찾을 수 없습니다. 수업 목록에서 다시 선택해 주세요.');
      return { ids: selected.enrollment_ids, label: `${selected.date} · ${selected.label}` };
    },
  });
}
