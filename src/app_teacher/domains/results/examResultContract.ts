import type { QueryClient } from "@tanstack/react-query";
import type { TeacherExamResultRow } from "@teacher/domains/scores/api";

function toNumberOrNull(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function getExamResultEnrollmentId(row: TeacherExamResultRow): number | null {
  return toNumberOrNull(row.enrollment_id ?? row.enrollment);
}

export function getExamResultScore(row: TeacherExamResultRow): number | null {
  return toNumberOrNull(row.final_score ?? row.exam_score ?? row.total_score);
}

export function getExamResultMaxScore(row: TeacherExamResultRow, fallback = 100): number {
  return toNumberOrNull(row.exam_max_score ?? row.max_score) ?? fallback;
}

export function hasExamResultScore(row: TeacherExamResultRow): boolean {
  return getExamResultScore(row) != null;
}

export function invalidateTeacherExamResultQueries(
  queryClient: QueryClient,
  examId: number,
): Promise<unknown[]> {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ["exam-results", examId] }),
    queryClient.invalidateQueries({ queryKey: ["teacher-exam-results", examId] }),
    queryClient.invalidateQueries({ queryKey: ["results-detail", examId] }),
    queryClient.invalidateQueries({ queryKey: ["tc-exam-results", examId] }),
    queryClient.invalidateQueries({ queryKey: ["exam-results-session", examId] }),
  ]);
}
