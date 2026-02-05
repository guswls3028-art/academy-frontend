// PATH: src/student/domains/dashboard/hooks/useStudentDashboard.ts

import { useQuery } from "@tanstack/react-query";
import { fetchStudentDashboard } from "../api/dashboard";

export function useStudentDashboard() {
  return useQuery({
    queryKey: ["student-dashboard"],
    queryFn: fetchStudentDashboard,
  });
}
