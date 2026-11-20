// src/app_student/domains/exams/hooks/useMyExamResult.ts
/**
 * ✅ useMyExamResult (LOCK v1)
 */

import useAuth from "@/auth/hooks/useAuth";
import { getParentStudentId } from "@/shared/api/parentStudentSelection";
import { resolveTenantCodeString } from "@/shared/tenant";
import { useQuery } from "@tanstack/react-query";
import { fetchMyExamResult } from "@student/domains/exams/api/results";
import { studentExamQueryKeys } from "../queryKeys";

export function useMyExamResult(examId?: number) {
  const safeId = Number(examId);
  const { user } = useAuth();
  const dawonParent = resolveTenantCodeString() === "dawon" && user?.tenantRole === "parent";
  const childId = dawonParent ? getParentStudentId() : null;

  return useQuery({
    queryKey: dawonParent ? studentExamQueryKeys.parentResult(user.id, childId, safeId) :
      studentExamQueryKeys.result(safeId),
    queryFn: () => fetchMyExamResult(safeId, !dawonParent),
    enabled: Number.isFinite(safeId) && (!dawonParent || childId !== null),
  });
}
