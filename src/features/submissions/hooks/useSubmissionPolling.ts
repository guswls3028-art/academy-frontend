// ====================================================================================================
// FILE: src/features/submissions/hooks/useSubmissionPolling.ts
// ====================================================================================================
import { useQuery } from "@tanstack/react-query";
import { fetchSubmission } from "../api";
import { Submission } from "../types";

const TERMINAL_STATUS = ["done", "failed", "graded"] as const;

export function useSubmissionPolling(submissionId?: number, enabled: boolean = true) {
  return useQuery<Submission>({
    queryKey: ["submission", submissionId],
    queryFn: () => fetchSubmission(submissionId!),
    enabled: enabled && Number.isFinite(submissionId),
    refetchInterval: (data) => {
      if (!data) return 2000;
      return (TERMINAL_STATUS as readonly string[]).includes(data.status) ? false : 2000;
    },
  });
}
