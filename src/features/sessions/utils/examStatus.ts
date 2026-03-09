/**
 * 시험 상태 판단 (클라이언트)
 * - open_at, close_at 기준. 채점 완료 여부는 백엔드 확장 시 반영
 */
export type ExamStatus = "draft" | "open" | "grading" | "completed";

/** 과제와 동일. 운영 보드에서만 사용. 사용자에는 설정 중/진행 중/마감으로만 노출 */
export type ExamPhaseStatus = "DRAFT" | "OPEN" | "CLOSED";

export const EXAM_PHASE_LABEL: Record<ExamPhaseStatus, string> = {
  DRAFT: "설정 중",
  OPEN: "진행 중",
  CLOSED: "마감",
};

export function getExamStatus(
  openAt: string | null,
  closeAt: string | null
): ExamStatus {
  const now = new Date();
  const open = openAt ? new Date(openAt) : null;
  const close = closeAt ? new Date(closeAt) : null;

  if (!open || open > now) return "draft";
  if (close && now > close) return "grading";
  return "open";
}

export const EXAM_STATUS_LABEL: Record<ExamStatus, string> = {
  draft: "초안",
  open: "진행중",
  grading: "채점대기",
  completed: "완료",
};

export const EXAM_STATUS_COLOR: Record<ExamStatus, string> = {
  draft: "gray",
  open: "blue",
  grading: "yellow",
  completed: "green",
};
