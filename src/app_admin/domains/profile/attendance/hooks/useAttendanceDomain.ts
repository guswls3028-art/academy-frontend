import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  fetchMyWorkRecords,
  fetchMyWorkSummary,
  fetchStaffMe,
} from "@/features/staff-clock/api";
import { staffClockQueryKeys } from "@/features/staff-clock/queryKeys";
import type { Attendance, AttendanceSummary } from "../../api/profile.api";

export function useAttendanceDomain(
  _month: string,
  range: { from: string; to: string },
) {
  const staffMeQ = useQuery({
    queryKey: staffClockQueryKeys.me,
    queryFn: fetchStaffMe,
    staleTime: 30_000,
  });
  const staffId = staffMeQ.data?.staff_id;
  const listQ = useQuery({
    queryKey: staffId != null
      ? staffClockQueryKeys.personalRecords(staffId, range.from, range.to)
      : ["my-work-records", "unavailable", range.from, range.to],
    queryFn: () => fetchMyWorkRecords(staffId!, range.from, range.to),
    enabled: staffId != null && Boolean(range.from && range.to),
  });
  const summaryQ = useQuery({
    queryKey: staffId != null
      ? staffClockQueryKeys.personalSummary(staffId, range.from, range.to)
      : ["my-work-summary", "unavailable", range.from, range.to],
    queryFn: () => fetchMyWorkSummary(staffId!, range.from, range.to),
    enabled: staffId != null && Boolean(range.from && range.to),
  });

  const rows = useMemo<Attendance[]>(
    () => (listQ.data ?? []).map((record) => ({
      id: record.id,
      date: record.date,
      start_time: record.start_time,
      end_time: record.end_time ?? null,
      work_type: record.work_type_name,
      memo: record.memo,
      duration_hours: Number(record.work_hours ?? 0),
      amount: Number(record.amount ?? 0),
      hourly_rate: record.resolved_hourly_wage,
      break_minutes: record.break_minutes,
    })),
    [listQ.data],
  );

  const rangeSummary = useMemo<AttendanceSummary>(
    () => ({
      total_hours: Number(summaryQ.data?.work_hours ?? 0),
      total_amount: Number(summaryQ.data?.work_amount ?? 0),
    }),
    [summaryQ.data],
  );

  return {
    rows,
    allRows: rows,
    rangeSummary,
    isLoading: staffMeQ.isLoading || listQ.isLoading || summaryQ.isLoading,
    isError: staffMeQ.isError || listQ.isError || summaryQ.isError,
    refetch: () => Promise.all([
      staffMeQ.refetch(),
      listQ.refetch(),
      summaryQ.refetch(),
    ]),
    hasStaffProfile: staffId != null,
  };
}
