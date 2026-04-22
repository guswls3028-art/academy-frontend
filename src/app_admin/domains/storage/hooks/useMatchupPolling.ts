// PATH: src/app_admin/domains/storage/hooks/useMatchupPolling.ts
// 매치업 문서 처리 상태 폴링 훅
//
// 역할:
//  - status === "processing" 문서들의 AI job 진행률을 3초 간격 폴링
//  - 완료/실패(100%) 감지 시 문서 목록 invalidate
//  - 각 doc_id별 진행률(percent, step_name_display)을 반환 → UI에서 표시

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { fetchJobProgress } from "../api/matchup.api";
import type { MatchupDocument } from "../api/matchup.api";

export type DocProgress = {
  percent: number;
  stepName: string;
};

export type DocProgressMap = Record<number, DocProgress>;

export function useMatchupPolling(documents: MatchupDocument[]): DocProgressMap {
  const qc = useQueryClient();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [progressMap, setProgressMap] = useState<DocProgressMap>({});

  const processingDocs = documents.filter(
    (d) => d.status === "processing" && d.ai_job_id,
  );
  const processingKey = processingDocs
    .map((d) => `${d.id}:${d.ai_job_id}`)
    .join(",");

  useEffect(() => {
    if (processingDocs.length === 0) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      // 처리중 문서 없을 때 진행률 맵 정리
      setProgressMap({});
      return;
    }

    let cancelled = false;

    const poll = async () => {
      let anyComplete = false;
      const next: DocProgressMap = {};
      for (const doc of processingDocs) {
        const progress = await fetchJobProgress(doc.ai_job_id);
        if (!progress) continue;
        const pct = typeof progress.percent === "number" ? progress.percent : 0;
        next[doc.id] = {
          percent: pct,
          stepName: progress.step_name_display || progress.step || "처리 중",
        };
        if (pct >= 100) anyComplete = true;
      }
      if (cancelled) return;
      setProgressMap((prev) => ({ ...prev, ...next }));
      if (anyComplete) {
        qc.invalidateQueries({ queryKey: ["matchup-documents"] });
        qc.invalidateQueries({ queryKey: ["matchup-problems"] });
      }
    };

    // 첫 폴은 즉시, 이후 3초 간격
    void poll();
    intervalRef.current = setInterval(poll, 3000);
    return () => {
      cancelled = true;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [processingKey]);

  return progressMap;
}
