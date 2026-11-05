import api from '@/shared/api/axios';
import type { components } from '@/shared/api/generated/schema';

type ScheduleStateTransport = components['schemas']['SessionScheduleState'];
export type SessionSchedule = Omit<components['schemas']['ScheduleInput'], 'id' | 'start_time' | 'end_time'> & {
  id: number;
  start_time: string | null;
  end_time: string | null;
};
export type SessionScheduleDraft = Omit<components['schemas']['ScheduleInputRequest'], 'id'> & { id?: number };
export type SessionSchedules = Omit<ScheduleStateTransport, 'schedules'> & {
  schedules: SessionSchedule[];
};
export { sessionSchedulesKey } from '@/shared/api/queryKeys/sessionSchedules';

function normalizeState(data: ScheduleStateTransport): SessionSchedules {
  // A failed/malformed contract must never become an empty, successful configuration.
  if (!data || typeof data.version !== 'string' || !Array.isArray(data.schedules) || !Array.isArray(data.roster)
    || !Array.isArray(data.unassigned_enrollment_ids)) throw new Error('수업일 정보를 확인하지 못했습니다. 다시 불러와 주세요.');
  return { ...data, schedules: data.schedules.map(s => {
    if (typeof s.id !== 'number' || !Number.isSafeInteger(s.id) || s.id <= 0 || typeof s.label !== 'string'
      || typeof s.date !== 'string' || !Array.isArray(s.enrollment_ids)) throw new Error('저장된 수업일 정보를 확인하지 못했습니다. 다시 불러와 주세요.');
    return { ...s, id: s.id, start_time: s.start_time ?? null, end_time: s.end_time ?? null };
  }) };
}
export async function fetchSessionSchedules(sessionId: number): Promise<SessionSchedules> {
  const { data } = await api.get<ScheduleStateTransport>(`/lectures/sessions/${sessionId}/schedules/`);
  return normalizeState(data);
}
export async function saveSessionSchedules(sessionId: number, version: string, schedules: SessionScheduleDraft[]) {
  const payload: components['schemas']['SessionScheduleWriteRequest'] = { version, schedules };
  const { data } = await api.put<ScheduleStateTransport>(`/lectures/sessions/${sessionId}/schedules/`, payload);
  return normalizeState(data);
}
export async function copySessionSchedules(sessionId: number, version: string, sourceSession: number) {
  const payload: components['schemas']['SessionScheduleCopyRequest'] = { version, source_session: sourceSession };
  const { data } = await api.post<ScheduleStateTransport>(`/lectures/sessions/${sessionId}/schedules/`, payload);
  return normalizeState(data);
}
