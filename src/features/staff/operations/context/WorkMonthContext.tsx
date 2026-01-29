import React, { createContext, useContext, useMemo } from "react";
import { useWorkMonthLock } from "../../hooks/useWorkMonthLock";
import { useQuery } from "@tanstack/react-query";
import { fetchStaffMe } from "../../api/staffMe.api";

type WorkMonthContextValue = {
  staffId: number;
  year: number;
  month: number;
  range: { from: string; to: string };
  locked: boolean;
  canManage: boolean;
  lockM: ReturnType<typeof useWorkMonthLock>["lockM"];
};

const Ctx = createContext<WorkMonthContextValue | null>(null);

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
    queryKey: ["staff-me"],
    queryFn: fetchStaffMe,
  });

  const canManage = !!meQ.data?.is_payroll_manager;

  const range = useMemo(() => monthRange(year, month), [year, month]);

  const value = useMemo(
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

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWorkMonth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useWorkMonth must be used within WorkMonthProvider");
  return v;
}
