import { useEffect, useState } from "react";

/** Academy dates use the same Korea timezone as the server. */
export function learningDate(now: number): string {
  return new Date(now + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** Re-evaluate schedules while visible, including after a backgrounded tab returns. */
export function useLearningClock(): number {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") setNow(Date.now());
    };
    const interval = setInterval(tick, 30_000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", tick);
    };
  }, []);
  return now;
}
