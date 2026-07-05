import type { QueryClient } from "@tanstack/react-query";
import { teacherResultsQueryKeys } from "./queryKeys";

type ExamResultScoreLike = {
  enrollment?: unknown;
  enrollment_id?: unknown;
  final_score?: unknown;
  exam_score?: unknown;
  total_score?: unknown;
  exam_max_score?: unknown;
  max_score?: unknown;
};

function toNumberOrNull(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function getExamResultEnrollmentId(row: ExamResultScoreLike): number | null {
  return toNumberOrNull(row.enrollment_id ?? row.enrollment);
}

export function getExamResultScore(row: ExamResultScoreLike): number | null {
  return toNumberOrNull(row.final_score ?? row.exam_score ?? row.total_score);
}

export function getExamResultMaxScore(row: ExamResultScoreLike, fallback = 100): number {
  return toNumberOrNull(row.exam_max_score ?? row.max_score) ?? fallback;
}

export function hasExamResultScore(row: ExamResultScoreLike): boolean {
  return getExamResultScore(row) != null;
}

export function invalidateTeacherExamResultQueries(
  queryClient: QueryClient,
  examId: number,
): Promise<unknown[]> {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: teacherResultsQueryKeys.scoreEntryResults(examId) }),
    queryClient.invalidateQueries({ queryKey: teacherResultsQueryKeys.teacherExamResults(examId) }),
    queryClient.invalidateQueries({ queryKey: teacherResultsQueryKeys.detail(examId) }),
    queryClient.invalidateQueries({ queryKey: teacherResultsQueryKeys.statsExamResults(examId) }),
    queryClient.invalidateQueries({ queryKey: teacherResultsQueryKeys.sessionExamResults(examId) }),
  ]);
}
