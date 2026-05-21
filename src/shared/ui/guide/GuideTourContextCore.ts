// PATH: src/shared/ui/guide/GuideTourContextCore.ts
import { createContext } from "react";
import type { TourStep } from "./types";

export type TourConfig = { steps: TourStep[] };

export type GuideTourContextValue = {
  startTour: (config: TourConfig) => void;
  activeTour: TourConfig | null;
  closeTour: () => void;
};

export const GuideTourCtx = createContext<GuideTourContextValue>({
  startTour: () => {},
  activeTour: null,
  closeTour: () => {},
});
