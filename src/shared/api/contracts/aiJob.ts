export const AI_JOB_STATUS = [
  "PENDING",
  "VALIDATING",
  "RUNNING",
  "DONE",
  "FAILED",
  "REJECTED_BAD_INPUT",
  "FALLBACK_TO_GPU",
  "RETRYING",
  "REVIEW_REQUIRED",
] as const;

export type AIJobStatus = (typeof AI_JOB_STATUS)[number];

export const AI_JOB_TERMINAL_STATUSES = [
  "DONE",
  "FAILED",
  "REJECTED_BAD_INPUT",
  "FALLBACK_TO_GPU",
  "REVIEW_REQUIRED",
] as const satisfies readonly AIJobStatus[];

const TERMINAL_STATUS_SET = new Set<string>(AI_JOB_TERMINAL_STATUSES);

export function isTerminalAIJobStatus(status: string | null | undefined): boolean {
  return typeof status === "string" && TERMINAL_STATUS_SET.has(status);
}

export function isFailedAIJobStatus(status: string | null | undefined): boolean {
  return isTerminalAIJobStatus(status) && status !== "DONE";
}
