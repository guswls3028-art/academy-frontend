import { useEffect, useState } from "react";
import { ApiClient } from "../api/client";
import { resultsEndpoints } from "../api/endpoints";
import { AdminExamSummary } from "../types/results.types";

export function useExamSummary(api: ApiClient, examId?: number) {
  const [data, setData] = useState<AdminExamSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!examId) return;
    let cancelled = false;

    setLoading(true);
    setError(null);

    api.get<AdminExamSummary>(resultsEndpoints.adminExamSummary(examId))
      .then((res) => !cancelled && setData(res))
      .catch((e) => !cancelled && setError(String(e?.message || e)))
      .finally(() => !cancelled && setLoading(false));

    return () => { cancelled = true; };
  }, [api, examId]);

  return { data, loading, error };
}
