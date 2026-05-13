// PATH: src/landing/api/publicCommunity.ts
//
// 랜딩 공개 커뮤니티(자유게시판/수강후기) API wrapper.
// backend `apps/domains/landing_public/` 도메인과 1:1 매핑.
// family-only community.PostEntity 와는 완전 별개 트랙.

import api, { type ApiRequestConfig } from "@/shared/api/axios";

// ─── Types ───

export type BoardCategory = "free" | "tip" | "story" | "question" | "other";
export type BoardStatus = "published" | "hidden" | "deleted";
export type ReviewStatus = "pending" | "approved" | "rejected" | "hidden";
export type Ordering = "latest" | "likes" | "replies" | "rating";
export type ReplyTargetKind = "board" | "review";

export interface PublicBoardPost {
  id: number;
  title: string;
  category: BoardCategory;
  cover_image_url: string;
  display_name: string;
  author_role: string;
  is_anonymous: boolean;
  is_pinned: boolean;
  is_hot: boolean;
  like_count: number;
  reply_count: number;
  view_count: number;
  external_visible: boolean;
  status: BoardStatus;
  created_at: string;
  updated_at: string;
}

export interface PublicBoardPostDetail extends PublicBoardPost {
  content: string;
  meta: Record<string, unknown>;
  is_owner_or_author: boolean;
}

export interface PublicReview {
  id: number;
  rating: number;
  title: string;
  display_name: string;
  author_role: string;
  is_anonymous: boolean;
  grade: string;
  subject: string;
  enrollment_months: number;
  cover_image_url: string;
  is_pinned: boolean;
  is_verified: boolean;
  status: ReviewStatus;
  like_count: number;
  reply_count: number;
  created_at: string;
  updated_at: string;
}

export interface PublicReviewDetail extends PublicReview {
  content: string;
  photos: string[];
}

