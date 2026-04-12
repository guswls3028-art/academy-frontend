import { useQuery, useMutation } from "@tanstack/react-query";
import {
  fetchExamEnrollmentRows,
  updateExamEnrollmentRows,
} from "../api/examEnrollments";

export function useExamEnrollmentRows(
  examId?: number,
  sessionId?: number
) {
  return useQuery({
    queryKey: ["exam-enrollment", examId, sessionId],
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
