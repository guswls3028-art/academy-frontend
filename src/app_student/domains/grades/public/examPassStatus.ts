import type { MyExamGradeSummary } from "../api/grades.api";

/** Shared student exam judgment for grade statistics and dashboard summaries. */
export function getExamPassStatus(exam: MyExamGradeSummary, wrongCompletionOnly: boolean): boolean | null {
  if (exam.achievement === "NOT_SUBMITTED" || exam.meta_status === "NOT_SUBMITTED") return null;
  if (wrongCompletionOnly) {
    if (exam.correction_status === "PENDING") return false;
    if (exam.correction_status === "COMPLETED" || exam.correction_status === "NOT_REQUIRED") return true;
    return null;
  }
  if (exam.achievement === "PASS" || exam.achievement === "REMEDIATED") return true;
  if (exam.achievement === "FAIL") return false;
  return exam.is_pass ?? null;
}
