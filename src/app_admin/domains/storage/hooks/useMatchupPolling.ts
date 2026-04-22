// PATH: src/app_admin/domains/storage/hooks/useMatchupPolling.ts
// 매치업 문서 처리 상태 폴링 훅
//
// 역할:
//  - status === "processing" 문서들의 AI job 진행률을 3초 간격 폴링
//  - 완료(status=DONE)/실패(FAILED) 감지 시 문서 목록 invalidate
//  - 각 doc_id별 진행률(percent, step_name_display)을 반환 → UI에서 표시
//
// 응답 구조: { status, progress: {percent, step_name_display, ...}|null }
// 작업이 너무 빨리 끝나면 progress=null + status=DONE 으로 돌아와서 percent 증가 없이 바로 완료됨.

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
      setProgressMap({});
      return;
    }

    let cancelled = false;

    const poll = async () => {
      let anyComplete = false;
      const next: DocProgressMap = {};
      for (const doc of processingDocs) {
        const env = await fetchJobProgress(doc.ai_job_id);
        if (!env) continue;

        // 완료/실패 감지 — DB status는 API 응답에서 이미 업데이트되어 있음
        if (env.status === "DONE" || env.status === "FAILED" || env.status === "CANCELLED") {
          anyComplete = true;
          continue;
        }

        // 진행률 표시 — progress 객체가 있을 때만
        const p = env.progress;
        if (p) {
          const pct = typeof p.percent === "number" ? p.percent : 0;
          next[doc.id] = {
            percent: pct,
            stepName: p.step_name_display || p.step || "처리 중",
          };
          if (pct >= 100) anyComplete = true;
        }
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
