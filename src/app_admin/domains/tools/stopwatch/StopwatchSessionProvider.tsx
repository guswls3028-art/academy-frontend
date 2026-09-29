import { useMemo, type ReactNode } from "react";
import { StopwatchSessionContext, type StopwatchSession } from "./stopwatchSession";

export default function StopwatchSessionProvider({ pathname, children }: { pathname: string; children: ReactNode }) {
  const session = useMemo<{ pathname: string; current: StopwatchSession }>(
    () => ({ pathname, current: { timer: null, stopwatch: null, mode: "timer", projector: false } }),
    [pathname],
  );
  return <StopwatchSessionContext.Provider value={session}>{children}</StopwatchSessionContext.Provider>;
}
