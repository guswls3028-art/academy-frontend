import type { MyExamGradeSummary } from "../api/grades.api";
import { deriveFinalPass } from "@/shared/scoring/achievement";

/** Shared student exam judgment for grade statistics and dashboard summaries. */
export function getExamPassStatus(exam: MyExamGradeSummary, wrongCompletionOnly: boolean): boolean | null {
  if (wrongCompletionOnly) {
    if (exam.achievement === "NOT_SUBMITTED" || exam.meta_status === "NOT_SUBMITTED") return null;
    if (exam.correction_status === "PENDING") return false;
    if (exam.correction_status === "COMPLETED" || exam.correction_status === "NOT_REQUIRED") return true;
    return null;
  }
  return deriveFinalPass(exam);
}
