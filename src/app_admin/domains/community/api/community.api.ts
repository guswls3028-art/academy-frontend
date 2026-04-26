// PATH: src/app_admin/domains/community/api/community.api.ts
// Community SSOT API — scope-nodes, block-types, posts (공지/질의 등)
// baseURL이 /api/v1 이므로 PREFIX = "/community" → /api/v1/community

import api from "@/shared/api/axios";

const PREFIX = "/community";

export type CommunityScope = "all" | "lecture" | "session";

export interface CommunityScopeParams {
  scope: CommunityScope;
  lectureId?: number | null;
  sessionId?: number | null;
}

// ----------------------------------------
// 신규 타입 (백엔드 community SSOT)
// ----------------------------------------
export interface ScopeNodeMinimal {
  id: number;
  level: "COURSE" | "SESSION";
  lecture: number;
  session: number | null;
  lecture_title: string;
  session_title: string | null;
}

export interface PostMappingItem {
  id: number;
  post: number;
  node: number;
  node_detail: ScopeNodeMinimal;
  created_at: string;
}

export interface PostAttachment {
  id: number;
  original_name: string;
  size_bytes: number;
  content_type: string;
  created_at: string;
}

export type PostType = "notice" | "board" | "materials" | "qna" | "counsel";

export interface PostEntity {
  id: number;
  tenant?: number;
  post_type: PostType;
  title: string;
  content: string;
  created_by: number | null;
  created_by_display?: string | null;
  /** true면 질문자가 삭제된 학생. 답변 추가 비활성화용 */
  created_by_deleted?: boolean;
  author_role?: "staff" | "student";
  created_at: string;
  updated_at?: string;
  replies_count?: number;
  mappings: PostMappingItem[];
  attachments?: PostAttachment[];
  category_label?: string | null;
  is_urgent?: boolean;
  is_pinned?: boolean;
  status?: "draft" | "published" | "archived";
  published_at?: string | null;
  meta?: Record<string, unknown>;
}

// ----------------------------------------
// Scope nodes (강의/차시 트리 → node_id 도출용). 페이지네이션(results) 지원
// ----------------------------------------
export async function fetchScopeNodes(): Promise<ScopeNodeMinimal[]> {
  const res = await api.get(`${PREFIX}/scope-nodes/`, { params: { page_size: 500 } });
  const data = res.data;
  if (data != null && Array.isArray((data as { results?: ScopeNodeMinimal[] }).results)) {
    return (data as { results: ScopeNodeMinimal[] }).results;
  }
  return Array.isArray(data) ? data : [];
}

/** scope + lectureId/sessionId에 해당하는 단일 node_id. 없으면 null */
export function resolveNodeIdFromScope(
  nodes: ScopeNodeMinimal[],
  params: CommunityScopeParams
): number | null {
  if (params.scope === "all") return null; // 전체 목록은 node_id 없이 조회
  if (params.scope === "lecture" && params.lectureId != null) {
    const n = nodes.find((x) => x.lecture === params.lectureId && x.session == null);
    return n?.id ?? null;
  }
  if (params.scope === "session" && params.lectureId != null && params.sessionId != null) {
    const n = nodes.find(
      (x) => x.lecture === params.lectureId && Number(x.session) === params.sessionId
    );
    return n?.id ?? null;
  }
  return null;
}

// ----------------------------------------
// Posts (공지/질의 등)
// ----------------------------------------
/** node_id 있으면 해당 노드(및 상속) 게시물, 없으면 tenant 전체. DRF 페이지네이션(results) 지원. 학생 "내 질문" 시 pageSize 권장. */
export async function fetchPosts(params: { nodeId?: number | null; pageSize?: number; postType?: PostType }): Promise<PostEntity[]> {
  const search = new URLSearchParams();
  if (params.nodeId != null) search.set("node_id", String(params.nodeId));
  if (params.pageSize != null) search.set("page_size", String(params.pageSize));
  if (params.postType) search.set("post_type", params.postType);
  const qs = search.toString();
  const url = qs ? `${PREFIX}/posts/?${qs}` : `${PREFIX}/posts/`;
  const res = await api.get(url);
  const data = res.data as PostEntity[] | { results?: PostEntity[] };
  if (data != null && Array.isArray((data as { results?: PostEntity[] }).results)) {
    return (data as { results: PostEntity[] }).results;
  }
  return Array.isArray(data) ? data : [];
}

/** 게시물 단건 조회 (학생앱 상세 등) */
export async function fetchPost(id: number): Promise<PostEntity | null> {
  try {
    const res = await api.get(`${PREFIX}/posts/${id}/`);
    return res.data as PostEntity;
  } catch (error: unknown) {
    const status = (error as { response?: { status?: number } })?.response?.status;
    if (status === 404) return null;
    throw error;
  }
}

