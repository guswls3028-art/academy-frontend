// src/features/results/panels/AdminExamAnalyticsPanel.tsx

import { useQuery } from "@tanstack/react-query";
import api from "@/shared/api/axios";
import type { SessionScoreSummary, QuestionStat, TopWrongQuestion } from "../types/results.types";

type Props = {
  sessionId: number;
  examId: number;
};

type QuestionStatsResponse = {
  count: number;
  next: number | null;
  previous: number | null;
  results: QuestionStat[];
};

async function fetchSessionScoreSummary(sessionId: number): Promise<SessionScoreSummary> {
  const res = await api.get(`/results/admin/sessions/${sessionId}/score-summary/`);
  return res.data as SessionScoreSummary;
}

async function fetchQuestionStats(examId: number): Promise<QuestionStat[]> {
  const res = await api.get(`/results/admin/exams/${examId}/questions/`);
  const data = res.data;
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  return [];
}

async function fetchTopWrong(examId: number, n = 5): Promise<TopWrongQuestion[]> {
  const res = await api.get(`/results/admin/exams/${examId}/questions/top-wrong/?n=${n}`);
  return Array.isArray(res.data) ? (res.data as TopWrongQuestion[]) : [];
}

export default function AdminExamAnalyticsPanel({ sessionId, examId }: Props) {
  const sessionQ = useQuery({
    queryKey: ["session-score-summary-results", sessionId],
    queryFn: () => fetchSessionScoreSummary(sessionId),
    enabled: Number.isFinite(sessionId),
  });

  const qsQ = useQuery({
    queryKey: ["exam-question-stats", examId], // ✅ exams/ExamSetupPanel invalidate랑 키 맞춤
    queryFn: () => fetchQuestionStats(examId),
    enabled: Number.isFinite(examId),
  });

  const topWrongQ = useQuery({
    queryKey: ["exam-top-wrong", examId],
    queryFn: () => fetchTopWrong(examId, 5),
    enabled: Number.isFinite(examId),
  });

  if (sessionQ.isLoading || qsQ.isLoading) return <div>로딩중...</div>;
  if (sessionQ.isError || qsQ.isError) return <div className="text-red-600">통계 조회 실패</div>;

  const attemptStats = sessionQ.data?.attempt_stats;

  return (
    <div className="space-y-4 text-sm">
      {sessionQ.data && (
        <div className="rounded border p-3">
          <div>세션 평균: {sessionQ.data.avg_score ?? "-"}</div>
          <div>
            재시험 비율:{" "}
            {typeof attemptStats?.retake_ratio === "number"
              ? `${(attemptStats.retake_ratio * 100).toFixed(1)}%`
              : "-"}
          </div>
        </div>
      )}

      <div>
        <div className="mb-1 font-semibold">문항별 통계</div>
        <ul>
          {(qsQ.data ?? []).map((q) => (
            <li key={q.question_id}>
              Q{q.question_id} — 정답률 {(q.accuracy * 100).toFixed(1)}%
            </li>
          ))}
        </ul>
      </div>

      <div>
        <div className="mb-1 font-semibold">Top Wrong</div>
        <ul>
          {(topWrongQ.data ?? []).map((t) => (
            <li key={t.question_id}>
              Q{t.question_id}: {t.wrong_count}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
