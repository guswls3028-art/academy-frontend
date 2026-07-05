// PATH: src/shared/contexts/ClinicHighlightContext.tsx
// 전역 클리닉 하이라이트 컨텍스트 — SSOT
// enrollment_id 기준으로 클리닉 대상(미수강) 여부를 전역 제공.
// StudentNameWithLectureChip에서 자동 참조.

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchClinicTargets } from "@/shared/api/contracts/clinicTargets";
import { clinicQueryKeys } from "@/shared/api/queryKeys/clinic";
import { ClinicHighlightContext, type ClinicHighlightContextValue } from "./clinicHighlightContextCore";

export function ClinicHighlightProvider({ children }: { children: React.ReactNode }) {
  const { data, isLoading } = useQuery({
    queryKey: clinicQueryKeys.highlightIds,
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
