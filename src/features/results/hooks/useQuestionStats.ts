import { useEffect, useState } from "react";
import { ApiClient } from "../api/client";
import { resultsEndpoints } from "../api/endpoints";
import { QuestionStat, TopWrongQuestion } from "../types/results.types";

/**
 * ✅ pagination 대응 버전
 */
type QuestionStatsResponse = {
  count: number;
  next: number | null;
  previous: number | null;
  results: QuestionStat[];
};

export function useQuestionStats(api: ApiClient, examId?: number) {
  const [stats, setStats] = useState<QuestionStat[]>([]);
  const [topWrong, setTopWrong] = useState<TopWrongQuestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!examId) return;
    let cancelled = false;

    setLoading(true);
    setError(null);

    Promise.all([
      api.get<QuestionStatsResponse>(
        resultsEndpoints.questionStats(examId)
      ),
      api.get<TopWrongQuestion[]>(
        resultsEndpoints.topWrongQuestions(examId, 5)
      ),
    ])
      .then(([statsRes, topWrongRes]) => {
        if (cancelled) return;

        // ✅ 핵심 FIX
        setStats(
          Array.isArray(statsRes?.results)
            ? statsRes.results
            : []
        );

        setTopWrong(Array.isArray(topWrongRes) ? topWrongRes : []);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(String(e?.message || e));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [api, examId]);

  return { stats, topWrong, loading, error };
}
