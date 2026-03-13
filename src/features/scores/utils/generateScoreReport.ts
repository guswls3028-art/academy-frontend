/**
 * 성적 발송 메시지 본문 자동 생성
 * — 학생의 시험/과제 결과를 포매팅하여 SMS/알림톡 본문 텍스트를 반환
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
  return passed ? "합격" : "불합";
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
  const header = [options.lectureName, options.sessionTitle].filter(Boolean).join(" ");

  if (header) {
    lines.push(`■ ${date} ${row.student_name} ${header} 결과`);
  } else {
    lines.push(`■ ${date} ${row.student_name} Test 결과`);
  }

  // ── Exams ──
  const failedExams: string[] = [];
  if (row.exams && row.exams.length > 0) {
    for (const exam of row.exams) {
      const metaExam = meta?.exams?.find((e) => e.exam_id === exam.exam_id);
      const maxScore = exam.block.max_score ?? metaExam?.max_score ?? null;
      if (exam.block.score != null) {
        const percent = pct(exam.block.score, maxScore);
        const maxStr = maxScore != null ? `/${maxScore}` : "";
        const passStr = passLabel(exam.block.passed);
        let line = `- ${exam.title}: ${exam.block.score}${maxStr}`;
        if (percent) line += ` (${percent})`;
        if (passStr) line += ` [${passStr}]`;

        // objective + subjective breakdown
        if (exam.block.objective_score != null && exam.block.subjective_score != null) {
          line += `\n  (객관식 ${exam.block.objective_score} + 주관식 ${exam.block.subjective_score})`;
        }
        lines.push(line);

        if (exam.block.passed === false) failedExams.push(exam.title);
      } else {
        lines.push(`- ${exam.title}: 미응시`);
        failedExams.push(exam.title);
      }
    }
  }

  // ── Homeworks ──
  const failedHomeworks: string[] = [];
  if (row.homeworks && row.homeworks.length > 0) {
    lines.push("");
    lines.push("■ 과제 결과");
    for (const hw of row.homeworks) {
      if (hw.block.score != null) {
        const metaHw = meta?.homeworks?.find((h) => h.homework_id === hw.homework_id);
        const hwMaxScore = hw.block.max_score ?? metaHw?.max_score ?? null;
        const maxStr = hwMaxScore != null ? `/${hwMaxScore}` : "";
        const percent = pct(hw.block.score, hwMaxScore);
        const passStr = passLabel(hw.block.passed);
        let line = `- ${hw.title}: ${hw.block.score}${maxStr}`;
        if (percent) line += ` (${percent})`;
        if (passStr) line += ` [${passStr}]`;
        lines.push(line);

        if (hw.block.passed === false) failedHomeworks.push(hw.title);
      } else {
        lines.push(`- ${hw.title}: 미제출`);
        failedHomeworks.push(hw.title);
      }
    }
  }

  // ── Summary: failed items ──
  const allFailed = [...failedExams, ...failedHomeworks];
  if (allFailed.length > 0) {
    lines.push("");
    lines.push(`■ 미달 항목: ${allFailed.join(", ")}`);
  }

  // ── Clinic ──
  if (row.clinic_required) {
    lines.push("- 클리닉 대상");
  }

  return lines.join("\n");
}
