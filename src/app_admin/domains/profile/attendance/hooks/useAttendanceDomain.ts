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
    () => (listQ.data ?? []).map((record) => {
      const durationHours = record.work_hours == null ? null : Number(record.work_hours);
      const amount = record.amount == null ? null : Number(record.amount);
      return {
        id: record.id,
        date: record.date,
        start_time: record.start_time,
        end_time: record.end_time ?? null,
        work_type: record.work_type_name,
        memo: record.memo,
        duration_hours: durationHours != null && Number.isFinite(durationHours) ? durationHours : null,
        amount: amount != null && Number.isFinite(amount) ? amount : null,
        hourly_rate: record.resolved_hourly_wage,
        break_minutes: (record.break_minutes ?? 0) + (record.meal_minutes ?? 0),
      };
    }),
    [listQ.data],
  );

  const rangeSummary = useMemo<AttendanceSummary | null>(() => {
    if (!summaryQ.isSuccess || !summaryQ.data) return null;
    return {
      total_hours: Number(summaryQ.data.work_hours ?? 0),
      total_amount: Number(summaryQ.data.work_amount ?? 0),
      approved_expense_amount: Number(summaryQ.data.expense_amount ?? 0),
      reference_business_income_tax: Number(summaryQ.data.reference_business_income_tax ?? 0),
      reference_local_income_tax: Number(summaryQ.data.reference_local_income_tax ?? 0),
      reference_deduction_total: Number(summaryQ.data.reference_deduction_total ?? 0),
      reference_net_work_amount: Number(summaryQ.data.reference_net_work_amount ?? 0),
      reference_transfer_amount: Number(summaryQ.data.reference_transfer_amount ?? 0),
    };
  }, [summaryQ.data, summaryQ.isSuccess]);

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