/** 공지 목록 조회 — 학생앱·관리자 동일 (post_type=notice). GET /community/posts/notices/ */
export async function fetchNoticePosts(params?: { page?: number; pageSize?: number }): Promise<PostEntity[]> {
  const search = new URLSearchParams();
  if (params?.page != null) search.set("page", String(params.page));
  if (params?.pageSize != null) search.set("page_size", String(params.pageSize));
  const qs = search.toString();
  const url = qs ? `${PREFIX}/posts/notices/?${qs}` : `${PREFIX}/posts/notices/`;
  const res = await api.get(url);
  const data = res.data;
  // 호환: 배열 또는 {count, results} 형식 모두 지원
  return Array.isArray(data) ? data : Array.isArray(data?.results) ? data.results : [];
}

/** 게시판 목록 — GET /community/posts/board/ */
export async function fetchBoardPostsByEndpoint(params?: { page?: number; pageSize?: number }): Promise<PostEntity[]> {
  const search = new URLSearchParams();
  if (params?.page != null) search.set("page", String(params.page));
  if (params?.pageSize != null) search.set("page_size", String(params.pageSize));
  const qs = search.toString();
  const url = qs ? `${PREFIX}/posts/board/?${qs}` : `${PREFIX}/posts/board/`;
  const res = await api.get(url);
  const data = res.data;
  return Array.isArray(data) ? data : Array.isArray(data?.results) ? data.results : [];
}

/** 자료실 목록 — GET /community/posts/materials/ */
export async function fetchMaterialsPostsByEndpoint(params?: { page?: number; pageSize?: number }): Promise<PostEntity[]> {
  const search = new URLSearchParams();
  if (params?.page != null) search.set("page", String(params.page));
  if (params?.pageSize != null) search.set("page_size", String(params.pageSize));
  const qs = search.toString();
  const url = qs ? `${PREFIX}/posts/materials/?${qs}` : `${PREFIX}/posts/materials/`;
  const res = await api.get(url);
  const data = res.data;
  return Array.isArray(data) ? data : Array.isArray(data?.results) ? data.results : [];
}

/** 관리자 목록: post_type, lecture_id, q(서버 검색), page, page_size */
export async function fetchAdminPosts(params: {
  postType?: PostType | null;
  lectureId?: number | null;
  q?: string | null;
  page?: number;
  pageSize?: number;
}): Promise<{ results: PostEntity[]; count: number }> {
  const res = await api.get(`${PREFIX}/admin/posts/`, {
    params: {
      post_type: params.postType ?? undefined,
      lecture_id: params.lectureId ?? undefined,
      q: params.q ?? undefined,
      page: params.page ?? 1,
      page_size: params.pageSize ?? 20,
    },
  });
  const data = res.data as { results?: PostEntity[]; count?: number };
  return {
    results: Array.isArray(data.results) ? data.results : [],
    count: typeof data.count === "number" ? data.count : 0,
  };
}

export async function createPost(data: {
  post_type?: PostType;
  title: string;
  content: string;
  created_by?: number | null;
  node_ids: number[];
  category_label?: string | null;
  is_urgent?: boolean;
  is_pinned?: boolean;
  status?: "draft" | "published" | "archived";
  published_at?: string | null;
}): Promise<PostEntity> {
  const res = await api.post(`${PREFIX}/posts/`, data);
  return res.data as PostEntity;
}

export async function updatePostNodes(postId: number, nodeIds: number[]): Promise<PostEntity> {
  const res = await api.patch(`${PREFIX}/posts/${postId}/nodes/`, { node_ids: nodeIds });
  return res.data as PostEntity;
}

/** 게시물 제목/내용 수정 — PATCH /community/posts/:id/ */
export async function updatePost(
  postId: number,
  data: { title?: string; content?: string }
): Promise<PostEntity> {
  const res = await api.patch(`${PREFIX}/posts/${postId}/`, data);
  return res.data as PostEntity;
}


// ----------------------------------------
// QnA (post_type=qna)
// ----------------------------------------
export interface Question {
  id: number;
  enrollment?: number;
  title: string;
  content: string;
  created_at: string;
  is_answered?: boolean;
  student_name?: string;
  lecture_id?: number;
  lecture_title?: string;
  created_by?: number | null;
  /** true면 질문자가 삭제된 학생 */
  created_by_deleted?: boolean;
  category_label?: string | null;
}

function postEntityToQuestion(p: PostEntity): Omit<Question, "is_answered"> {
  const firstNode = p.mappings?.[0]?.node_detail;
  return {
    id: p.id,
    title: p.title,
    content: p.content,
    created_at: p.created_at,
    student_name: p.created_by_display ?? undefined,
    created_by: p.created_by ?? undefined,
    created_by_deleted: p.created_by_deleted,
    lecture_id: firstNode?.lecture,
    lecture_title: firstNode?.lecture_title,
    category_label: p.category_label,
  };
}


