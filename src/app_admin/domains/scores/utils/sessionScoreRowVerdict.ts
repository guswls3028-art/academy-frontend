/**
 * 성적 행(SessionScoreRow)의 미달·판정 표시 단일 진실.
 * StudentScoresDrawer(미달 항목·최종 판정)과 ScoresTable「판정」열이 동일 규칙을 쓰도록 한다.
 *
 * 정책:
 * - 판정/미달은 "성취" 기준. 보강합격(remediated/final_pass=true)은 미달이 아니다.
 * - `block.achievement`/`block.final_pass`가 내려오면 이를 우선 신뢰.
 * - 미응시/점수 null은 여전히 미달(= 성적 입력 미완료)으로 처리해 운영자가 놓치지 않도록.
 */
import type { ScoreBlock, SessionScoreRow } from "../api/sessionScores";
import { deriveFinalPass } from "@/shared/scoring/achievement";

function blockIsFailed(block: ScoreBlock): boolean {
  // 점수가 없으면 미달 (성적 입력 안 됨)
  if (block.score == null) return true;
  const fp = deriveFinalPass({
    achievement: block.achievement ?? null,
    is_pass: block.passed ?? null,
    final_pass: block.final_pass ?? null,
    remediated: block.remediated ?? null,
  });
  // 최종 합격이면 미달 아님. 미판정(null)이면 passed만 보고, 그것도 null이면 미달 아님으로 둔다.
  if (fp === true) return false;
  if (fp === false) return true;
  // fp=null: 판정 기준 없음(pass_score=0). 점수는 있음 → 미달 아님.
  return false;
}

/** 미달로 볼 항목 제목 (시험/과제). 드로어 failedItems와 동일 조건. */
export function getSessionRowFailedItemTitles(row: SessionScoreRow): string[] {
  const items: string[] = [];
  for (const exam of row.exams ?? []) {
    if (blockIsFailed(exam.block)) {
      items.push(exam.title);
    }
  }
  for (const hw of row.homeworks ?? []) {
    if (blockIsFailed(hw.block)) {
      items.push(hw.title);
    }
  }
  return items;
}

export type SessionScoresTableVerdictKind = "clinic_target" | "fail" | "pass" | "dash";

/**
 * ScoresTable「판정」열 표시.
 * - clinic_required(클리닉 미해소 링크)면 항상 클리닉 대상(합격/불합과 혼동 금지).
 * - 그 외는 미달 항목 수가 드로어와 동일하게 계산된 뒤 합격/불합/데이터 없음.
 */
export function getSessionScoresTableVerdict(row: SessionScoreRow): SessionScoresTableVerdictKind {
  if (row.clinic_required) return "clinic_target";
  const failed = getSessionRowFailedItemTitles(row);
  if (failed.length > 0) return "fail";
  const hasItems = (row.exams?.length ?? 0) + (row.homeworks?.length ?? 0) > 0;
  if (!hasItems) return "dash";
  return "pass";
}
