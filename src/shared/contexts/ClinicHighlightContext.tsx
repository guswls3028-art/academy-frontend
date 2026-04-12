// PATH: src/shared/contexts/ClinicHighlightContext.tsx
// 전역 클리닉 하이라이트 컨텍스트 — SSOT
// enrollment_id 기준으로 클리닉 대상(미수강) 여부를 전역 제공.
// StudentNameWithLectureChip에서 자동 참조.

import { createContext, useContext, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchClinicTargets } from "@admin/domains/clinic/api/clinicTargets";

type ClinicHighlightContextValue = {
  /** 클리닉 대상(미수강) enrollment_id 집합 */
  highlightIds: Set<number>;
  isLoading: boolean;
};

const ClinicHighlightContext = createContext<ClinicHighlightContextValue>({
  highlightIds: new Set(),
  isLoading: false,
});

export function ClinicHighlightProvider({ children }: { children: React.ReactNode }) {
  const { data, isLoading } = useQuery({
    queryKey: ["clinic-highlight-ids"],
    queryFn: () => fetchClinicTargets(),
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });

  const value = useMemo<ClinicHighlightContextValue>(() => {
    const ids = new Set<number>();
    if (data) {
      for (const t of data) {
        if (t.name_highlight_clinic_target) {
          ids.add(t.enrollment_id);
        }
      }
    }
    return { highlightIds: ids, isLoading };
  }, [data, isLoading]);

  return (
    <ClinicHighlightContext.Provider value={value}>
      {children}
    </ClinicHighlightContext.Provider>
  );
}

/**
 * enrollment_id로 클리닉 하이라이트 여부를 조회.
 * Provider 바깥에서 호출하면 항상 false.
 */
export function useClinicHighlight(enrollmentId?: number | null): boolean {
  const { highlightIds } = useContext(ClinicHighlightContext);
  if (!enrollmentId) return false;
  return highlightIds.has(enrollmentId);
}
