/**
 * 성적 발송 메시지 본문 자동 생성
 * — 학생의 시험/과제 결과를 포매팅하여 SMS/알림톡 본문 텍스트를 반환
 *
 * generateScoreReport: SMS 본문용 (전체 텍스트)
 * buildScoreDetail: 알림톡 #{시험성적} 변수용 (시험/과제/미달 블록)
 */

import type {
  SessionScoreRow,
  SessionScoreMeta,
  SessionScoreExamEntry,
  SessionScoreHomeworkEntry,
} from "../api/sessionScores";

export type ScoreReportOptions = {
  /** 학원/강의 이름 (헤더에 표시) */
  lectureName?: string;
  /** 차시 이름 */
  sessionTitle?: string;
  /** 날짜 (미입력 시 오늘) */
  date?: string;
};

function pct(score: number | null | undefined, max: number | null | undefined): string {
  if (score == null || max == null || max === 0) return "";
  return `${Math.round((score / max) * 100)}%`;
}

function passLabel(passed: boolean | null | undefined): string {
  if (passed == null) return "";
  return passed ? "합격" : "불합격";
}

function formatDate(iso?: string): string {
  try {
    const d = iso ? new Date(iso) : new Date();
    const m = d.getMonth() + 1;
    const day = d.getDate();
    return `${m}월 ${day}일`;
  } catch {
    return "";
  }
}

export function generateScoreReport(
  row: SessionScoreRow,
  meta: SessionScoreMeta | null,
  options: ScoreReportOptions = {},
): string {
  const lines: string[] = [];
  const date = formatDate(options.date);
  const header = [options.lectureName, options.sessionTitle].filter(Boolean).join(" · ");

  lines.push(`${row.student_name}님 성적표 안내드립니다.`);
  if (header) {
    lines.push(header);
  }
  lines.push(`${date} 성적`);
  lines.push("");

  // ── 시험 ──
  const failedExams: string[] = [];
  if (row.exams && row.exams.length > 0) {
    lines.push("[시험]");
    for (const exam of row.exams) {
      const metaExam = meta?.exams?.find((e) => e.exam_id === exam.exam_id);
      const maxScore = exam.block.max_score ?? metaExam?.max_score ?? null;
      if (exam.block.score != null) {
        const percent = pct(exam.block.score, maxScore);
        const maxStr = maxScore != null ? `/${maxScore}` : "";
        const passStr = passLabel(exam.block.passed);
        lines.push(`- ${exam.title}: ${exam.block.score}${maxStr}${percent ? ` (${percent})` : ""} ${passStr}`.trimEnd());
        if (exam.block.passed === false) failedExams.push(exam.title);
      } else {
        lines.push(`- ${exam.title}: 미응시`);
        failedExams.push(exam.title);
      }
    }
  }

  // ── 과제 ──
  const failedHomeworks: string[] = [];
  if (row.homeworks && row.homeworks.length > 0) {
    lines.push("");
    lines.push("[과제]");
    for (const hw of row.homeworks) {
      const metaHw = meta?.homeworks?.find((h) => h.homework_id === hw.homework_id);
      const hwMaxScore = hw.block.max_score ?? metaHw?.max_score ?? null;
      if (hw.block.score != null) {
        const maxStr = hwMaxScore != null ? `/${hwMaxScore}` : "";
        const percent = pct(hw.block.score, hwMaxScore);
        const passStr = passLabel(hw.block.passed);
        lines.push(`- ${hw.title}: ${hw.block.score}${maxStr}${percent ? ` (${percent})` : ""} ${passStr}`.trimEnd());
        if (hw.block.passed === false) failedHomeworks.push(hw.title);
      } else {
        lines.push(`- ${hw.title}: 미제출`);
        failedHomeworks.push(hw.title);
      }
    }
  }

  // ── 클리닉 필요 ──
  const allFailed = [...failedExams, ...failedHomeworks];
  if (allFailed.length > 0) {
    lines.push("");
    lines.push(`클리닉 필요: ${allFailed.join(", ")}`);
  }

  return lines.join("\n");
}

/**
 * 알림톡 #{시험성적} 변수에 넣을 성적 상세 블록 생성.
 * SMS generateScoreReport와 분리 — 알림톡 템플릿 구조에 맞는 깔끔한 포맷.
 */
export function buildScoreDetail(
  row: SessionScoreRow,
  meta: SessionScoreMeta | null,
): string {
  const lines: string[] = [];

  // ── 시험 ──
  if (row.exams && row.exams.length > 0) {
    lines.push("[시험]");
    for (const exam of row.exams) {
      const metaExam = meta?.exams?.find((e) => e.exam_id === exam.exam_id);
      const maxScore = exam.block.max_score ?? metaExam?.max_score ?? null;
      if (exam.block.score != null) {
        const percent = pct(exam.block.score, maxScore);
        const maxStr = maxScore != null ? `/${maxScore}` : "";
        const pass = exam.block.passed === true ? "합격" : exam.block.passed === false ? "불합격" : "";
        lines.push(`- ${exam.title}: ${exam.block.score}${maxStr}${percent ? ` (${percent})` : ""} ${pass}`.trimEnd());
      } else {
        lines.push(`- ${exam.title}: 미응시`);
      }
    }
  }

  // ── 과제 ──
  if (row.homeworks && row.homeworks.length > 0) {
    lines.push("");
    lines.push("[과제]");
    for (const hw of row.homeworks) {
      const metaHw = meta?.homeworks?.find((h) => h.homework_id === hw.homework_id);
      const hwMax = hw.block.max_score ?? metaHw?.max_score ?? null;
      if (hw.block.score != null) {
        const percent = pct(hw.block.score, hwMax);
        const maxStr = hwMax != null ? `/${hwMax}` : "";
        const pass = hw.block.passed === true ? "합격" : hw.block.passed === false ? "불합격" : "";
        lines.push(`- ${hw.title}: ${hw.block.score}${maxStr}${percent ? ` (${percent})` : ""} ${pass}`.trimEnd());
      } else {
        lines.push(`- ${hw.title}: 미제출`);
      }
    }
  }

  // ── 클리닉 필요 ──
  const failed = [
    ...(row.exams ?? []).filter((e) => e.block.passed === false || e.block.score == null).map((e) => e.title),
    ...(row.homeworks ?? []).filter((h) => h.block.passed === false || h.block.score == null).map((h) => h.title),
  ];
  if (failed.length > 0) {
    lines.push("");
    lines.push(`클리닉 필요: ${failed.join(", ")}`);
  }

  return lines.join("\n");
}
