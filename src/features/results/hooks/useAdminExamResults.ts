// FIX: pagination 대응

import { useEffect, useState } from "react";
import { ApiClient } from "../api/client";
import { resultsEndpoints } from "../api/endpoints";
import { AdminExamResultRow } from "../types/results.types";

type AdminExamResultsResponse = {
  count: number;
  next: number | null;
  previous: number | null;
  results: AdminExamResultRow[];
};

export function useAdminExamResults(api: ApiClient, examId?: number) {
  const [rows, setRows] = useState<AdminExamResultRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!examId) return;
    let cancelled = false;

    setLoading(true);
    setError(null);

    api
      .get<AdminExamResultsResponse>(
        resultsEndpoints.adminExamResults(examId)
      )
      .then((res) => {
        if (cancelled) return;
        setRows(Array.isArray(res?.results) ? res.results : []);
      })
      .catch((e) => {
        if (!cancelled) setError(String(e?.message || e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [api, examId]);

  return { rows, loading, error };
}
