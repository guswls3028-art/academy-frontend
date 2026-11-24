import type { SessionScoreMeta, SessionScoreRow } from "@/shared/api/contracts/sessionScores";
import {
  buildScoreVars,
  collectUnenteredScoreItems,
  scoreMessageStudentVars,
  type ScoreReportOptions,
} from "@/shared/scoring/scoreReport";

type ScoreAlimtalkIssue = {
  message: string;
  unenteredEnrollmentIds?: number[];
};

export function getScoreAlimtalkIssue(
  rows: SessionScoreRow[],
  afterSave: boolean,
  includeVideo: boolean,
): ScoreAlimtalkIssue | null {
  if (rows.length === 0) {
    const applicableAttendance = includeVideo ? "출석·지각·영상" : "출석·지각";
    return { message: `선택한 학생 중 ${applicableAttendance}으로 기록된 학생이 없습니다. 출결을 확인해 주세요.` };
  }
  if (rows.some((row) => row.exams.some((exam) => exam.block.grading_status === "subjective_pending"))) {
    return { message: "최신 성적에 서술형 점수 입력이 필요합니다. 입력을 완료한 뒤 다시 시도해 주세요." };
  }
  const provisionalCount = rows.reduce(
    (count, row) => count + row.exams.filter((exam) => exam.block.is_provisional).length, 0,
  );
  if (provisionalCount > 0) {
    return { message: `채점을 확인 중인 시험이 ${provisionalCount}건 있습니다. 채점이 완료된 뒤 다시 시도해 주세요.` };
  }
  const unenteredRows = rows.flatMap((row) => {
    const count = collectUnenteredScoreItems(row).length;
    return count > 0 ? [{ row, count }] : [];
  });
  if (unenteredRows.length === 0) return null;
  const unenteredCount = unenteredRows.reduce((total, { count }) => total + count, 0);
  const affectedNames = unenteredRows.slice(0, 3).map(({ row, count }) => `${row.student_name} ${count}건`).join(", ");
  const remainingNames = unenteredRows.length > 3 ? ` 외 ${unenteredRows.length - 3}명` : "";
  const prefix = afterSave ? "최신 성적에 입력되지 않은 시험·과제가" : "점수가 입력되지 않은 시험·과제가";
  return {
    message: `${prefix} ${unenteredCount}건 있습니다. ${affectedNames}${remainingNames}. 점수를 입력하거나 /로 미응시·미제출을 확정한 뒤 다시 시도해 주세요.`,
    unenteredEnrollmentIds: unenteredRows.map(({ row }) => row.enrollment_id),
  };
}

export function prepareScoreAlimtalkVariables(
  rows: SessionScoreRow[],
  meta: SessionScoreMeta | null,
  options: ScoreReportOptions,
) {
  // The composer uses one score snapshot. Text edits only need to reapply its values.
  const scoreValues = new Map<SessionScoreRow, Record<string, string>>();
  const getScoreValues = (row: SessionScoreRow) => {
    const existing = scoreValues.get(row);
    if (existing) return existing;
    const values = buildScoreVars(row, meta, options);
    scoreValues.set(row, values);
    return values;
  };

  return {
    firstScoreVars: rows[0] ? getScoreValues(rows[0]) : {},
    recomputePerStudentVars(currentBody: string): Record<number, Record<string, string>> {
      const result: Record<number, Record<string, string>> = {};
      for (const row of rows) {
        if (row.student_id == null) continue;
        const scoreVars = getScoreValues(row);
        result[row.student_id] = scoreMessageStudentVars(currentBody, row, meta, scoreVars);
      }
      return result;
    },
  };
}