/** QnA 목록 (post_type="qna" 기준) */
export async function fetchCommunityQuestions(
  params?: CommunityScopeParams | null
): Promise<Question[]> {
  const toQuestion = (p: PostEntity): Question => ({
    ...postEntityToQuestion(p),
    is_answered: (p.replies_count ?? 0) > 0,
  });

  // 관리자: 항상 admin API 사용 (학생 글은 node_ids=[] 이므로 scope 기반 조회에서 누락됨)
  const { results } = await fetchAdminPosts({
    postType: "qna",
    lectureId: params?.scope === "lecture" ? (params.lectureId ?? undefined) : undefined,
    pageSize: 500,
  });
  return results.map(toQuestion);
}

export interface Answer {
  id: number;
  question: number;
  content: string;
  created_at: string;
  created_by_display?: string | null;
  author_role?: string;
}

/**
 * 게시물의 답변 목록 조회
 */
export async function fetchPostReplies(postId: number): Promise<Answer[]> {
  try {
    const res = await api.get(`${PREFIX}/posts/${postId}/replies/`);
    return Array.isArray(res.data) ? res.data : [];
  } catch {
    return [];
  }
}

/** 질문의 첫 번째 답변 조회 (하위 호환) */
export async function fetchQuestionAnswer(questionId: number): Promise<Answer | null> {
  const replies = await fetchPostReplies(questionId);
  return replies.length > 0 ? replies[0] : null;
}

/** 게시물(질문)에 답변 등록 — POST /community/posts/:id/replies/ */
export async function createAnswer(questionId: number, content: string): Promise<Answer> {
  const res = await api.post<{ id: number; post: number; question: number; content: string; created_at: string; created_by_display?: string | null }>(
    `${PREFIX}/posts/${questionId}/replies/`,
    { content }
  );
  const d = res.data;
  return {
    id: d.id,
    question: d.question ?? d.post,
    content: d.content,
    created_at: d.created_at,
    created_by_display: d.created_by_display ?? null,
  };
}

/** 게시물(질문) 삭제 — DELETE /community/posts/:id/ */
export async function deletePost(postId: number): Promise<void> {
  await api.delete(`${PREFIX}/posts/${postId}/`);
}

/** 답변 수정 — PATCH /community/posts/:postId/replies/:replyId/ */
export async function updateReply(postId: number, replyId: number, content: string): Promise<Answer> {
  const res = await api.patch<Answer>(`${PREFIX}/posts/${postId}/replies/${replyId}/`, { content });
  return res.data;
}

/** 답변 삭제 — DELETE /community/posts/:postId/replies/:replyId/ */
export async function deleteReply(postId: number, replyId: number): Promise<void> {
  await api.delete(`${PREFIX}/posts/${postId}/replies/${replyId}/`);
}

// ----------------------------------------
// 첨부파일
// ----------------------------------------

/** 게시물에 파일 첨부 — POST /community/posts/:id/attachments/ (multipart) */
export async function uploadPostAttachments(
  postId: number,
  files: File[],
): Promise<PostAttachment[]> {
  const fd = new FormData();
  for (const f of files) fd.append("files", f);
  const res = await api.post(`${PREFIX}/posts/${postId}/attachments/`, fd, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return Array.isArray(res.data) ? res.data : [];
}

/** 첨부파일 다운로드 URL 조회 — GET /community/posts/:id/attachments/:attId/download/ */
export async function getAttachmentDownloadUrl(
  postId: number,
  attId: number,
): Promise<{ url: string; original_name: string }> {
  const res = await api.get(`${PREFIX}/posts/${postId}/attachments/${attId}/download/`);
  return res.data;
}

/** 첨부파일 삭제 — DELETE /community/posts/:id/attachments/:attId/ */
export async function deletePostAttachment(postId: number, attId: number): Promise<void> {
  await api.delete(`${PREFIX}/posts/${postId}/attachments/${attId}/`);
}

// ----------------------------------------
// 트리 카운트 집계 (관리자 트리 뷰 전용)
// ----------------------------------------
export interface PostCountsResponse {
  total: number;
  global_count: number;
  by_node_id: Record<number, number>;
  by_lecture_id: Record<number, number>;
}

/** GET /community/posts/counts/?post_type=... — 노드/강의별 카운트 단일 집계 */
export async function fetchPostCounts(postType: PostType): Promise<PostCountsResponse> {
  const res = await api.get(`${PREFIX}/posts/counts/`, { params: { post_type: postType } });
  const data = res.data as Partial<PostCountsResponse>;
  return {
    total: typeof data.total === "number" ? data.total : 0,
    global_count: typeof data.global_count === "number" ? data.global_count : 0,
    by_node_id: data.by_node_id ?? {},
    by_lecture_id: data.by_lecture_id ?? {},
  };
}
