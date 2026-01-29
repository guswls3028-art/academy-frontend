import { useCallback, useEffect, useRef, useState } from "react";
import { ApiClient } from "../api/client";
import { resultsEndpoints } from "../api/endpoints";
import {
  WrongNotePdfCreateResponse,
  WrongNotePdfStatusResponse,
} from "../types/results.types";

export type CreatePdfPayload = {
  enrollment_id: number;
  lecture_id?: number;
  exam_id?: number;
  from_session_order?: number;
};

export function useWrongNotePDF(api: ApiClient) {
  const [job, setJob] = useState<WrongNotePdfStatusResponse | null>(null);
  const [creating, setCreating] = useState(false);
  const [polling, setPolling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const timerRef = useRef<number | null>(null);

  const stopPolling = useCallback(() => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
    setPolling(false);
  }, []);

  const pollStatus = useCallback((jobId: number) => {
    stopPolling();
    setPolling(true);

    timerRef.current = window.setInterval(async () => {
      try {
        const res = await api.get<WrongNotePdfStatusResponse>(
          resultsEndpoints.wrongNotePdfStatus(jobId)
        );
        setJob(res);

        if (res.status === "DONE" || res.status === "FAILED") {
          stopPolling();
        }
      } catch (e: any) {
        setError(String(e?.message || e));
        stopPolling();
      }
    }, 2000);
  }, [api, stopPolling]);

  const create = useCallback(async (payload: CreatePdfPayload) => {
    setCreating(true);
    setError(null);
    setJob(null);

    try {
      const created = await api.post<WrongNotePdfCreateResponse>(
        resultsEndpoints.wrongNotePdfCreate,
        payload
      );

      const jobId = created.job_id;
      // 즉시 1회 fetch 후 polling
      const first = await api.get<WrongNotePdfStatusResponse>(
        resultsEndpoints.wrongNotePdfStatus(jobId)
      );
      setJob(first);

      if (first.status !== "DONE" && first.status !== "FAILED") {
        pollStatus(jobId);
      }
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setCreating(false);
    }
  }, [api, pollStatus]);

  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  return {
    job,
    creating,
    polling,
    error,
    create,
    stopPolling,
  };
}
