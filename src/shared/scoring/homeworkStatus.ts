/**
 * Homework Status SSOT (frontend)
 *
 * 상태 판별 기준:
 * - score === null && meta.status == null -> 미입력
 * - meta.status === "NOT_SUBMITTED" -> 미제출
 * - score === 0 -> 0점
 * - score > 0 -> 정상 점수
 */

export type HomeworkMetaStatus = "NOT_SUBMITTED" | "VIDEO_MAKEUP" | null | undefined;

export function parseHomeworkMetaStatus(value: unknown): NonNullable<HomeworkMetaStatus> | null {
  return value === "NOT_SUBMITTED" || value === "VIDEO_MAKEUP" ? value : null;
}

export type HomeworkStatus =
  | "UNSET"
  | "NOT_SUBMITTED"
  | "VIDEO_MAKEUP"
  | "ZERO"
  | "SCORED";

export function getHomeworkStatus(params: {
  score: number | null | undefined;
  metaStatus: HomeworkMetaStatus;
}): HomeworkStatus {
  const score = params.score ?? null;
  const metaStatus = params.metaStatus ?? null;

  if (score === null && metaStatus == null) return "UNSET";
  if (metaStatus === "NOT_SUBMITTED") return "NOT_SUBMITTED";
  if (metaStatus === "VIDEO_MAKEUP" && score === null) return "VIDEO_MAKEUP";
  if (score === 0) return "ZERO";
  if (typeof score === "number" && Number.isFinite(score) && score > 0) return "SCORED";

  return "UNSET";
}

export function homeworkStatusLabel(status: HomeworkStatus): string {
  switch (status) {
    case "UNSET":
      return "미입력";
    case "NOT_SUBMITTED":
      return "미제출";
    case "VIDEO_MAKEUP":
      return "영상 보강";
    case "ZERO":
      return "0점";
    case "SCORED":
      return "채점";
    default:
      return "-";
  }
}
