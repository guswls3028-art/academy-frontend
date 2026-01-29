// PATH: src/features/clinic/hooks/useClinicStudentSearch.ts
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { searchClinicStudents } from "../api/clinicStudents.api";

/**
 * 대기업 실무 기준:
 * - 입력 즉시 쿼리 X (디바운스)
 * - 최소 2글자부터
 * - 네트워크 흔들려도 UX 안정
 */
export function useClinicStudentSearch(raw: string) {
  const [q, setQ] = useState(raw);

  useEffect(() => {
    const t = setTimeout(() => setQ(raw.trim()), 250);
    return () => clearTimeout(t);
  }, [raw]);

  const enabled = useMemo(() => q.length >= 2, [q]);

  return useQuery({
    queryKey: ["clinic-student-search", q],
    queryFn: () => searchClinicStudents({ q }),
    enabled,
    staleTime: 10_000,
    retry: 0,
  });
}
