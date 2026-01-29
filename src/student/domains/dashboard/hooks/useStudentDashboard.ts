// src/student/domains/dashboard/hooks/useStudentDashboard.ts
/**
 * ✅ useStudentDashboard
 * - Dashboard 단일 쿼리
 */

import { useQuery } from "@tanstack/react-query";
import { fetchStudentDashboard } from "@/student/domains/dashboard/api/dashboard";

export function useStudentDashboard() {
  return useQuery({
    queryKey: ["student-dashboard"],
    queryFn: fetchStudentDashboard,
  });
}
