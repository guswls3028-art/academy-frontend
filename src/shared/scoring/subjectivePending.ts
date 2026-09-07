import type { ScoreBlock } from "@/shared/api/contracts/sessionScores";

export function isSubjectivePendingScoreBlock(
  block: Pick<ScoreBlock, "grading_status"> | null | undefined,
): boolean {
  return block?.grading_status === "subjective_pending";
}
