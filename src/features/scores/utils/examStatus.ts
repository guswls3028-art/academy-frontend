// PATH: src/features/scores/utils/examStatus.ts
/**
 * Exam Status SSOT (frontend)
 *
 * 상태 판별 기준 (단일 함수 고정):
 * - score === null && meta.status == null → 미입력
 * - meta.status === "NOT_SUBMITTED"       → 미응시
 * - score === 0                           → 0점
 * - score > 0                             → 정상 점수
 *
 * ✅ homeworkStatus.ts와 동일 패턴
 */

export type ExamMetaStatus = "NOT_SUBMITTED" | null | undefined;

export type ExamStatus =
  | "UNSET" // 미입력
  | "NOT_SUBMITTED" // 미응시
  | "ZERO" // 0점
  | "SCORED"; // 정상 점수

export function getExamStatus(params: {
  score: number | null | undefined;
  metaStatus: ExamMetaStatus;
}): ExamStatus {
  const score = params.score ?? null;
  const metaStatus = params.metaStatus ?? null;

  if (metaStatus === "NOT_SUBMITTED") return "NOT_SUBMITTED";
  if (score === null && metaStatus == null) return "UNSET";
  if (score === 0) return "ZERO";
  if (typeof score === "number" && Number.isFinite(score) && score > 0) return "SCORED";

  // defensive fallback (treat as UNSET)
  return "UNSET";
}

export function examStatusLabel(status: ExamStatus): string {
  switch (status) {
    case "UNSET":
      return "-";
    case "NOT_SUBMITTED":
      return "미응시";
    case "ZERO":
      return "0";
    case "SCORED":
      return "";
    default:
      return "-";
  }
}
