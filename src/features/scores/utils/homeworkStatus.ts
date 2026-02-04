// PATH: src/features/scores/utils/homeworkStatus.ts
/**
 * Homework Status SSOT (frontend)
 *
 * 상태 판별 기준 (단일 함수 고정):
 * - score === null && meta.status == null → 미입력
 * - meta.status === "NOT_SUBMITTED"       → 미제출
 * - score === 0                           → 0점
 * - score > 0                            → 정상 점수
 */

export type HomeworkMetaStatus = "NOT_SUBMITTED" | null | undefined;

export type HomeworkStatus =
  | "UNSET" // 미입력
  | "NOT_SUBMITTED" // 미제출
  | "ZERO" // 0점
  | "SCORED"; // 정상 점수

export function getHomeworkStatus(params: {
  score: number | null | undefined;
  metaStatus: HomeworkMetaStatus;
}): HomeworkStatus {
  const score = params.score ?? null;
  const metaStatus = params.metaStatus ?? null;

  if (score === null && metaStatus == null) return "UNSET";
  if (metaStatus === "NOT_SUBMITTED") return "NOT_SUBMITTED";
  if (score === 0) return "ZERO";
  if (typeof score === "number" && Number.isFinite(score) && score > 0) return "SCORED";

  // defensive fallback (treat as UNSET)
  return "UNSET";
}

export function homeworkStatusLabel(status: HomeworkStatus): string {
  switch (status) {
    case "UNSET":
      return "미입력";
    case "NOT_SUBMITTED":
      return "미제출";
    case "ZERO":
      return "0점";
    case "SCORED":
      return "채점";
    default:
      return "-";
  }
}
