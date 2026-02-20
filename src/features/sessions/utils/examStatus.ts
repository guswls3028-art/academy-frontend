/**
 * 시험 상태 판단 (클라이언트)
 * - open_at, close_at 기준. 채점 완료 여부는 백엔드 확장 시 반영
 */
export type ExamStatus = "draft" | "open" | "grading" | "completed";

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
