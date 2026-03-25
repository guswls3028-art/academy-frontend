/**
 * 성적 발송 메시지 본문 자동 생성
 * — 학생의 시험/과제 결과를 포매팅하여 SMS/알림톡 본문 텍스트를 반환
 *
 * generateScoreReport: SMS 본문용 (전체 텍스트)
 * buildScoreDetail: 알림톡 #{시험성적} 변수용 (시험/과제/요약 블록)
 */

import type {
  SessionScoreRow,
  SessionScoreMeta,
} from "../api/sessionScores";

export type ScoreReportOptions = {
  lectureName?: string;
  sessionTitle?: string;
  date?: string;
};

// ── helpers ──

function pct(score: number | null | undefined, max: number | null | undefined): string {
  if (score == null || max == null || max === 0) return "";
  return `${Math.round((score / max) * 100)}%`;
}

function pctNum(score: number | null | undefined, max: number | null | undefined): number | null {
  if (score == null || max == null || max === 0) return null;
  return Math.round((score / max) * 100);
}

function formatDate(iso?: string): string {
  try {
    const d = iso ? new Date(iso) : new Date();
    return `${d.getMonth() + 1}월 ${d.getDate()}일`;
  } catch {
    return "";
  }
}

/**
 * 시험/과제 공통: 한 항목을 1줄로 렌더링
 * 예: "- 단원평가 1: 92/100 (92%) 합격"
 * 예: "- 단원평가 2: 미응시"
 */
function formatScoreLine(
  title: string,
  score: number | null | undefined,
  maxScore: number | null | undefined,
  passed: boolean | null | undefined,
  absentLabel: string,
): string {
  if (score == null) return `- ${title}: ${absentLabel}`;
  const maxStr = maxScore != null ? `/${maxScore}` : "";
  const percent = pct(score, maxScore);
  const passStr = passed === true ? "합격" : passed === false ? "불합격" : "";
  return `- ${title}: ${score}${maxStr}${percent ? ` (${percent})` : ""} ${passStr}`.trimEnd();
}

type SummaryStats = {
  examScored: number;
  examTotal: number;
  examSumScore: number;
  examSumMax: number;
  examPassed: number;
  hwScored: number;
  hwTotal: number;
  hwSumScore: number;
  hwSumMax: number;
  hwPassed: number;
  failedItems: string[];
};

function collectStats(row: SessionScoreRow, meta: SessionScoreMeta | null): SummaryStats {
  const s: SummaryStats = {
    examScored: 0, examTotal: 0, examSumScore: 0, examSumMax: 0, examPassed: 0,
    hwScored: 0, hwTotal: 0, hwSumScore: 0, hwSumMax: 0, hwPassed: 0,
    failedItems: [],
  };

  for (const exam of row.exams ?? []) {
    s.examTotal++;
    const metaExam = meta?.exams?.find((e) => e.exam_id === exam.exam_id);
    const max = exam.block.max_score ?? metaExam?.max_score ?? 0;
    if (exam.block.score != null) {
      s.examScored++;
      s.examSumScore += exam.block.score;
      s.examSumMax += max;
      if (exam.block.passed === true) s.examPassed++;
    }
    if (exam.block.passed === false || exam.block.score == null) {
      s.failedItems.push(exam.title);
    }
  }

  for (const hw of row.homeworks ?? []) {
    s.hwTotal++;
    const metaHw = meta?.homeworks?.find((h) => h.homework_id === hw.homework_id);
    const max = hw.block.max_score ?? metaHw?.max_score ?? 0;
    if (hw.block.score != null) {
      s.hwScored++;
      s.hwSumScore += hw.block.score;
      s.hwSumMax += max;
      if (hw.block.passed === true) s.hwPassed++;
    }
    if (hw.block.passed === false || hw.block.score == null) {
      s.failedItems.push(hw.title);
    }
  }

  return s;
}

