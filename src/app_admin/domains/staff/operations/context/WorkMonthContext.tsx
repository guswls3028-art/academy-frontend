import React, { useMemo } from "react";
import { useWorkMonthLock } from "../../hooks/useWorkMonthLock";
import { useQuery } from "@tanstack/react-query";
import { fetchStaffMe } from "../../api/staffMe.api";
import { WorkMonthContext, type WorkMonthContextValue } from "./workMonthHooks";
import { staffQueryKeys } from "../../queryKeys";

function monthRange(year: number, month: number) {
  const from = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const to = `${year}-${String(month).padStart(2, "0")}-${String(
    lastDay
  ).padStart(2, "0")}`;
  return { from, to };
}

export function WorkMonthProvider({
  staffId,
  year,
  month,
  children,
}: React.PropsWithChildren<{ staffId: number; year: number; month: number }>) {
  const { locked, lockM } = useWorkMonthLock({ staff: staffId, year, month });

  const meQ = useQuery({
    queryKey: staffQueryKeys.me,
    queryFn: fetchStaffMe,
  });

  const canManage = !!meQ.data?.is_payroll_manager;

  const range = useMemo(() => monthRange(year, month), [year, month]);

  const value = useMemo<WorkMonthContextValue>(
    () => ({
      staffId,
      year,
      month,
      range,
      locked,
      canManage,
      lockM,
    }),
    [staffId, year, month, range, locked, canManage, lockM]
  );

  return <WorkMonthContext.Provider value={value}>{children}</WorkMonthContext.Provider>;
}
