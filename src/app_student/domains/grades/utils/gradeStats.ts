import type { MyExamGradeSummary } from "../api/grades.api";
import { getExamPassStatus } from "../public/examPassStatus";
export { calculateHomeworkStats } from "../public/homeworkStats";
export { getExamPassStatus } from "../public/examPassStatus";

export function gradeLectureKey(grade: Pick<MyExamGradeSummary, "lecture_id" | "enrollment_id">): string {
  return grade.lecture_id != null ? `lecture:${grade.lecture_id}` : `enrollment:${grade.enrollment_id}`;
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
  const rankedExams = exams.filter((exam) => exam.rank != null && exam.meta_status !== "NOT_SUBMITTED");
  const avgRank = rankedExams.length > 0
    ? Math.round((rankedExams.reduce((sum, exam) => sum + exam.rank!, 0) / rankedExams.length) * 10) / 10
    : null;
  return { avgPct, passRate, count: exams.length, avgRank };
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