export interface PublicReply {
  id: number;
  target_kind: ReplyTargetKind;
  target_id: number;
  display_name: string;
  author_role: string;
  is_anonymous: boolean;
  is_owner_reply: boolean;
  content: string;
  parent_reply: number | null;
  is_hidden: boolean;
  like_count: number;
  created_at: string;
  /** 현재 viewer가 본 댓글 작성자 본인인가 (backend serializer SerializerMethodField). */
  is_mine: boolean;
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface ReviewsSummary {
  count: number;
  average: number;
  distribution: Record<string, number>;
}

export interface CommunityStats {
  reviews_week: number;
  board_week: number;
  reviews_total: number;
  board_total: number;
  average_rating: number;
  window_days: number;
}

// ─── Board ───

export async function fetchBoardList(params: {
  page?: number;
  page_size?: number;
  category?: BoardCategory | "";
  ordering?: Ordering;
  q?: string;
} = {}): Promise<PaginatedResponse<PublicBoardPost>> {
  const { data } = await api.get<PaginatedResponse<PublicBoardPost>>(
    "/landing-public/board/",
    { params, skipAuth: true } as ApiRequestConfig,
  );
  return data;
}

export async function fetchBoardDetail(id: number): Promise<PublicBoardPostDetail> {
  const { data } = await api.get<PublicBoardPostDetail>(
    `/landing-public/board/${id}/`,
    { skipAuth: true } as ApiRequestConfig,
  );
  return data;
}

export async function createBoardPost(payload: {
  title: string;
  content: string;
  category?: BoardCategory;
  cover_image_url?: string;
  is_anonymous?: boolean;
  meta?: Record<string, unknown>;
}): Promise<PublicBoardPostDetail> {
  const { data } = await api.post<PublicBoardPostDetail>("/landing-public/board/", payload);
  return data;
}

export async function updateBoardPost(id: number, payload: Partial<{
  title: string;
  content: string;
  category: BoardCategory;
  cover_image_url: string;
  is_anonymous: boolean;
  meta: Record<string, unknown>;
}>): Promise<PublicBoardPostDetail> {
  const { data } = await api.patch<PublicBoardPostDetail>(`/landing-public/board/${id}/`, payload);
  return data;
}

export async function deleteBoardPost(id: number): Promise<void> {
  await api.delete(`/landing-public/board/${id}/`);
}

export async function toggleBoardLike(id: number): Promise<{ liked: boolean; like_count: number }> {
  const { data } = await api.post<{ liked: boolean; like_count: number }>(`/landing-public/board/${id}/like/`);
  return data;
}

export async function moderateBoardPost(id: number, payload: Partial<{
  is_pinned: boolean;
  is_hot: boolean;
  external_visible: boolean;
  status: BoardStatus;
}>): Promise<PublicBoardPostDetail> {
  const { data } = await api.post<PublicBoardPostDetail>(`/landing-public/board/${id}/moderate/`, payload);
  return data;
}

// ─── Reviews ───

export async function fetchReviewsList(params: {
  page?: number;
  page_size?: number;
  ordering?: Ordering;
  grade?: string;
  subject?: string;
  min_rating?: number;
} = {}): Promise<PaginatedResponse<PublicReview>> {
  const { data } = await api.get<PaginatedResponse<PublicReview>>(
    "/landing-public/reviews/",
    { params, skipAuth: true } as ApiRequestConfig,
  );
  return data;
}

export async function fetchReviewDetail(id: number): Promise<PublicReviewDetail> {
  const { data } = await api.get<PublicReviewDetail>(
    `/landing-public/reviews/${id}/`,
    { skipAuth: true } as ApiRequestConfig,
  );
  return data;
}

export async function fetchReviewsSummary(): Promise<ReviewsSummary> {
  const { data } = await api.get<ReviewsSummary>(
    "/landing-public/reviews/summary/",
    { skipAuth: true } as ApiRequestConfig,
  );
  return data;
}

export async function createReview(payload: {
  rating: number;
  title?: string;
  content: string;
  grade?: string;
  subject?: string;
  enrollment_months?: number;
  cover_image_url?: string;
  photos?: string[];
  is_anonymous?: boolean;
}): Promise<PublicReviewDetail> {
  const { data } = await api.post<PublicReviewDetail>("/landing-public/reviews/", payload);
  return data;
}

export async function updateReview(id: number, payload: Partial<{
  rating: number;
  title: string;
  content: string;
  grade: string;
  subject: string;
  enrollment_months: number;
  cover_image_url: string;
  photos: string[];
  is_anonymous: boolean;
}>): Promise<PublicReviewDetail> {
  const { data } = await api.patch<PublicReviewDetail>(`/landing-public/reviews/${id}/`, payload);
  return data;
}

export async function deleteReview(id: number): Promise<void> {
  await api.delete(`/landing-public/reviews/${id}/`);
}

export async function toggleReviewLike(id: number): Promise<{ liked: boolean; like_count: number }> {
  const { data } = await api.post<{ liked: boolean; like_count: number }>(`/landing-public/reviews/${id}/like/`);
  return data;
}

export async function moderateReview(id: number, payload: Partial<{
  status: ReviewStatus;
  is_pinned: boolean;
  is_verified: boolean;
}>): Promise<PublicReviewDetail> {
  const { data } = await api.post<PublicReviewDetail>(`/landing-public/reviews/${id}/moderate/`, payload);
  return data;
}

// ─── Replies ───

export async function fetchReplies(target: { kind: ReplyTargetKind; id: number }): Promise<{ results: PublicReply[]; count: number }> {
  const { data } = await api.get<{ results: PublicReply[]; count: number }>(
    "/landing-public/replies/",
    { params: { target: `${target.kind}:${target.id}` }, skipAuth: true } as ApiRequestConfig,
  );
  return data;
}

export async function createReply(payload: {
  target_kind: ReplyTargetKind;
  target_id: number;
  content: string;
  parent_reply?: number;
  is_anonymous?: boolean;
}): Promise<PublicReply> {
  const { data } = await api.post<PublicReply>("/landing-public/replies/", payload);
  return data;
}

export async function deleteReply(id: number): Promise<void> {
  await api.delete(`/landing-public/replies/${id}/`);
}

export async function toggleReplyLike(id: number): Promise<{ liked: boolean; like_count: number }> {
  const { data } = await api.post<{ liked: boolean; like_count: number }>(`/landing-public/replies/${id}/like/`);
  return data;
}

// ─── Reports (신고) ───

export type ReportTargetKind = "board" | "review" | "reply";
export type ReportReason = "spam" | "abuse" | "false" | "copyright" | "privacy" | "other";
export type ReportStatus = "pending" | "reviewed" | "dismissed";

export interface ReportEntry {
  id: number;
  target_kind: ReportTargetKind;
  target_id: number;
  target_preview: string | null;
  target_status: string | null;
  reason: ReportReason;
  description: string;
  status: ReportStatus;
  action_taken: string;
  reporter_id: number | null;
  reporter_ip: string | null;
  reviewed_by_id: number | null;
  reviewed_at: string | null;
  created_at: string;
}

export interface ModerationSummary {
  pending_reports: number;
  pending_reviews: number;
}

export async function submitReport(payload: {
  target_kind: ReportTargetKind;
  target_id: number;
  reason: ReportReason;
  description?: string;
}): Promise<{ id: number; status: ReportStatus }> {
  const { data } = await api.post<{ id: number; status: ReportStatus }>(
    "/landing-public/reports/", payload,
    { skipAuth: true } as ApiRequestConfig,
  );
  return data;
}

export async function fetchReportsList(params: {
  status?: ReportStatus | "";
  target_kind?: ReportTargetKind | "";
  page?: number;
  page_size?: number;
} = {}): Promise<{ results: ReportEntry[]; count: number; next?: string | null; previous?: string | null }> {
  const { data } = await api.get<{ results: ReportEntry[]; count: number }>(
    "/landing-public/reports/", { params } as ApiRequestConfig,
  );
  return data;
}

export async function reviewReport(id: number, payload: {
  action: "reviewed" | "dismissed";
  target_action?: "hide" | "reject";
}): Promise<{ id: number; status: ReportStatus; action_taken: string }> {
  const { data } = await api.post<{ id: number; status: ReportStatus; action_taken: string }>(
    `/landing-public/reports/${id}/review/`, payload,
  );
  return data;
}

export async function fetchModerationSummary(): Promise<ModerationSummary> {
  const { data } = await api.get<ModerationSummary>("/landing-public/reports/summary/");
  return data;
}

// ─── User Blocks (블랙리스트) ───

export interface UserBlockEntry {
  id: number;
  blocked_user_id: number;
  blocked_user_name: string;
  reason: string;
  created_at: string;
}

export async function fetchUserBlocks(): Promise<{ results: UserBlockEntry[]; count: number }> {
  const { data } = await api.get<{ results: UserBlockEntry[]; count: number }>("/landing-public/blocks/");
  return data;
}

export async function blockUser(user_id: number, reason = ""): Promise<{ id: number; blocked_user_id: number }> {
  const { data } = await api.post<{ id: number; blocked_user_id: number }>("/landing-public/blocks/", { user_id, reason });
  return data;
}

export async function unblockUser(user_id: number): Promise<{ deleted: number }> {
  const { data } = await api.delete<{ deleted: number }>("/landing-public/blocks/", { data: { user_id } } as ApiRequestConfig);
  return data;
}

// ─── Exam Showcase (Phase #13 — 성적 통계 랜딩 홍보) ───

export type ShowcaseAnonymization = "initial" | "phone_last4" | "pseudonym";
export type ShowcaseStatus = "draft" | "published" | "expired" | "hidden";

export interface ShowcaseRow {
  display_name: string;
  score: number;
  max_score: number;
  rank: number;
  total: number;
  percent: number;
}

export interface ShowcaseSummary {
  count: number;
  avg: number;
  max: number;
  min: number;
  max_score_full: number;
  exam_title: string;
}

export interface PublicExamShowcase {
  id: number;
  title: string;
  description?: string;
  anonymization_mode: ShowcaseAnonymization;
  status: ShowcaseStatus;
  published_at: string | null;
  published_until: string | null;
  summary: ShowcaseSummary;
  view_count: number;
  expired: boolean;
  rows?: ShowcaseRow[];
}

export async function fetchShowcaseList(): Promise<{ results: PublicExamShowcase[]; count: number }> {
  const { data } = await api.get<{ results: PublicExamShowcase[]; count: number }>(
    "/landing-public/showcase/",
    { skipAuth: true } as ApiRequestConfig,
  );
  return data;
}

export async function fetchShowcaseDetail(id: number): Promise<PublicExamShowcase> {
  const { data } = await api.get<PublicExamShowcase>(
    `/landing-public/showcase/${id}/`,
    { skipAuth: true } as ApiRequestConfig,
  );
  return data;
}

export async function publishExamShowcase(payload: {
  exam_id: number;
  title: string;
  description?: string;
  anonymization_mode?: ShowcaseAnonymization;
  published_until?: string | null;
}): Promise<{ id: number; title: string; status: ShowcaseStatus; summary: ShowcaseSummary }> {
  const { data } = await api.post("/landing-public/showcase/publish/", payload);
  return data;
}

export async function unpublishExamShowcase(id: number): Promise<{ id: number; status: ShowcaseStatus }> {
  const { data } = await api.post(`/landing-public/showcase/${id}/unpublish/`);
  return data;
}

export async function refreshShowcaseSnapshot(id: number): Promise<{ id: number; summary: ShowcaseSummary }> {
  const { data } = await api.post(`/landing-public/showcase/${id}/refresh/`);
  return data;
}

export async function deleteShowcase(id: number): Promise<void> {
  await api.delete(`/landing-public/showcase/${id}/`);
}

// ─── Review photo upload (Phase 4-D) ───

export async function uploadReviewPhoto(file: File): Promise<{ key: string; url: string }> {
  const fd = new FormData();
  fd.append("file", file);
  const { data } = await api.post<{ key: string; url: string }>(
    "/landing-public/uploads/review-photo/",
    fd,
    { headers: { "Content-Type": "multipart/form-data" } },
  );
  return data;
}

// ─── Stats (메인 KPI band) ───

export async function fetchCommunityStats(days = 7): Promise<CommunityStats> {
  const { data } = await api.get<CommunityStats>(
    "/landing-public/stats/",
    { params: { days }, skipAuth: true } as ApiRequestConfig,
  );
  return data;
}
