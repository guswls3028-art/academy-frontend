// PATH: src/features/submissions/hooks/useAdminSubmissions.ts
import { useQuery } from "@tanstack/react-query";
import type { Submission, SubmissionStatus } from "@/features/submissions/types";
import { fetchAdminSubmissions } from "@/features/submissions/api/adminSubmissions";

export function useAdminSubmissions(params: {
  examId?: number;
  enrollmentId?: number;
  status?: SubmissionStatus;
  enabled?: boolean;
  limit?: number;
  polling?: boolean;
}) {
  const enabled = params.enabled ?? true;
  const polling = params.polling ?? true;

  return useQuery<Submission[]>({
    queryKey: ["admin-submissions", params.examId, params.enrollmentId, params.status, params.limit],
    queryFn: () =>
      fetchAdminSubmissions({
        examId: params.examId,
        enrollmentId: params.enrollmentId,
        status: params.status,
        limit: params.limit ?? 50,
      }),
    enabled: enabled,
    refetchInterval: polling ? 2000 : false,
  });
}
