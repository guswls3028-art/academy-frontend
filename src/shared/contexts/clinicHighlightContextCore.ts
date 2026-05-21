import { createContext } from "react";

export type ClinicHighlightContextValue = {
  /** 클리닉 대상(미수강) enrollment_id 집합 */
  highlightIds: Set<number>;
  isLoading: boolean;
};

export const ClinicHighlightContext = createContext<ClinicHighlightContextValue>({
  highlightIds: new Set(),
  isLoading: false,
});
