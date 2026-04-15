import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import type { TourStep } from "./types";

type TourConfig = { steps: TourStep[] };

type Ctx = {
  startTour: (config: TourConfig) => void;
  activeTour: TourConfig | null;
  closeTour: () => void;
};

const GuideTourCtx = createContext<Ctx>({
  startTour: () => {},
  activeTour: null,
  closeTour: () => {},
});

export const useGuideTour = () => useContext(GuideTourCtx);

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
