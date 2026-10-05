import type { MyExamGradeSummary, MyHomeworkGradeSummary } from "../api/grades.api";

export function gradeLectureKey(grade: Pick<MyExamGradeSummary, "lecture_id" | "enrollment_id">): string {
  return grade.lecture_id != null ? `lecture:${grade.lecture_id}` : `enrollment:${grade.enrollment_id}`;
}

// 원점수와 최종 판정은 독립적이다. 미판정을 불합격으로 집계하지 않는다.
export function getExamPassStatus(exam: MyExamGradeSummary, wrongCompletionOnly: boolean): boolean | null {
  if (exam.achievement === "NOT_SUBMITTED" || exam.meta_status === "NOT_SUBMITTED") return null;
  if (wrongCompletionOnly) {
    if (exam.correction_status === "PENDING") return false;
    if (exam.correction_status === "COMPLETED" || exam.correction_status === "NOT_REQUIRED") return true;
    return null;
  }
  if (exam.achievement === "PASS" || exam.achievement === "REMEDIATED") return true;
  if (exam.achievement === "FAIL") return false;
  return exam.is_pass ?? null;
}

export function calculateExamStats(exams: MyExamGradeSummary[], wrongCompletionOnly: boolean) {
  if (exams.length === 0) return null;
  const scoredExams = exams.filter((exam) => exam.total_score != null && exam.max_score > 0);
  const avgPct = scoredExams.length > 0
    ? Math.round(scoredExams.reduce((sum, exam) => sum + (exam.total_score! / exam.max_score) * 100, 0) / scoredExams.length)
    : null;
  const judgments = exams.map((exam) => getExamPassStatus(exam, wrongCompletionOnly));
  const judgedCount = judgments.filter((status) => status != null).length;
  const passCount = judgments.filter((status) => status === true).length;
  const passRate = judgedCount > 0 ? Math.round((passCount / judgedCount) * 100) : null;
  const rankedExams = exams.filter((exam) => exam.rank != null && exam.cohort_size != null && exam.cohort_size > 1 && exam.meta_status !== "NOT_SUBMITTED");
  const avgRank = rankedExams.length > 0
    ? Math.round((rankedExams.reduce((sum, exam) => sum + exam.rank!, 0) / rankedExams.length) * 10) / 10
    : null;
  return { avgPct, passRate, count: exams.length, avgRank };
}

export function calculateHomeworkStats(homeworks: MyHomeworkGradeSummary[]) {
  if (homeworks.length === 0) return null;
  const graded = homeworks.filter((homework) => homework.score != null || homework.teacher_resolved === true);
  const judgments = graded.map((homework) => {
    if (homework.teacher_resolved === true || homework.achievement === "PASS" || homework.achievement === "REMEDIATED") return true;
    if (homework.achievement === "FAIL") return false;
    if (homework.achievement === "NOT_SUBMITTED") return null;
    return homework.passed ?? null;
  });
  const passed = judgments.filter((status) => status === true).length;
  const failed = judgments.filter((status) => status === false).length;
  const withMax = graded.filter((homework) => homework.score != null && homework.max_score != null && homework.max_score > 0);
  const avgPct = withMax.length > 0
    ? Math.round(withMax.reduce((sum, homework) => sum + (homework.score! / homework.max_score!) * 100, 0) / withMax.length)
    : null;
  const judgedCount = passed + failed;
  const passRate = judgedCount > 0 ? Math.round((passed / judgedCount) * 100) : null;
  return { passed, failed, graded: graded.length, total: homeworks.length, avgPct, passRate };
}

export function calculateWeakestLecture(exams: MyExamGradeSummary[], wrongCompletionOnly: boolean) {
  const byLecture = new Map<string, { name: string; judged: number; pass: number; scores: number[] }>();
  for (const exam of exams) {
    if (!exam.lecture_title || exam.total_score == null || exam.max_score <= 0) continue;
    const key = gradeLectureKey(exam);
    if (!byLecture.has(key)) byLecture.set(key, { name: exam.lecture_title, judged: 0, pass: 0, scores: [] });
    const entry = byLecture.get(key)!;
    const status = getExamPassStatus(exam, wrongCompletionOnly);
    if (status != null) entry.judged += 1;
    if (status === true) entry.pass += 1;
    entry.scores.push((exam.total_score / exam.max_score) * 100);
  }
  if (byLecture.size < 2) return null;
  const lectureStats = Array.from(byLecture.values())
    .map((data) => ({
      name: data.name.length > 8 ? data.name.slice(0, 8) + "\u2026" : data.name,
      avg: Math.round(data.scores.reduce((sum, value) => sum + value, 0) / data.scores.length),
      passRate: data.judged > 0 ? Math.round((data.pass / data.judged) * 100) : null,
    }))
    .sort((a, b) => a.avg - b.avg);
  const weakest = lectureStats[0];
  return weakest && weakest.avg < 70 ? weakest : null;
}
