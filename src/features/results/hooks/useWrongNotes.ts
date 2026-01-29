import { useEffect, useMemo, useState } from "react";
import { ApiClient } from "../api/client";
import { resultsEndpoints } from "../api/endpoints";
import { WrongNoteListResponse } from "../types/results.types";

export type WrongNoteQuery = {
  enrollmentId: number;
  examId?: number;
  lectureId?: number;
  fromSessionOrder?: number;
  offset?: number;
  limit?: number;
};

export function useWrongNotes(api: ApiClient, q?: WrongNoteQuery) {
  const [data, setData] = useState<WrongNoteListResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const key = useMemo(() => {
    if (!q) return "";
    return JSON.stringify(q);
  }, [q]);

  useEffect(() => {
    if (!q?.enrollmentId) return;
    let cancelled = false;

    setLoading(true);
    setError(null);

    api.get<WrongNoteListResponse>(
      resultsEndpoints.wrongNotes({
        enrollment_id: q.enrollmentId,
        exam_id: q.examId,
        lecture_id: q.lectureId,
        from_session_order: q.fromSessionOrder,
        offset: q.offset,
        limit: q.limit,
      })
    )
      .then((res) => !cancelled && setData(res))
      .catch((e) => !cancelled && setError(String(e?.message || e)))
      .finally(() => !cancelled && setLoading(false));

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, key]);

  return { data, loading, error };
}
