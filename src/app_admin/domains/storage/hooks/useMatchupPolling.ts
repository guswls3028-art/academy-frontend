// PATH: src/app_admin/domains/storage/hooks/useMatchupPolling.ts
// 매치업 문서 처리 상태 폴링 훅

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { fetchJobProgress } from "../api/matchup.api";
import type { MatchupDocument } from "../api/matchup.api";

/**
 * processing 상태인 문서들의 AI job 진행률을 폴링.
 * 완료/실패 감지 시 문서 목록 invalidate.
 */
export function useMatchupPolling(documents: MatchupDocument[]) {
  const qc = useQueryClient();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const processingDocs = documents.filter((d) => d.status === "processing" && d.ai_job_id);

  useEffect(() => {
    if (processingDocs.length === 0) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    const poll = async () => {
      for (const doc of processingDocs) {
        const progress = await fetchJobProgress(doc.ai_job_id);
        if (progress && progress.percent >= 100) {
          qc.invalidateQueries({ queryKey: ["matchup-documents"] });
          qc.invalidateQueries({ queryKey: ["matchup-problems"] });
          return;
        }
      }
    };

    intervalRef.current = setInterval(poll, 3000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [processingDocs.map((d) => d.id).join(",")]);
}
