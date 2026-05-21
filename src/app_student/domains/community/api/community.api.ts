// PATH: src/app_student/domains/community/api/community.api.ts
// 학생 커뮤니티 단일 API — post_type 기반 분류

import {
  type PostEntity,
  type PostAttachment,
  type Answer,
  type PostType,
} from "@admin/domains/community/api/community.api";
import axios from "axios";
import studentApi from "@student/shared/api/student.api";

export type { PostEntity, PostAttachment, Answer };

/** 내 활동 통계 (2026-05-12 #40) — backend SSOT GET /community/posts/my-activity/ */
const PREFIX = "/community";

function dedupeById<T extends { id: number }>(rows: T[]): T[] {
  const seen = new Set<number>();
  const out: T[] = [];
  for (const row of rows) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    out.push(row);
  }
  return out;
}

function rowsFromResponse(data: unknown): PostEntity[] {
  if (data != null && Array.isArray((data as { results?: PostEntity[] }).results)) {
    return (data as { results: PostEntity[] }).results;
  }
  return Array.isArray(data) ? data as PostEntity[] : [];
}

async function fetchStudentPosts(params: { nodeId?: number | null; pageSize?: number; postType?: PostType }): Promise<PostEntity[]> {
  const res = await studentApi.get<PostEntity[] | { results?: PostEntity[] }>(`${PREFIX}/posts/`, {
    params: {
      node_id: params.nodeId ?? undefined,
      page_size: params.pageSize,
      post_type: params.postType,
    },
  });
  return rowsFromResponse(res.data);
}

async function fetchStudentPost(id: number): Promise<PostEntity | null> {
  try {
    const res = await studentApi.get<PostEntity>(`${PREFIX}/posts/${id}/`);
    return res.data;
  } catch (error: unknown) {
    const status = (error as { response?: { status?: number } })?.response?.status;
    if (status === 404) return null;
    throw error;
  }
}

async function fetchStudentEndpointPosts(path: string, pageSize: number): Promise<PostEntity[]> {
  const res = await studentApi.get<PostEntity[] | { results?: PostEntity[] }>(`${PREFIX}/posts/${path}/`, {
    params: { page_size: pageSize },
  });
  return dedupeById(rowsFromResponse(res.data));
}

async function createStudentPost(data: {
  post_type: PostType;
  title: string;
  content: string;
  created_by?: number | null;
  node_ids: number[];
  category_label?: string | null;
}): Promise<PostEntity> {
  const res = await studentApi.post<PostEntity>(`${PREFIX}/posts/`, data);
  return res.data;
}

export interface MyActivityResponse {
  is_student: boolean;
  days: number;
  post_count: number;
  reply_count: number;
  received_likes: number;
  score?: number;
  rank: number | null;
  total_active_students: number;
  lifetime?: { post_count: number; reply_count: number; received_likes: number };
  badges?: { key: string; label: string }[];
}

export async function fetchMyActivity(days = 30): Promise<MyActivityResponse> {
  const r = await studentApi.get<MyActivityResponse>("/community/posts/my-activity/", { params: { days } });
  return r.data;
}

/** 첨부파일 업로드 */
export async function uploadPostAttachments(postId: number, files: File[]): Promise<PostAttachment[]> {
  const fd = new FormData();
  for (const f of files) fd.append("files", f);
  const res = await studentApi.post<PostAttachment[]>(`${PREFIX}/posts/${postId}/attachments/`, fd, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return Array.isArray(res.data) ? res.data : [];
}

/** 첨부파일 다운로드 URL */
export async function getAttachmentDownloadUrl(postId: number, attId: number): Promise<{ url: string; original_name: string }> {
  const res = await studentApi.get<{ url: string; original_name: string }>(`${PREFIX}/posts/${postId}/attachments/${attId}/download/`);
  return res.data;
}

// ── QnA ──

/** 내가 작성한 질문 목록 — post_type 기반 (서버가 created_by 필터링 수행) */
export async function fetchMyQuestions(_studentId: number, pageSize = 200): Promise<PostEntity[]> {
  const posts = await fetchStudentPosts({ nodeId: null, pageSize, postType: "qna" });
  return posts.sort((a, b) => {
    // is_pinned 우선 (고정 글이 위로)
    if ((a.is_pinned ?? false) !== (b.is_pinned ?? false)) return a.is_pinned ? -1 : 1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}

/** 질문 상세 */
export async function fetchQuestionDetail(id: number): Promise<PostEntity | null> {
  const post = await fetchStudentPost(id);
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
  return createStudentPost({
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
  const posts = await fetchStudentPosts({ nodeId: null, pageSize, postType: "counsel" });
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
  return createStudentPost({
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
  const posts = await fetchStudentEndpointPosts("notices", pageSize);
  return posts.sort((a, b) => {
    // is_pinned 우선 (고정 글이 위로)
    if ((a.is_pinned ?? false) !== (b.is_pinned ?? false)) return a.is_pinned ? -1 : 1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}

// ── 게시판 — post_type 기반 ──

/** 일반 게시판 목록 — 전용 엔드포인트 사용 (선생 글 포함) */
export async function fetchBoardPosts(pageSize = 100): Promise<PostEntity[]> {
  const posts = await fetchStudentEndpointPosts("board", pageSize);
  return posts.sort((a, b) => {
    // is_pinned 우선 (고정 글이 위로)
    if ((a.is_pinned ?? false) !== (b.is_pinned ?? false)) return a.is_pinned ? -1 : 1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}

// ── 자료실 ──

/** 자료실 목록 — 전용 엔드포인트 사용 (선생 글 포함) */
export async function fetchMaterialsPosts(pageSize = 100): Promise<PostEntity[]> {
  const posts = await fetchStudentEndpointPosts("materials", pageSize);
  return posts.sort((a, b) => {
    // is_pinned 우선 (고정 글이 위로)
    if ((a.is_pinned ?? false) !== (b.is_pinned ?? false)) return a.is_pinned ? -1 : 1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}

/** 게시물 상세 */
export async function fetchPostDetail(id: number): Promise<PostEntity | null> {
  return fetchStudentPost(id);
}

// ── 공통 ──

/** 답변(댓글) 목록 */
export async function fetchReplies(postId: number): Promise<Answer[]> {
  try {
    const res = await studentApi.get<Answer[]>(`${PREFIX}/posts/${postId}/replies/`);
    return Array.isArray(res.data) ? res.data : [];
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) return [];
    throw error;
  }
}
