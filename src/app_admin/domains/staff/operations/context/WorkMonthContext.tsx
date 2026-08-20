import React, { useMemo } from "react";
import { useWorkMonthLock } from "../../hooks/useWorkMonthLock";
import { useQuery } from "@tanstack/react-query";
import { fetchStaffMe } from "@/shared/staff/api";
import { WorkMonthContext, type WorkMonthContextValue } from "./workMonthHooks";
import { staffQueryKeys } from "../../queryKeys";
import { useStaffs } from "../../hooks/useStaffs";

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
  const {
    locksQ,
    locked,
    lockCheckPending,
    lockCheckFailed,
    lockM,
  } = useWorkMonthLock({ staff: staffId, year, month });

  const meQ = useQuery({
    queryKey: staffQueryKeys.me,
    queryFn: fetchStaffMe,
  });

  const canManage = !!meQ.data?.is_payroll_manager;
  const staffsQ = useStaffs();
  const payType = staffsQ.data?.staffs.find(
    (staff) => staff.id === staffId,
  )?.pay_type;
  const dependencyPending = lockCheckPending || meQ.isLoading || staffsQ.isLoading;
  const dependencyFailed = lockCheckFailed || meQ.isError || staffsQ.isError;

  const range = useMemo(() => monthRange(year, month), [year, month]);

  const value = useMemo<WorkMonthContextValue>(
    () => ({
      staffId,
      year,
      month,
      range,
      locked,
      lockCheckPending: dependencyPending,
      lockCheckFailed: dependencyFailed,
      writeBlocked: locked || dependencyPending || dependencyFailed,
      retryLockCheck: () => {
        void locksQ.refetch();
        void meQ.refetch();
        void staffsQ.refetch();
      },
      canManage,
      payType,
      lockM,
    }),
    [
      staffId,
      year,
      month,
      range,
      locked,
      dependencyPending,
      dependencyFailed,
      locksQ,
      meQ,
      staffsQ,
      canManage,
      payType,
      lockM,
    ]
  );

  return <WorkMonthContext.Provider value={value}>{children}</WorkMonthContext.Provider>;
}
