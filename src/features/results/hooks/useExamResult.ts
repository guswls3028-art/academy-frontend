import { useEffect, useState } from "react";
import { ApiClient } from "../api/client";
import { resultsEndpoints } from "../api/endpoints";
import { StudentExamResult } from "../types/results.types";

export function useExamResult(api: ApiClient, examId?: number) {
  const [data, setData] = useState<StudentExamResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!examId) return;
    let cancelled = false;

    setLoading(true);
    setError(null);

    api.get<StudentExamResult>(resultsEndpoints.myExamResult(examId))
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch((e) => {
        if (!cancelled) setError(String(e?.message || e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [api, examId]);

  return { data, loading, error };
}
