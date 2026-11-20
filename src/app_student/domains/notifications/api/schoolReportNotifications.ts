import api from "@/shared/api/axios";
import { parseSchoolReportPeriod } from "@/shared/product/schoolReports/period";

export const schoolReportNotificationsKey = ["student", "school-report-requests"] as const;

export async function fetchSchoolReportNotifications(signal?: AbortSignal) {
  const { data } = await api.get<{
    count: number;
    results: Array<{ id: number; kind: string; payload: Record<string, unknown> | null; read: boolean }>;
  }>("/community/notifications/", { params: { kind: "school_report_request" }, signal });
  return data.results.flatMap((item) => {
    const period = item.kind === "school_report_request" && item.payload ? parseSchoolReportPeriod(item.payload) : null;
    return period ? [{ id: item.id, read: item.read, period }] : [];
  });
}

export async function markSchoolReportNotificationRead(id: number) {
  await api.post(`/community/notifications/${id}/read/`);
}
