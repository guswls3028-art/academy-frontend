// PATH: src/shared/ui/guide/useGuideTour.ts
import { useContext } from "react";
import { GuideTourCtx } from "./GuideTourContextCore";

export function useGuideTour() {
  return useContext(GuideTourCtx);
}
