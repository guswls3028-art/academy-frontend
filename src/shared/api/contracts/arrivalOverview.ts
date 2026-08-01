import api from "@/shared/api/axios";

export type ArrivalSource = "supplement" | "clinic";

export type ArrivalOverviewItem = {
  key: string;
  source: ArrivalSource;
  attendance_id: number | null;
  clinic_participant_id: number | null;
  clinic_session_id: number | null;
  student_id: number;
  student_name: string;
  lecture_id: number | null;
  lecture_title: string;
  lecture_color: string;
  session_id: number | null;
  session_title: string;
  date: string | null;
  time: string | null;
  location: string;
  memo: string;
  status: string;
  is_resolved: boolean;
  is_overdue: boolean;
};

export type ArrivalOverview = {
  generated_at: string;
  today: string;
  tomorrow: string;
  soon_window_minutes: number;
  summary: {
    soon: number;
    today: number;
    tomorrow: number;
    time_unset: number;
    overdue: number;
  };
  items: ArrivalOverviewItem[];
};

export const arrivalOverviewQueryKey = ["operations", "arrival-overview"] as const;

export async function fetchArrivalOverview(): Promise<ArrivalOverview> {
  const response = await api.get<ArrivalOverview>("/lectures/attendance/arrival-overview/");
  return response.data;
}
