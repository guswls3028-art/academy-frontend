// PATH: src/shared/contexts/useClinicHighlight.ts
// enrollment_id로 클리닉 하이라이트 여부를 조회. Provider 바깥에서는 항상 false.

import { useContext } from "react";
import { ClinicHighlightContext } from "./clinicHighlightContextCore";

export function useClinicHighlight(enrollmentId?: number | null): boolean {
  const { highlightIds } = useContext(ClinicHighlightContext);
  if (!enrollmentId) return false;
  return highlightIds.has(enrollmentId);
}
