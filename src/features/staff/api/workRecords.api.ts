// PATH: src/features/staff/api/workRecords.api.ts
import api from "@/shared/api/axios";

/** Backend: WorkRecordSerializer (resolved_hourly_wage, current_break_started_at not exposed) */
export type WorkRecord = {
  id: number;
  staff: number;
  staff_name: string;
  work_type: number;
  work_type_name: string;
  date: string;
  start_time: string;
  end_time: string | null;
  break_minutes: number;
  work_hours: number | null;
  amount: number | null;
  memo: string;
  created_at: string;
  updated_at: string;
};

/**
 * GET /staffs/work-records/
 */
export async function fetchWorkRecords(params: {
  staff: number;
  work_type?: number;
  date_from: string;
  date_to: string;
}) {
  const res = await api.get("/staffs/work-records/", { params });

  if (Array.isArray(res.data)) return res.data as WorkRecord[];
  if (Array.isArray(res.data?.results)) return res.data.results as WorkRecord[];
  return [];
}

/**
 * POST /staffs/work-records/
 */
export async function createWorkRecord(payload: {
  staff: number;
  work_type: number;
  date: string;
  start_time: string;
  end_time: string;
  break_minutes?: number;
  memo?: string;
}) {
  const res = await api.post("/staffs/work-records/", payload);
  return res.data as WorkRecord;
}

export async function patchWorkRecord(
  id: number,
  payload: Partial<{
    work_type: number;
    date: string;
    start_time: string;
    end_time: string;
    break_minutes: number;
    memo: string;
  }>
) {
  const res = await api.patch(`/staffs/work-records/${id}/`, payload);
  return res.data as WorkRecord;
}

export async function deleteWorkRecord(id: number) {
  await api.delete(`/staffs/work-records/${id}/`);
  return true;
}

// ========== 실시간 출근/퇴근 (직원 로그인 시 헤더용) ==========

export type WorkCurrentStatus =
  | { status: "OFF" }
  | {
      status: "WORKING" | "BREAK";
      work_record_id: number;
      date: string;
      started_at: string;
      break_minutes?: number;
      /** 휴식 누적 초 (실시간 시계 일시정지 반영). 없으면 break_minutes*60 사용 */
      break_total_seconds?: number;
      break_started_at?: string;
    };

/** GET /staffs/{id}/work-records/current/ */
export async function fetchWorkCurrent(staffId: number) {
  const res = await api.get<WorkCurrentStatus>(`/staffs/${staffId}/work-records/current/`);
  return res.data;
}

/** POST /staffs/{id}/work-records/start-work/ */
export async function startWork(staffId: number, workTypeId: number) {
  const res = await api.post<WorkRecord>(`/staffs/${staffId}/work-records/start-work/`, {
    work_type: workTypeId,
  });
  return res.data;
}

/** POST /staffs/work-records/{id}/end_work/ */
export async function endWork(workRecordId: number) {
  const res = await api.post<WorkRecord>(`/staffs/work-records/${workRecordId}/end_work/`);
  return res.data;
}

/** POST /staffs/work-records/{id}/start_break/ */
export async function startBreak(workRecordId: number) {
  const res = await api.post<{ status: string }>(
    `/staffs/work-records/${workRecordId}/start_break/`
  );
  return res.data;
}

/** POST /staffs/work-records/{id}/end_break/ */
export async function endBreak(workRecordId: number) {
  const res = await api.post<{ status: string }>(
    `/staffs/work-records/${workRecordId}/end_break/`
  );
  return res.data;
}

/** GET /staffs/currently-working/ — 현재 근무 중인 직원 목록 (헤더 중앙 아바타·드롭다운용) */
export type CurrentlyWorkingItem = {
  staff_id: number;
  staff_name: string;
  role?: "owner" | "TEACHER" | "ASSISTANT";
  /** 근무 시작일 (YYYY-MM-DD) — 드롭다운 근무시간 계산용 */
  date?: string;
  /** 근무 시작 시각 (HH:MM:SS) */
  started_at?: string;
  /** 휴식 누적 분 */
  break_minutes?: number;
  /** 휴식 누적 초 (실시간 시계용). 없으면 break_minutes*60 사용 */
  break_total_seconds?: number;
  /** 휴식 시작 시각 (ISO) — 휴식 중이면 경과 시간 정지 */
  break_started_at?: string;
};

export async function fetchCurrentlyWorkingStaff(): Promise<CurrentlyWorkingItem[]> {
  try {
    const res = await api.get<CurrentlyWorkingItem[]>("/staffs/currently-working/");
    return Array.isArray(res.data) ? res.data : [];
  } catch (err: unknown) {
    const status = (err as { response?: { status?: number } })?.response?.status;
    if (status === 404) {
      return [];
    }
    throw err;
  }
}
