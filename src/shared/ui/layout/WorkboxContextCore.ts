// PATH: src/shared/ui/layout/WorkboxContextCore.ts
import { createContext } from "react";

export type WorkboxContextValue = {
  workboxOpen: boolean;
  setWorkboxOpen: (open: boolean) => void;
  toggleWorkbox: () => void;
};

export const WorkboxContext = createContext<WorkboxContextValue | null>(null);
