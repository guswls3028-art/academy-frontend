import { useEffect, useState } from "react";
import { ApiClient } from "../api/client";
import { resultsEndpoints } from "../api/endpoints";
import { SessionScoreSummary } from "../types/results.types";

export function useSessionScoreSummary(api: ApiClient, sessionId?: number) {
  const [data, setData] = useState<SessionScoreSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;

    setLoading(true);
    setError(null);

    api.get<SessionScoreSummary>(resultsEndpoints.sessionScoreSummary(sessionId))
      .then((res) => !cancelled && setData(res))
      .catch((e) => !cancelled && setError(String(e?.message || e)))
      .finally(() => !cancelled && setLoading(false));

    return () => { cancelled = true; };
  }, [api, sessionId]);

  return { data, loading, error };
}
