// PATH: src/features/staff/hooks/useStaffDetail.ts
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchStaffDetail, fetchStaffSummaryByRange } from "../api/staff.detail.api";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function getMonthBoundsFrom(dateISO: string) {
  const y = Number(dateISO.slice(0, 4));
  const m = Number(dateISO.slice(5, 7));
  const from = `${y}-${String(m).padStart(2, "0")}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const to = `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { from, to };
}

export function useStaffDetail(staffId: number) {
  const baseDate = useMemo(() => todayISO(), []);
  const range = useMemo(() => getMonthBoundsFrom(baseDate), [baseDate]);

  const detailQ = useQuery({
    queryKey: ["staff", staffId],
    queryFn: () => fetchStaffDetail(staffId),
    enabled: !!staffId,
  });

  const summaryQ = useQuery({
    queryKey: ["staff-summary", staffId, range.from, range.to],
    queryFn: () => fetchStaffSummaryByRange(staffId, range.from, range.to),
    enabled: !!staffId,
  });

  return {
    range,
    staff: detailQ.data,
    summary: summaryQ.data,
    isLoading: detailQ.isLoading || summaryQ.isLoading,
    isError: detailQ.isError || summaryQ.isError,
  };
}
