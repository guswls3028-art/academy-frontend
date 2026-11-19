import type { OmrUploadBatchSummary } from "@/shared/api/contracts/submissions";

/** Processing terminal is not proof that a teacher may publish the score. */
export function omrGradingAttentionCount(batch?: OmrUploadBatchSummary): number {
  if (!batch?.terminal || batch.counts.completed <= 0) return 0;
  const counts = batch.grading_counts;
  const pending = (counts?.manual_review_required ?? 0) + (counts?.grading_pending ?? 0);
  if (pending > 0) return pending;
  if (batch.grading_complete === false && batch.grading_status !== "subjective_pending") {
    return Math.max(0, batch.counts.completed - (counts?.completed ?? 0) - (counts?.subjective_pending ?? 0));
  }
  // Older responses omit grading fields; do not reinterpret their completed tasks.
  return 0;
}
