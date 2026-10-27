// PATH: src/app_admin/domains/storage/hooks/useMatchupPolling.ts
// 매치업 문서 처리 상태 폴링 훅
//
// 역할:
//  - status === "processing" 문서들의 AI job 진행률을 3초 간격 폴링
//  - 최대 8개 문서를 병렬 조회하고 응답 종료 3초 뒤 다음 조회 (중첩 방지)
//  - 완료(status=DONE)/실패(FAILED) 감지 시 문서 목록 invalidate
//  - 각 doc_id별 진행률(percent, step_name_display)을 반환 → UI에서 표시
//
// 응답 구조: { status, progress: {percent, step_name_display, ...}|null }
// 작업이 너무 빨리 끝나면 progress=null + status=DONE 으로 돌아와서 percent 증가 없이 바로 완료됨.

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createAuthSessionBoundConfig } from "@/shared/api/axios";
import { isTerminalAIJobStatus } from "@/shared/api/contracts/aiJob";
import { readAuthTokenEnvelopeSafely } from "@/shared/auth/tokenSession";
import { getTenantCodeForApiRequest } from "@/shared/tenant";
import { fetchJobProgress } from "../api/matchup.api";
import type { MatchupDocument } from "../api/matchup.api";
import { storageQueryKeys } from "../queryKeys";

const MAX_PROGRESS_POLLS = 8;
const STALE_PROCESSING_MS = 2 * 60 * 60 * 1000;

function updatedAtMs(doc: MatchupDocument): number | null {
  const parsed = Date.parse(doc.updated_at || "");
  return Number.isNaN(parsed) ? null : parsed;
}

export type DocProgress = {
  percent: number;
  stepName: string;
};

export type DocProgressMap = Record<number, DocProgress>;

export function useMatchupPolling(documents: MatchupDocument[]): DocProgressMap {
  const qc = useQueryClient();
  const [progressMap, setProgressMap] = useState<DocProgressMap>({});
  const tenantScope = getTenantCodeForApiRequest();
  const generation = readAuthTokenEnvelopeSafely()?.generation;

  const now = Date.now();
  const processingDocs = documents
    .filter((d) => {
      if (d.status !== "processing" || !d.ai_job_id) return false;
      const updatedAt = updatedAtMs(d);
      return updatedAt === null || now - updatedAt <= STALE_PROCESSING_MS;
    })
    .sort((a, b) => (updatedAtMs(b) ?? 0) - (updatedAtMs(a) ?? 0))
    .slice(0, MAX_PROGRESS_POLLS);
  const processingKey = processingDocs
    .map((d) => `${d.id}:${d.ai_job_id}`)
    .join(",");

  useEffect(() => {
    if (processingDocs.length === 0 || !tenantScope || !generation) {
      setProgressMap({});
      return;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const controller = new AbortController();
    const requestConfig = createAuthSessionBoundConfig(generation, controller.signal, tenantScope);
    const isCurrent = () => !cancelled
      && getTenantCodeForApiRequest() === tenantScope
      && readAuthTokenEnvelopeSafely()?.generation === generation;

    const poll = async () => {
      if (!isCurrent()) return;
      const results = await Promise.allSettled(
        processingDocs.map((doc) =>
          fetchJobProgress(doc.ai_job_id, requestConfig).then((env) => ({ doc, env })),
        ),
      );
      if (!isCurrent()) return;

      let anyComplete = false;
      const next: DocProgressMap = {};
      const terminalDocIds = new Set<number>();

      for (const r of results) {
        if (r.status !== "fulfilled") continue;
        const { doc, env } = r.value;
        if (!env) continue;

        if (isTerminalAIJobStatus(env.status) || env.status === "CANCELLED") {
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

      // terminal 상태 doc은 progress 맵에서 제거 (이전 진행률 잔여 방지)
      setProgressMap((prev) => {
        const activeIds = new Set(processingDocs.map((doc) => doc.id));
        const retained = Object.fromEntries(Object.entries(prev).filter(([id]) => activeIds.has(Number(id))));
        const merged: DocProgressMap = { ...retained, ...next };
        for (const id of terminalDocIds) delete merged[id];
        return merged;
      });
      if (anyComplete) {
        qc.invalidateQueries({ queryKey: storageQueryKeys.matchupDocuments });
        qc.invalidateQueries({ queryKey: storageQueryKeys.matchupProblemsRoot });
      } else {
        // 진행 중에도 problems 쿼리 invalidate — 백엔드 파이프라인이 세그멘테이션
        // 직후 skeleton MatchupProblem rows를 INSERT하므로, 신규 업로드 사용자에게
        // 즉시 부분 결과 노출하기 위해 polling 주기마다 갱신.
        // (terminal 시점에만 invalidate하던 결함 — 신규 업로드 doc은 끝까지 빈 화면)
        qc.invalidateQueries({ queryKey: storageQueryKeys.matchupProblemsRoot });
      }
      timer = setTimeout(() => { void poll(); }, 3000);
    };

    void poll();
    return () => {
      cancelled = true;
      controller.abort();
      if (timer !== undefined) clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [processingKey, tenantScope, generation, qc]);

  return progressMap;
}
