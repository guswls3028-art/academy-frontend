/**
 * 성적 행(SessionScoreRow)의 상태 표시 단일 진실.
 * StudentScoresDrawer와 ScoresTable「판정」열이 같은 의미를 쓰도록 한다.
 *
 * 정책:
 * - 미입력, 검수 대기, 실제 미달, 클리닉 대상을 서로 섞지 않는다.
 * - 보강합격(remediated/final_pass=true)은 실제 미달이 아니다.
 * - 과제의 수동 검사 완료는 점수 입력 여부와 독립적으로 유지한다.
 * - `block.achievement`/`block.final_pass`가 내려오면 이를 우선 신뢰한다.
 */
import type { ScoreBlock, SessionScoreRow } from "../api/sessionScores";
import { deriveFinalPass } from "@/shared/scoring/achievement";

export function isSessionRowProgressCompleted(row: SessionScoreRow): boolean {
  return row.progress_completed === true || row.progress_status === "completed";
}

export function getScoreBlockOmrReviewStatus(block: ScoreBlock | null | undefined): "review" | null {
  return block?.meta?.status === "OMR_REVIEW_REQUIRED" ? "review" : null;
}

type AttentionKind = "missing" | "review" | "failed" | null;

function blockAttentionKind(block: ScoreBlock, sourceType: "exam" | "homework"): AttentionKind {
  if (getScoreBlockOmrReviewStatus(block)) return "review";
  const fp = deriveFinalPass({
    achievement: block.achievement ?? null,
    is_pass: block.passed ?? null,
    final_pass: block.final_pass ?? null,
    remediated: block.remediated ?? null,
  });
  // 오답 보완은 점수 판정과 별개의 후속 업무다. 이미 커트라인을 넘은
  // 학생을 행 단위에서 "검수 대기"로 낮추지 않고, 개별 시험 배지는
  // 계속 "보완 필요"를 보여준다. 실제 OMR 판독 검토는 위에서 우선한다.
  if (block.correction_status === "PENDING" && fp !== true) return "review";
  if (
    sourceType === "homework"
    && (block.correction_status === "COMPLETED" || block.correction_status === "NOT_REQUIRED")
  ) {
    return null;
  }
  if (block.score == null || block.meta?.status === "NOT_SUBMITTED") return "missing";

  if (fp === false) return "failed";
  return null;
}

export type SessionRowAttentionSummary = {
  missingTitles: string[];
  reviewTitles: string[];
  failedTitles: string[];
};

/** 미입력·검수 대기·실제 미달 항목을 분리한 행 요약. */
export function getSessionRowAttentionSummary(row: SessionScoreRow): SessionRowAttentionSummary {
  const summary: SessionRowAttentionSummary = {
    missingTitles: [],
    reviewTitles: [],
    failedTitles: [],
  };
  if (isSessionRowProgressCompleted(row)) return summary;

  const append = (kind: AttentionKind, title: string) => {
    if (kind === "missing") summary.missingTitles.push(title);
    if (kind === "review") summary.reviewTitles.push(title);
    if (kind === "failed") summary.failedTitles.push(title);
  };

  for (const exam of row.exams ?? []) {
    append(blockAttentionKind(exam.block, "exam"), exam.title);
  }
  for (const homework of row.homeworks ?? []) {
    append(blockAttentionKind(homework.block, "homework"), homework.title);
  }
  return summary;
}

export function getSessionRowAttentionCountLabel(summary: SessionRowAttentionSummary): string {
  const parts = [
    summary.reviewTitles.length > 0 ? `검수 ${summary.reviewTitles.length}` : "",
    summary.missingTitles.length > 0 ? `미입력 ${summary.missingTitles.length}` : "",
    summary.failedTitles.length > 0 ? `미달 ${summary.failedTitles.length}` : "",
  ].filter(Boolean);
  return parts.join(" · ");
}

export type SessionScoresTableVerdictKind =
  | "clinic_target"
  | "review"
  | "incomplete"
  | "fail"
  | "pass"
  | "dash";

/**
 * ScoresTable「판정」열 표시.
 * - clinic_required(클리닉 미해소 링크)면 항상 클리닉 대상(합격/불합과 혼동 금지).
 * - 그 외는 검수 대기 → 미입력 → 실제 미달 순서로 다음 행동을 안내한다.
 */
export function getSessionScoresTableVerdict(row: SessionScoreRow): SessionScoresTableVerdictKind {
  if (isSessionRowProgressCompleted(row)) return "pass";
  if (row.clinic_required) return "clinic_target";
  const summary = getSessionRowAttentionSummary(row);
  if (summary.reviewTitles.length > 0) return "review";
  if (summary.missingTitles.length > 0) return "incomplete";
  if (summary.failedTitles.length > 0) return "fail";
  const hasItems = (row.exams?.length ?? 0) + (row.homeworks?.length ?? 0) > 0;
  if (!hasItems) return "dash";
  return "pass";
}
