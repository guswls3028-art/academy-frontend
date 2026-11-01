/** Public OMR reads and result-cache refresh after a submission assignment. */
import type { QueryClient } from "@tanstack/react-query";
import { adminResultsQueryKeys } from "../queryKeys";

export { listOmrReviewRows, listOmrReviewIssuesPage } from "../components/omr-review/omrReviewApi";

export function invalidateSubmissionResultCaches(
  queryClient: QueryClient,
  target: { submissionId: number; examId?: number },
): void {
  queryClient.invalidateQueries({ queryKey: adminResultsQueryKeys.sessionScores });
  queryClient.invalidateQueries({ queryKey: adminResultsQueryKeys.clinicTargets });
  if (target.examId != null) {
    queryClient.invalidateQueries({ queryKey: adminResultsQueryKeys.adminExamResults(target.examId).slice(0, 2) });
    queryClient.invalidateQueries({ queryKey: adminResultsQueryKeys.adminExamDetail(target.examId) });
    queryClient.invalidateQueries({ queryKey: adminResultsQueryKeys.adminExamSummary(target.examId) });
    queryClient.invalidateQueries({ queryKey: adminResultsQueryKeys.examQuestionStats(target.examId) });
    queryClient.invalidateQueries({ queryKey: adminResultsQueryKeys.omrReviewList(target.examId) });
    queryClient.invalidateQueries({ queryKey: adminResultsQueryKeys.omrReviewIssues(target.examId) });
    queryClient.invalidateQueries({ queryKey: adminResultsQueryKeys.omrReviewDetail(target.submissionId) });
  }
}
