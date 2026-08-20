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
  range_end: string;
  range_days: number;
  soon_window_minutes: number;
  summary: {
    soon: number;
    today: number;
    tomorrow: number;
    upcoming: number;
    time_unset: number;
    overdue: number;
  };
  items: ArrivalOverviewItem[];
};

export const arrivalOverviewQueryKey = ["operations", "arrival-overview"] as const;

function isArrivalOverview(value: unknown): value is ArrivalOverview {
  if (value == null || typeof value !== "object") return false;
  const candidate = value as Partial<ArrivalOverview>;
  const summary = candidate.summary;
  return (
    typeof candidate.generated_at === "string"
    && typeof candidate.today === "string"
    && typeof candidate.tomorrow === "string"
    && typeof candidate.range_end === "string"
    && typeof candidate.range_days === "number"
    && Number.isFinite(candidate.range_days)
    && typeof candidate.soon_window_minutes === "number"
    && Number.isFinite(candidate.soon_window_minutes)
    && summary != null
    && typeof summary === "object"
    && [summary.soon, summary.today, summary.tomorrow, summary.upcoming, summary.time_unset, summary.overdue]
      .every((count) => typeof count === "number" && Number.isFinite(count))
    && Array.isArray(candidate.items)
  );
}

export async function fetchArrivalOverview(): Promise<ArrivalOverview> {
  const response = await api.get<unknown>("/lectures/attendance/arrival-overview/");
  if (!isArrivalOverview(response.data)) {
    throw new Error("Invalid arrival overview response");
  }
  return response.data;
}
