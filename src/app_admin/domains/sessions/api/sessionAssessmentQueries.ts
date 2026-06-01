// PATH: src/app_admin/domains/sessions/api/sessionAssessmentQueries.ts
import type { QueryClient } from "@tanstack/react-query";

import api from "@/shared/api/axios";
import { scoresQueryKeys } from "@/shared/api/queryKeys/scores";
import { fetchHomeworks, type HomeworkListItem } from "@admin/domains/homework/api/homeworks";
import { QUERY_KEYS as HOMEWORK_QUERY_KEYS } from "@admin/domains/homework/queryKeys";
import type { SessionExamRow } from "@admin/domains/results/api/adminSessionExams";

export type SessionExamSummaryRow = {
  exam_id: number;
  max_score?: number | null;
  highest_score?: number | null;
  pass_score?: number | null;
  participant_count?: number | null;
};

export type SessionExamsSummary = {
  session_id?: number;
  exams?: SessionExamSummaryRow[];
};

export const sessionAssessmentQueryKeys = {
  exams: (sessionId: number) => ["admin-session-exams", sessionId] as const,
  examsSummary: (sessionId: number) => ["session-exams-summary", sessionId] as const,
  homeworks: (sessionId: number) => ["session-homeworks", sessionId] as const,
  homeworkPolicy: HOMEWORK_QUERY_KEYS.HOMEWORK_POLICY,
};

export async function fetchSessionExamsSummary(sessionId: number): Promise<SessionExamsSummary> {
  const res = await api.get(`/results/admin/sessions/${sessionId}/exams/summary/`);
  return res.data as SessionExamsSummary;
}

export async function fetchSessionHomeworks(sessionId: number): Promise<HomeworkListItem[]> {
  return fetchHomeworks({ session_id: sessionId });
}

export function removeSessionExamFromQueryCache(
  qc: QueryClient,
  { sessionId, examId }: { sessionId: number; examId: number },
) {
  qc.setQueryData<SessionExamRow[]>(sessionAssessmentQueryKeys.exams(sessionId), (prev) =>
    Array.isArray(prev) ? prev.filter((exam) => Number(exam.exam_id) !== examId) : prev
  );

  qc.setQueryData<SessionExamsSummary>(sessionAssessmentQueryKeys.examsSummary(sessionId), (prev) => {
    if (!prev || !Array.isArray(prev.exams)) return prev;
    return {
      ...prev,
      exams: prev.exams.filter((exam) => Number(exam.exam_id) !== examId),
    };
  });
}

export async function invalidateSessionExamQueries(
  qc: QueryClient,
  { sessionId, examId }: { sessionId: number; examId?: number },
) {
  await Promise.all([
    qc.invalidateQueries({ queryKey: sessionAssessmentQueryKeys.exams(sessionId) }),
    qc.invalidateQueries({ queryKey: sessionAssessmentQueryKeys.examsSummary(sessionId) }),
    qc.invalidateQueries({ queryKey: scoresQueryKeys.sessionScores(sessionId) }),
    examId != null
      ? qc.invalidateQueries({ queryKey: ["admin-exam", examId] })
      : Promise.resolve(),
  ]);
}

export async function invalidateSessionHomeworkQueries(qc: QueryClient, sessionId: number) {
  await Promise.all([
    qc.invalidateQueries({ queryKey: sessionAssessmentQueryKeys.homeworks(sessionId) }),
    qc.invalidateQueries({ queryKey: scoresQueryKeys.sessionScores(sessionId) }),
  ]);
}
