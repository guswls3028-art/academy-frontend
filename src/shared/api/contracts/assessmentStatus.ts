// PATH: src/shared/api/contracts/assessmentStatus.ts

export const ASSESSMENT_PHASE_STATUSES = ["DRAFT", "OPEN", "CLOSED"] as const;

export type AssessmentPhaseStatus = typeof ASSESSMENT_PHASE_STATUSES[number];

export const DEFAULT_ASSESSMENT_PHASE_STATUS: AssessmentPhaseStatus = "OPEN";

export const ASSESSMENT_PHASE_LABEL: Record<AssessmentPhaseStatus, string> = {
  DRAFT: "설정 중",
  OPEN: "진행 중",
  CLOSED: "마감",
};

export function isAssessmentPhaseStatus(value: unknown): value is AssessmentPhaseStatus {
  return typeof value === "string" &&
    (ASSESSMENT_PHASE_STATUSES as readonly string[]).includes(value);
}

export function normalizeAssessmentPhaseStatus(value: unknown): AssessmentPhaseStatus {
  return isAssessmentPhaseStatus(value) ? value : DEFAULT_ASSESSMENT_PHASE_STATUS;
}

export function isAssessmentOpen(value: unknown): boolean {
  return normalizeAssessmentPhaseStatus(value) === "OPEN";
}

export function isAssessmentClosed(value: unknown): boolean {
  return normalizeAssessmentPhaseStatus(value) === "CLOSED";
}
