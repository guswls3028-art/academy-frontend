import { useQuery, useMutation } from "@tanstack/react-query";
import {
  fetchExamEnrollmentRows,
  updateExamEnrollmentRows,
} from "../api/examEnrollments";
import { adminExamsQueryKeys } from "../queryKeys";

export function useExamEnrollmentRows(
  examId?: number,
  sessionId?: number
) {
  return useQuery({
    queryKey: adminExamsQueryKeys.examEnrollment(examId, sessionId),
    queryFn: () =>
      fetchExamEnrollmentRows({
        examId: examId!,
        sessionId: sessionId!,
      }),
    enabled:
      Number.isFinite(examId) &&
      Number.isFinite(sessionId),
  });
}

export function useUpdateExamEnrollmentRows(
  examId: number,
  sessionId: number
) {
  return useMutation({
    mutationFn: (payload: { enrollment_ids: number[] }) =>
      updateExamEnrollmentRows({
        examId,
        sessionId,
        enrollment_ids: payload.enrollment_ids,
      }),
  });
}
