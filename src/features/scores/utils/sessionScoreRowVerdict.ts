/**
 * 성적 행(SessionScoreRow)의 미달·판정 표시 단일 진실.
 * StudentScoresDrawer(미달 항목·최종 판정)과 ScoresTable「판정」열이 동일 규칙을 쓰도록 한다.
 */
import type { SessionScoreRow } from "../api/sessionScores";

/** 미달로 볼 항목 제목 (시험/과제). 드로어 failedItems와 동일 조건. */
export function getSessionRowFailedItemTitles(row: SessionScoreRow): string[] {
  const items: string[] = [];
  for (const exam of row.exams ?? []) {
    if (exam.block.passed === false || exam.block.score == null) {
      items.push(exam.title);
    }
  }
  for (const hw of row.homeworks ?? []) {
    if (hw.block.passed === false || hw.block.score == null) {
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
