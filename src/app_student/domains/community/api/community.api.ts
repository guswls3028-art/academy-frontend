// PATH: src/app_student/domains/community/api/community.api.ts
// 학생 커뮤니티 단일 API — post_type 기반 분류

import {
  fetchPosts,
  fetchPost,
  fetchPostReplies as _fetchReplies,
  createPost as _createPost,
  uploadPostAttachments as _uploadAttachments,
  getAttachmentDownloadUrl as _getDownloadUrl,
  fetchBoardPostsByEndpoint,
  fetchMaterialsPostsByEndpoint,
  type PostEntity,
  type PostAttachment,
  type Answer,
} from "@admin/domains/community/api/community.api";

export type { PostEntity, PostAttachment, Answer };

/** 첨부파일 업로드 */
export const uploadPostAttachments = _uploadAttachments;

/** 첨부파일 다운로드 URL */
export const getAttachmentDownloadUrl = _getDownloadUrl;

// ── QnA ──

/** 내가 작성한 질문 목록 — post_type 기반 (서버가 created_by 필터링 수행) */
export async function fetchMyQuestions(_studentId: number, pageSize = 200): Promise<PostEntity[]> {
  const posts = await fetchPosts({ nodeId: null, pageSize, postType: "qna" });
  return posts.sort((a, b) => {
    // is_pinned 우선 (고정 글이 위로)
    if ((a.is_pinned ?? false) !== (b.is_pinned ?? false)) return a.is_pinned ? -1 : 1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}

/** 질문 상세 */
export async function fetchQuestionDetail(id: number): Promise<PostEntity | null> {
  const post = await fetchPost(id);
  return post;
}

/** 답변 여부 */
export function isAnswered(post: PostEntity): boolean {
  return (post.replies_count ?? 0) > 0;
}

/** 질문 등록 — post_type 기반 */
export async function submitQuestion(
  title: string,
  content: string,
  studentId: number,
  categoryLabel?: string | null,
): Promise<PostEntity> {
  return _createPost({
    post_type: "qna",
    title,
    content,
    created_by: studentId,
    node_ids: [],
    category_label: categoryLabel || null,
  });
}

// ── 상담 신청 ──

/** 내가 작성한 상담 신청 목록 — post_type 기반 (서버가 created_by 필터링 수행) */
export async function fetchMyCounselRequests(_studentId: number, pageSize = 200): Promise<PostEntity[]> {
  const posts = await fetchPosts({ nodeId: null, pageSize, postType: "counsel" });
  return posts.sort((a, b) => {
    // is_pinned 우선 (고정 글이 위로)
    if ((a.is_pinned ?? false) !== (b.is_pinned ?? false)) return a.is_pinned ? -1 : 1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}

/** 상담 신청 등록 — post_type 기반 */
export async function submitCounselRequest(
  title: string,
  content: string,
  studentId: number,
  categoryLabel?: string | null,
): Promise<PostEntity> {
  return _createPost({
    post_type: "counsel",
    title,
    content,
    created_by: studentId,
    node_ids: [],
    category_label: categoryLabel || null,
  });
}

// ── 공지사항 ──

/** 공지사항 목록 — 관리자 작성 공지 포함 (GET /community/posts/notices/) */
export async function fetchNoticePosts(pageSize = 100): Promise<PostEntity[]> {
  const { fetchNoticePosts: _fetchNotices } = await import("@admin/domains/community/api/community.api");
  const posts = await _fetchNotices({ pageSize });
  return posts.sort((a, b) => {
    // is_pinned 우선 (고정 글이 위로)
    if ((a.is_pinned ?? false) !== (b.is_pinned ?? false)) return a.is_pinned ? -1 : 1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}

// ── 게시판 — post_type 기반 ──

/** 일반 게시판 목록 — 전용 엔드포인트 사용 (선생 글 포함) */
export async function fetchBoardPosts(pageSize = 100): Promise<PostEntity[]> {
  const posts = await fetchBoardPostsByEndpoint({ pageSize });
  return posts.sort((a, b) => {
    // is_pinned 우선 (고정 글이 위로)
    if ((a.is_pinned ?? false) !== (b.is_pinned ?? false)) return a.is_pinned ? -1 : 1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}

// ── 자료실 ──

/** 자료실 목록 — 전용 엔드포인트 사용 (선생 글 포함) */
export async function fetchMaterialsPosts(pageSize = 100): Promise<PostEntity[]> {
  const posts = await fetchMaterialsPostsByEndpoint({ pageSize });
  return posts.sort((a, b) => {
    // is_pinned 우선 (고정 글이 위로)
    if ((a.is_pinned ?? false) !== (b.is_pinned ?? false)) return a.is_pinned ? -1 : 1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}

/** 게시물 상세 */
export async function fetchPostDetail(id: number): Promise<PostEntity | null> {
  return fetchPost(id);
}

// ── 공통 ──

/** 답변(댓글) 목록 */
export async function fetchReplies(postId: number): Promise<Answer[]> {
  return _fetchReplies(postId);
}
