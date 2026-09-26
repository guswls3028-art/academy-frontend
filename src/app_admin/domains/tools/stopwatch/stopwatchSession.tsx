import { createContext, useMemo, type ReactNode } from "react";

export type TimerPhase = "setup" | "ready" | "running" | "paused" | "finished";
export type TimerFontKey = "mono" | "classic" | "modern" | "round";

interface TimerSnapshot {
  phase: TimerPhase;
  remaining: number;
  endTime: number;
  totalSet: number;
  fontKey: TimerFontKey;
  inputMin: string;
  inputSec: string;
}

interface StopwatchSession {
  timer: TimerSnapshot | null;
  mode: "timer" | "stopwatch";
  projector: boolean;
}

export const StopwatchSessionContext = createContext<{ current: StopwatchSession } | null>(null);

export function StopwatchSessionProvider({ pathname, children }: { pathname: string; children: ReactNode }) {
  const session = useMemo<{ current: StopwatchSession }>(
    () => ({ current: { timer: null, mode: "timer", projector: false } }),
    [pathname],
  );
  return <StopwatchSessionContext.Provider value={session}>{children}</StopwatchSessionContext.Provider>;
}
