import { useEffect, useState } from "react";
import dayjs from "dayjs";

/** Refresh date discovery and ongoing-session labels while a clinic page stays open. */
export function useClinicClock() {
  const [now, setNow] = useState(() => dayjs());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(dayjs()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}
