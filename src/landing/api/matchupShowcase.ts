// PATH: src/landing/api/matchupShowcase.ts
// 매치업 적중보고서 공개 게시판 API client (Phase #69, 2026-05-13).
//
// backend: apps/domains/landing_public/api/views/matchup_showcase_views.py
//
// 학원장 (admin/owner) 1버튼 publish + 게시물 CRUD.
// 게시 시점에 적중보고서 PDF가 R2 스냅샷으로 박힘. 이후 원본 변동 무관.

import api, { type ApiRequestConfig } from "@/shared/api/axios";

export type MatchupShowcaseStatus = "draft" | "published" | "expired" | "hidden";

export interface MatchupShowcaseMeta {
  document_title?: string;
  document_id?: number;
  author_name?: string;
  report_title?: string;
  report_status?: string;
  total_entries?: number;
  counted_entries?: number;
  hit_count?: number;
  hit_rate?: number;
  snapshot_at_iso?: string;
}

export interface MatchupShowcaseCard {
  id: number;
  title: string;
  description: string;
  status: MatchupShowcaseStatus;
  published_at: string | null;
  published_until: string | null;
  snapshot_at: string | null;
  snapshot_meta: MatchupShowcaseMeta;
  view_count: number;
  expired: boolean;
  visible: boolean;
  hit_report_id_ref: number | null;
  pdf_url?: string | null;
}

export interface MatchupShowcaseListResponse {
  results: MatchupShowcaseCard[];
  count: number;
}

const BASE = "/landing-public/matchup-showcase";

/** 공개/내부 list — 비로그인 OK (PUBLISHED + window). staff 시점에 DRAFT/HIDDEN 까지. */
export async function fetchMatchupShowcaseList(opts?: { skipAuth?: boolean }): Promise<MatchupShowcaseListResponse> {
  const cfg: ApiRequestConfig | undefined = opts?.skipAuth ? ({ skipAuth: true } as ApiRequestConfig) : undefined;
  const { data } = await api.get<MatchupShowcaseListResponse>(`${BASE}/`, cfg);
  return data;
}

/** 단건 상세 (PDF URL 포함, visible 일 때만). */
export async function fetchMatchupShowcaseDetail(id: number, opts?: { skipAuth?: boolean }): Promise<MatchupShowcaseCard> {
  const cfg: ApiRequestConfig | undefined = opts?.skipAuth ? ({ skipAuth: true } as ApiRequestConfig) : undefined;
  const { data } = await api.get<MatchupShowcaseCard>(`${BASE}/${id}/`, cfg);
  return data;
}

/** staff publish — hit_report_id 로부터 PDF snapshot 생성 + 게시. */
export async function publishMatchupShowcase(payload: {
  hit_report_id: number;
  title?: string;
  description?: string;
  published_at?: string | null;
  published_until?: string | null;
}): Promise<MatchupShowcaseCard> {
  const { data } = await api.post<MatchupShowcaseCard>(`${BASE}/publish/`, payload);
  return data;
}

/** staff: title/description/visibility 수정 (스냅샷 자체는 immutable). */
export async function updateMatchupShowcase(id: number, payload: {
  title?: string;
  description?: string;
  published_at?: string | null;
  published_until?: string | null;
  status?: MatchupShowcaseStatus;
}): Promise<MatchupShowcaseCard> {
  const { data } = await api.patch<MatchupShowcaseCard>(`${BASE}/${id}/`, payload);
  return data;
}

/** staff: 비공개(HIDDEN). 스냅샷 보존, 일반인 차단. */
export async function unpublishMatchupShowcase(id: number): Promise<MatchupShowcaseCard> {
  const { data } = await api.post<MatchupShowcaseCard>(`${BASE}/${id}/unpublish/`);
  return data;
}

/** staff: 삭제 (soft → HIDDEN). 스냅샷 R2 객체 보존. */
export async function deleteMatchupShowcase(id: number): Promise<void> {
  await api.delete(`${BASE}/${id}/`);
}