function renderExamLines(row: SessionScoreRow, meta: SessionScoreMeta | null): string[] {
  if (!row.exams || row.exams.length === 0) return [];
  const lines = ["[시험]"];
  for (const exam of row.exams) {
    const metaExam = meta?.exams?.find((e) => e.exam_id === exam.exam_id);
    const max = exam.block.max_score ?? metaExam?.max_score ?? null;
    lines.push(formatScoreLine(exam.title, exam.block.score, max, exam.block.passed, "미응시"));
  }
  return lines;
}

function renderHomeworkLines(row: SessionScoreRow, meta: SessionScoreMeta | null): string[] {
  if (!row.homeworks || row.homeworks.length === 0) return [];
  const lines = ["[과제]"];
  for (const hw of row.homeworks) {
    const metaHw = meta?.homeworks?.find((h) => h.homework_id === hw.homework_id);
    const max = hw.block.max_score ?? metaHw?.max_score ?? null;
    lines.push(formatScoreLine(hw.title, hw.block.score, max, hw.block.passed, "미제출"));
  }
  return lines;
}

function renderSummaryLines(s: SummaryStats): string[] {
  const totalItems = s.examTotal + s.hwTotal;
  if (totalItems === 0) return [];

  const lines = ["[요약]"];

  if (s.examTotal > 0) {
    const avgPct = s.examSumMax > 0 ? Math.round((s.examSumScore / s.examSumMax) * 100) : null;
    lines.push(`- 시험: ${s.examPassed}/${s.examTotal} 합격${avgPct != null ? ` (평균 ${avgPct}점)` : ""}`);
  }
  if (s.hwTotal > 0) {
    const avgPct = s.hwSumMax > 0 ? Math.round((s.hwSumScore / s.hwSumMax) * 100) : null;
    lines.push(`- 과제: ${s.hwPassed}/${s.hwTotal} 합격${avgPct != null ? ` (평균 ${avgPct}점)` : ""}`);
  }

  if (s.failedItems.length === 0) {
    lines.push("- 최종: 합격");
  } else {
    lines.push(`- 최종: 보충 필요`);
    lines.push(`- 보충 대상: ${s.failedItems.join(", ")}`);
  }

  return lines;
}

// ── public API ──

export function generateScoreReport(
  row: SessionScoreRow,
  meta: SessionScoreMeta | null,
  options: ScoreReportOptions = {},
): string {
  const lines: string[] = [];
  const date = formatDate(options.date);
  const header = [options.lectureName, options.sessionTitle].filter(Boolean).join(" · ");

  lines.push(`${row.student_name}님 성적표 안내드립니다.`);
  if (header) lines.push(header);
  lines.push(`${date} 성적`);
  lines.push("");

  const examLines = renderExamLines(row, meta);
  if (examLines.length > 0) lines.push(...examLines);

  const hwLines = renderHomeworkLines(row, meta);
  if (hwLines.length > 0) {
    if (examLines.length > 0) lines.push("");
    lines.push(...hwLines);
  }

  const stats = collectStats(row, meta);
  const summaryLines = renderSummaryLines(stats);
  if (summaryLines.length > 0) {
    lines.push("");
    lines.push(...summaryLines);
  }

  return lines.join("\n");
}

/**
 * 알림톡 #{시험성적} 변수에 넣을 성적 상세 블록.
 * 237 템플릿의 ━━ 구분선 사이에 들어감.
 *
 * 구조: [시험] → [과제] → [요약] (시험평균, 과제평균, 최종 합불, 보충 대상)
 */
export function buildScoreDetail(
  row: SessionScoreRow,
  meta: SessionScoreMeta | null,
): string {
  const lines: string[] = [];

  const examLines = renderExamLines(row, meta);
  if (examLines.length > 0) lines.push(...examLines);

  const hwLines = renderHomeworkLines(row, meta);
  if (hwLines.length > 0) {
    if (examLines.length > 0) lines.push("");
    lines.push(...hwLines);
  }

  const stats = collectStats(row, meta);
  const summaryLines = renderSummaryLines(stats);
  if (summaryLines.length > 0) {
    lines.push("");
    lines.push(...summaryLines);
  }

  return lines.join("\n");
}
