export type EssayNumbering = "continuous" | "separate";

/** Canonical question numbers remain the keys for answers and grading. */
export function examQuestionLabel(
  number: number,
  numbering: EssayNumbering = "continuous",
  essayIndex?: number | null,
): string {
  return numbering === "separate" && essayIndex != null
    ? `서술형 ${essayIndex}번`
    : `${number}번`;
}

export function essayIndexFromBoundary(
  number: number,
  gradingMode: "choice" | "written" | "mixed" | undefined,
  choiceCount: number | undefined,
): number | null {
  if (gradingMode === "written") return number;
  if (gradingMode === "mixed" && choiceCount != null && number > choiceCount) {
    return number - choiceCount;
  }
  return null;
}
