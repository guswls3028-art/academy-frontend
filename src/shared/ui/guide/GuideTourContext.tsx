import { useState, useCallback, type ReactNode } from "react";
import { GuideTourCtx, type TourConfig } from "./GuideTourContextCore";

export function GuideTourProvider({ children }: { children: ReactNode }) {
  const [activeTour, setActiveTour] = useState<TourConfig | null>(null);
  const startTour = useCallback((c: TourConfig) => setActiveTour(c), []);
  const closeTour = useCallback(() => setActiveTour(null), []);

  return (
    <GuideTourCtx.Provider value={{ startTour, activeTour, closeTour }}>
      {children}
    </GuideTourCtx.Provider>
  );
}
