import api from "@/shared/api/axios";
import type { components } from "@/shared/api/generated/schema";
export { fetchStaffMe } from "@/shared/staff/api";
export type { AssignedWorkType, StaffMe } from "@/shared/staff/api";

export type WorkRecord = components["schemas"]["StaffWorkRecord"];

type WorkCurrentContract = components["schemas"]["StaffWorkCurrentStatus"];
export type WorkCurrentStatus =
  | (WorkCurrentContract & { status: "OFF" })
  | (WorkCurrentContract & {
      status: "WORKING" | "BREAK";
      work_record_id: number;
      date: string;
      started_at: string;
      work_type: number;
      work_type_name: string;
      hourly_wage: number | null;
      break_minutes?: number;
      break_total_seconds?: number;
      break_started_at?: string;
    });

export type WorkSummary = components["schemas"]["StaffWorkSummary"];
type WorkStartRequest = components["schemas"]["StaffWorkStartRequestRequest"];
type PaginatedWorkRecords = components["schemas"]["PaginatedStaffWorkRecordList"];

export async function fetchWorkCurrent(staffId: number): Promise<WorkCurrentStatus> {
  const { data } = await api.get<WorkCurrentStatus>(
    `/staffs/${staffId}/work-records/current/`,
  );
  return data;
}

export async function startWork(
  staffId: number,
  workTypeId: number,
): Promise<WorkRecord> {
  const payload: WorkStartRequest = { work_type: workTypeId };
  const { data } = await api.post<WorkRecord>(
    `/staffs/${staffId}/work-records/start-work/`,
    payload,
  );
  return data;
}

export async function endWork(workRecordId: number): Promise<WorkRecord> {
  const { data } = await api.post<WorkRecord>(
    `/staffs/work-records/${workRecordId}/end_work/`,
  );
  return data;
}

export async function startBreak(workRecordId: number): Promise<void> {
  await api.post(`/staffs/work-records/${workRecordId}/start_break/`);
}

export async function endBreak(workRecordId: number): Promise<void> {
  await api.post(`/staffs/work-records/${workRecordId}/end_break/`);
}

export type CurrentlyWorkingItem = {
  staff_id: number;
  staff_name: string;
  role?: "owner" | "OWNER" | "TEACHER" | "ASSISTANT";
  date?: string;
  started_at?: string;
  work_type?: number;
  work_type_name?: string;
  break_minutes?: number;
  break_total_seconds?: number;
  break_started_at?: string;
};

export async function fetchCurrentlyWorkingStaff(): Promise<CurrentlyWorkingItem[]> {
  const { data } = await api.get<CurrentlyWorkingItem[]>(
    "/staffs/currently-working/",
  );
  return Array.isArray(data) ? data : [];
}

export async function fetchMyWorkRecords(
  staffId: number,
  dateFrom: string,
  dateTo: string,
): Promise<WorkRecord[]> {
  const { data } = await api.get<PaginatedWorkRecords | WorkRecord[]>(
    `/staffs/${staffId}/work-records/`, {
    params: { date_from: dateFrom, date_to: dateTo, page_size: 500 },
    },
  );
  if (Array.isArray(data)) return data as WorkRecord[];
  if (Array.isArray(data.results)) return data.results;
  return [];
}

export async function fetchMyWorkSummary(
  staffId: number,
  dateFrom: string,
  dateTo: string,
): Promise<WorkSummary> {
  const { data } = await api.get<WorkSummary>(`/staffs/${staffId}/summary/`, {
    params: { date_from: dateFrom, date_to: dateTo },
  });
  return data;
}
