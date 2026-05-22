// PATH: src/app_student/domains/community/api/community.api.ts
// 학생 커뮤니티 단일 API — post_type 기반 분류

import axios from "axios";
import studentApi from "@student/shared/api/student.api";
import {
  createCommunityPost,
  fetchCommunityEndpointPosts,
  fetchCommunityPost,
  fetchCommunityPostReplies,
  fetchCommunityPosts,
  getCommunityAttachmentDownloadUrl,
  isCommunityPostAnswered,
  sortCommunityPostsPinnedFirst,
  uploadCommunityPostAttachments,
  type Answer,
  type PostAttachment,
  type PostEntity,
  type PostType,
} from "@/shared/api/contracts/community";

export type { PostEntity, PostAttachment, Answer };

/** 내 활동 통계 (2026-05-12 #40) — backend SSOT GET /community/posts/my-activity/ */
async function fetchStudentPosts(params: { nodeId?: number | null; pageSize?: number; postType?: PostType }): Promise<PostEntity[]> {
  return fetchCommunityPosts(studentApi, params);
}

async function fetchStudentPost(id: number): Promise<PostEntity | null> {
  return fetchCommunityPost(studentApi, id);
}

async function fetchStudentEndpointPosts(path: "notices" | "board" | "materials", pageSize: number): Promise<PostEntity[]> {
  return fetchCommunityEndpointPosts(studentApi, path, { pageSize });
}

async function createStudentPost(data: {
  post_type: PostType;
  title: string;
  content: string;
  created_by?: number | null;
  node_ids: number[];
  category_label?: string | null;
}): Promise<PostEntity> {
  return createCommunityPost(studentApi, data);
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
  return uploadCommunityPostAttachments(studentApi, postId, files);
}

/** 첨부파일 다운로드 URL */
export async function getAttachmentDownloadUrl(postId: number, attId: number): Promise<{ url: string; original_name: string }> {
  return getCommunityAttachmentDownloadUrl(studentApi, postId, attId);
}

// ── QnA ──

/** 내가 작성한 질문 목록 — post_type 기반 (서버가 created_by 필터링 수행) */
export async function fetchMyQuestions(_studentId: number, pageSize = 200): Promise<PostEntity[]> {
  const posts = await fetchStudentPosts({ nodeId: null, pageSize, postType: "qna" });
  return sortCommunityPostsPinnedFirst(posts);
}

/** 질문 상세 */
export async function fetchQuestionDetail(id: number): Promise<PostEntity | null> {
  const post = await fetchStudentPost(id);
  return post;
}

/** 답변 여부 */
export function isAnswered(post: PostEntity): boolean {
  return isCommunityPostAnswered(post);
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
  return sortCommunityPostsPinnedFirst(posts);
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
  return sortCommunityPostsPinnedFirst(posts);
}

// ── 게시판 — post_type 기반 ──

/** 일반 게시판 목록 — 전용 엔드포인트 사용 (선생 글 포함) */
export async function fetchBoardPosts(pageSize = 100): Promise<PostEntity[]> {
  const posts = await fetchStudentEndpointPosts("board", pageSize);
  return sortCommunityPostsPinnedFirst(posts);
}

// ── 자료실 ──

/** 자료실 목록 — 전용 엔드포인트 사용 (선생 글 포함) */
export async function fetchMaterialsPosts(pageSize = 100): Promise<PostEntity[]> {
  const posts = await fetchStudentEndpointPosts("materials", pageSize);
  return sortCommunityPostsPinnedFirst(posts);
}

/** 게시물 상세 */
export async function fetchPostDetail(id: number): Promise<PostEntity | null> {
  return fetchStudentPost(id);
}

// ── 공통 ──

/** 답변(댓글) 목록 */
export async function fetchReplies(postId: number): Promise<Answer[]> {
  try {
    return fetchCommunityPostReplies(studentApi, postId);
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) return [];
    throw error;
  }
}
