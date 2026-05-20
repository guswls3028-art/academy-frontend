import { createContext, useContext } from "react";
import type { useWorkMonthLock } from "../../hooks/useWorkMonthLock";

export type WorkMonthContextValue = {
  staffId: number;
  year: number;
  month: number;
  range: { from: string; to: string };
  locked: boolean;
  canManage: boolean;
  lockM: ReturnType<typeof useWorkMonthLock>["lockM"];
};

export const WorkMonthContext = createContext<WorkMonthContextValue | null>(null);

export function useWorkMonth() {
  const value = useContext(WorkMonthContext);
  if (!value) throw new Error("useWorkMonth must be used within WorkMonthProvider");
  return value;
}
