import type { MyHomeworkGradeSummary } from "../api/grades.api";

export function calculateHomeworkStats(homeworks: MyHomeworkGradeSummary[]) {
  if (homeworks.length === 0) return null;
  const graded = homeworks.filter((homework) => homework.score != null || homework.teacher_resolved === true);
  const judgments = homeworks.map((homework) => {
    if (homework.teacher_resolved === true || homework.achievement === "PASS" || homework.achievement === "REMEDIATED") return true;
    if (homework.achievement === "FAIL") return false;
    if (homework.achievement === "NOT_SUBMITTED") return null;
    return homework.score != null ? homework.passed ?? null : null;
  });
  const passed = judgments.filter((status) => status === true).length;
  const failed = judgments.filter((status) => status === false).length;
  const withMax = graded.filter((homework) => homework.grading_mode !== "COMPLETION" && homework.score != null && homework.max_score != null && homework.max_score > 0);
  const avgPct = withMax.length > 0
    ? Math.round(withMax.reduce((sum, homework) => sum + (homework.score! / homework.max_score!) * 100, 0) / withMax.length)
    : null;
  const judgedCount = passed + failed;
  const passRate = judgedCount > 0 ? Math.round((passed / judgedCount) * 100) : null;
  return { passed, failed, graded: graded.length, total: homeworks.length, avgPct, passRate };
}
