import { useProgram } from "@/shared/program";

export type AssessmentCorrectionStatus = "PENDING" | "COMPLETED" | "NOT_REQUIRED" | null | undefined;

const WRONG_COMPLETION_DISPLAY = "wrong_completion";

export function useWrongCompletionDisplay(): boolean {
  const { program } = useProgram();
  return program?.feature_flags?.assessment_status_display === WRONG_COMPLETION_DISPLAY;
}

export function wrongCompletionLabel(status: AssessmentCorrectionStatus): "오답 완료" | "오답 미완료" | null {
  if (status === "PENDING") return "오답 미완료";
  if (status === "COMPLETED" || status === "NOT_REQUIRED") return "오답 완료";
  return null;
}
