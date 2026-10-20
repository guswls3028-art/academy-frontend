import type { ScoreBlock, SessionScoreMeta, SessionScoreRow } from "@/shared/api/contracts/sessionScores";

function literalText(value: string): string {
  // Quoting CSV alone does not stop Excel from interpreting a text cell as a formula.
  const firstCode = value.charCodeAt(0);
  return firstCode < 32 || firstCode === 127 || /^[=+@-]/.test(value.trimStart()) ? `'${value}` : value;
}

function displayScore(block: ScoreBlock | undefined, completion = false): string {
  if (!block) return "미배정";
  if (block.grading_status === "subjective_pending") return "서술형 입력 필요";
  if (block.is_provisional) return "채점 확인 중";
  if (block.meta?.status === "NOT_SUBMITTED") return "미제출";
  if (block.score == null) return "미입력";
  return completion ? (block.score >= 1 ? "O" : "X") : String(block.score);
}

/** Individual assessment columns only; session selected totals are not reconstructed. */
export function buildScoreCsv(meta: SessionScoreMeta, rows: SessionScoreRow[]): string {
  const headers = ["이름", ...meta.exams.map(exam => literalText(`${exam.title ?? "시험"} (점수)`)),
    ...meta.homeworks.map(homework => literalText(`${homework.title ?? "과제"} (${homework.grading_mode === "COMPLETION" ? "O/X" : "점수"})`))];
  const values = rows.map(row => [literalText(row.student_name ?? ""),
    ...meta.exams.map(exam => displayScore(row.exams.find(entry => entry.exam_id === exam.exam_id)?.block)),
    ...meta.homeworks.map(homework => displayScore(row.homeworks.find(entry => entry.homework_id === homework.homework_id)?.block, homework.grading_mode === "COMPLETION"))]);
  return "\uFEFF" + [headers, ...values].map(cells => cells.map(value => `"${value.replace(/"/g, '""')}"`).join(",")).join("\r\n");
}
