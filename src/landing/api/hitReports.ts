// PATH: src/landing/api/hitReports.ts
// Public landing hit-report metadata fetch with module-level de-duplication.

import api, { type ApiRequestConfig } from "@/shared/api/axios";
import type { HitReportPublicCard } from "../types";

const hitReportsCache = new Map<string, HitReportPublicCard[]>();
const hitReportsInflight = new Map<string, Promise<HitReportPublicCard[]>>();

export function normalizeHitReportIds(ids: number[]): number[] {
  return Array.from(
    new Set((ids || []).filter((n) => Number.isFinite(n)).map((n) => Number(n))),
  );
}

export function hitReportIdsKey(ids: number[]): string {
  return normalizeHitReportIds(ids).sort((a, b) => a - b).join(",");
}

function orderReportsByIds(reports: HitReportPublicCard[], ids: number[]): HitReportPublicCard[] {
  const byId = new Map(reports.map((report) => [report.id, report]));
  return ids
    .map((id) => byId.get(id))
    .filter((report): report is HitReportPublicCard => Boolean(report));
}

export function fetchPublicHitReportsCached(ids: number[]): Promise<HitReportPublicCard[]> {
  const normalized = normalizeHitReportIds(ids);
  if (!normalized.length) return Promise.resolve([]);

  const key = hitReportIdsKey(normalized);
  const cached = hitReportsCache.get(key);
  if (cached) return Promise.resolve(orderReportsByIds(cached, normalized));
  const inflight = hitReportsInflight.get(key);
  if (inflight) return inflight.then((reports) => orderReportsByIds(reports, normalized));

  const request = api.get(
    "/matchup/landing/public/",
    { params: { ids: key }, skipAuth: true } as ApiRequestConfig,
  ).then((r) => {
    const reports = Array.isArray(r?.data?.reports)
      ? r.data.reports as HitReportPublicCard[]
      : [];
    hitReportsCache.set(key, reports);
    hitReportsInflight.delete(key);
    return reports;
  }).catch((e) => {
    hitReportsInflight.delete(key);
    throw e;
  });

  hitReportsInflight.set(key, request);
  return request.then((reports) => orderReportsByIds(reports, normalized));
}
