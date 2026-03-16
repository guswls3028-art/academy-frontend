// PATH: src/features/community/viewmodel/postViewModel.ts
// 커뮤니티 게시물 정규화 뷰모델 — 백엔드 엔티티 → UI 표시 규칙 매핑

import type { PostEntity, PostType } from "../api/community.api";

// ────────────────────────────────────────────
// 1. 게시물 유형별 표시 규칙
// ────────────────────────────────────────────

const POST_TYPE_LABELS: Record<PostType, string> = {
  notice: "공지사항",
  board: "게시판",
  materials: "자료실",
  qna: "QnA",
  counsel: "상담 신청",
};

const POST_TYPE_TONES: Record<PostType, string> = {
  notice: "info",
  board: "neutral",
  materials: "accent",
  qna: "warning",
  counsel: "success",
};

export function getPostTypeLabel(postType: PostType | string): string {
  return POST_TYPE_LABELS[postType as PostType] ?? postType;
}

export function getPostTypeTone(postType: PostType | string): string {
  return POST_TYPE_TONES[postType as PostType] ?? "neutral";
}

// ────────────────────────────────────────────
// 2. 작성자 정보 정규화
// ────────────────────────────────────────────

export type AuthorInfo = {
  displayName: string;
  role: "staff" | "student";
  roleLabel: string;
  isDeleted: boolean;
};

export function resolveAuthor(post: {
  created_by?: number | null;
  created_by_display?: string | null;
  created_by_deleted?: boolean;
  author_role?: string;
}): AuthorInfo {
  const isDeleted = post.created_by_deleted === true;
  const role = (post.author_role === "student" ? "student" : "staff") as "staff" | "student";

  let displayName: string;
  if (isDeleted) {
    displayName = "삭제된 사용자";
  } else if (post.created_by_display) {
    displayName = post.created_by_display;
  } else if (post.created_by != null) {
    displayName = "학생";
  } else {
    displayName = "관리자";
  }

  return {
    displayName,
    role,
    roleLabel: role === "student" ? "학생" : "관리자",
    isDeleted,
  };
}

// ────────────────────────────────────────────
// 3. 게시물 상태 정규화
// ────────────────────────────────────────────

export type PostStatus = "pending" | "answered" | "none";

export function resolvePostStatus(post: PostEntity): PostStatus {
  if (post.post_type === "qna" || post.post_type === "counsel") {
    return (post.replies_count ?? 0) > 0 ? "answered" : "pending";
  }
  return "none";
}

export function getStatusLabel(status: PostStatus): string {
  switch (status) {
    case "pending": return "답변 대기";
    case "answered": return "답변 완료";
    default: return "";
  }
}

export function getStatusTone(status: PostStatus): string {
  switch (status) {
    case "pending": return "warning";
    case "answered": return "success";
    default: return "neutral";
  }
}

// ────────────────────────────────────────────
// 4. 첨부파일 정규화
// ────────────────────────────────────────────

export function hasAttachments(post: PostEntity): boolean {
  return (post.attachments?.length ?? 0) > 0;
}

export function attachmentCount(post: PostEntity): number {
  return post.attachments?.length ?? 0;
}

export function hasImageAttachments(post: PostEntity): boolean {
  return (post.attachments ?? []).some((a) => a.content_type.startsWith("image/"));
}

// ────────────────────────────────────────────
// 5. scope 정규화
// ────────────────────────────────────────────

export function getScopeLabel(post: PostEntity): string {
  if (!post.mappings || post.mappings.length === 0) return "전체";
  const first = post.mappings[0]?.node_detail;
  if (!first) return "전체";
  if (first.session_title) return first.session_title;
  if (first.lecture_title) return first.lecture_title;
  return "전체";
}
