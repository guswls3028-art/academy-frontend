// PATH: src/app_admin/domains/storage/hooks/useMatchupPolling.ts
// 매치업 문서 처리 상태 폴링 훅
//
// 역할:
//  - status === "processing" 문서들의 AI job 진행률을 3초 간격 폴링
//  - N개 문서를 Promise.allSettled로 병렬 fetch (3초 주기 보장)
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
      // 병렬 fetch — 순차 await 루프를 제거해 3초 주기 보장
      const results = await Promise.allSettled(
        processingDocs.map((doc) =>
          fetchJobProgress(doc.ai_job_id).then((env) => ({ doc, env })),
        ),
      );

      let anyComplete = false;
      const next: DocProgressMap = {};
      const terminalDocIds = new Set<number>();

      for (const r of results) {
        if (r.status !== "fulfilled") continue;
        const { doc, env } = r.value;
        if (!env) continue;

        if (env.status === "DONE" || env.status === "FAILED" || env.status === "CANCELLED") {
          anyComplete = true;
          terminalDocIds.add(doc.id);
          continue;
        }

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
      // terminal 상태 doc은 progress 맵에서 제거 (이전 진행률 잔여 방지)
      setProgressMap((prev) => {
        const merged = { ...prev, ...next };
        for (const id of terminalDocIds) delete merged[id];
        return merged;
      });
      if (anyComplete) {
        qc.invalidateQueries({ queryKey: ["matchup-documents"] });
        qc.invalidateQueries({ queryKey: ["matchup-problems"] });
      } else {
        // 진행 중에도 problems 쿼리 invalidate — 백엔드 파이프라인이 세그멘테이션
        // 직후 skeleton MatchupProblem rows를 INSERT하므로, 신규 업로드 사용자에게
        // 즉시 부분 결과 노출하기 위해 polling 주기마다 갱신.
        // (terminal 시점에만 invalidate하던 결함 — 신규 업로드 doc은 끝까지 빈 화면)
        qc.invalidateQueries({ queryKey: ["matchup-problems"] });
      }
    };

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
