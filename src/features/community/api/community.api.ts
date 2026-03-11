// PATH: src/features/community/api/community.api.ts
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
export interface BlockType {
  id: number;
  code: string;
  label: string;
  order: number;
}

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

export interface PostEntity {
  id: number;
  tenant?: number;
  block_type: number;
  block_type_label: string;
  title: string;
  content: string;
  created_by: number | null;
  created_by_display?: string | null;
  /** true면 질문자가 삭제된 학생. 답변 추가 비활성화용 */
  created_by_deleted?: boolean;
  created_at: string;
  updated_at?: string;
  replies_count?: number;
  mappings: PostMappingItem[];
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
// Block types (커스텀 유형 생성/수정/삭제)
// ----------------------------------------
export async function fetchBlockTypes(): Promise<BlockType[]> {
  const res = await api.get(`${PREFIX}/block-types/`);
  const data = res?.data;
  // DRF PageNumberPagination: { results: [...], count, next, previous }
  if (data != null && Array.isArray((data as { results?: BlockType[] }).results)) {
    return (data as { results: BlockType[] }).results;
  }
  return Array.isArray(data) ? data : [];
}

export async function createBlockType(data: {
  label: string;
  code?: string;
  order?: number;
}): Promise<BlockType> {
  const res = await api.post(`${PREFIX}/block-types/`, data);
  return res.data as BlockType;
}

export async function updateBlockType(
  id: number,
  data: { label?: string; code?: string; order?: number }
): Promise<BlockType> {
  const res = await api.patch(`${PREFIX}/block-types/${id}/`, data);
  return res.data as BlockType;
}

export async function deleteBlockType(id: number): Promise<void> {
  await api.delete(`${PREFIX}/block-types/${id}/`);
}

/**
 * counsel 블록 유형이 없으면 자동 생성, 있으면 기존 ID 반환.
 * 중복 호출 방지를 위한 in-flight promise 캐시 포함.
 */
let _ensureCounselPromise: Promise<number> | null = null;
export function ensureCounselBlockType(): Promise<number> {
  if (_ensureCounselPromise) return _ensureCounselPromise;
  _ensureCounselPromise = (async () => {
    try {
      const types = await fetchBlockTypes();
      const existing = types.find((t) => (t.code || "").toLowerCase() === "counsel");
      if (existing) return existing.id;
      const created = await createBlockType({ label: "상담 신청", code: "counsel", order: 50 });
      return created.id;
    } catch (e) {
      _ensureCounselPromise = null;
      throw e;
    }
  })();
  return _ensureCounselPromise;
}

/**
 * materials 블록 유형이 없으면 자동 생성, 있으면 기존 ID 반환.
 */
let _ensureMaterialsPromise: Promise<number> | null = null;
export function ensureMaterialsBlockType(): Promise<number> {
  if (_ensureMaterialsPromise) return _ensureMaterialsPromise;
  _ensureMaterialsPromise = (async () => {
    try {
      const types = await fetchBlockTypes();
      const existing = types.find((t) => (t.code || "").toLowerCase() === "materials");
      if (existing) return existing.id;
      const created = await createBlockType({ label: "자료실", code: "materials", order: 60 });
      return created.id;
    } catch (e) {
      _ensureMaterialsPromise = null;
      throw e;
    }
  })();
  return _ensureMaterialsPromise;
}

/**
 * notice 블록 유형이 없으면 자동 생성, 있으면 기존 ID 반환.
 */
let _ensureNoticePromise: Promise<number> | null = null;
export function ensureNoticeBlockType(): Promise<number> {
  if (_ensureNoticePromise) return _ensureNoticePromise;
  _ensureNoticePromise = (async () => {
    try {
      const types = await fetchBlockTypes();
      const existing = types.find((t) => (t.code || "").toLowerCase() === "notice");
      if (existing) return existing.id;
      const created = await createBlockType({ label: "공지사항", code: "notice", order: 10 });
      return created.id;
    } catch (e) {
      _ensureNoticePromise = null;
      throw e;
    }
  })();
  return _ensureNoticePromise;
}

// ----------------------------------------
// Post templates (양식 저장/불러오기)
// ----------------------------------------
export interface PostTemplate {
  id: number;
  name: string;
  block_type: number | null;
  block_type_label: string | null;
  title: string;
  content: string;
  order: number;
  created_at: string;
  updated_at: string;
}

export async function fetchPostTemplates(): Promise<PostTemplate[]> {
  const res = await api.get(`${PREFIX}/post-templates/`);
  return Array.isArray(res.data) ? res.data : [];
}

export async function createPostTemplate(data: {
  name: string;
  block_type?: number | null;
  title?: string;
  content?: string;
  order?: number;
}): Promise<PostTemplate> {
  const res = await api.post(`${PREFIX}/post-templates/`, data);
  return res.data as PostTemplate;
}

export async function updatePostTemplate(
  id: number,
  data: { name?: string; block_type?: number | null; title?: string; content?: string; order?: number }
): Promise<PostTemplate> {
  const res = await api.patch(`${PREFIX}/post-templates/${id}/`, data);
  return res.data as PostTemplate;
}

export async function deletePostTemplate(id: number): Promise<void> {
  await api.delete(`${PREFIX}/post-templates/${id}/`);
}

// ----------------------------------------
// Posts (공지/질의 등)
// ----------------------------------------
/** node_id 있으면 해당 노드(및 상속) 게시물, 없으면 tenant 전체. DRF 페이지네이션(results) 지원. 학생 "내 질문" 시 pageSize 권장. */
export async function fetchPosts(params: { nodeId?: number | null; pageSize?: number }): Promise<PostEntity[]> {
  const search = new URLSearchParams();
  if (params.nodeId != null) search.set("node_id", String(params.nodeId));
  if (params.pageSize != null) search.set("page_size", String(params.pageSize));
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
  } catch {
    return null;
  }
}

/** 공지 목록 조회 — 학생앱·관리자 동일 (block_type code=notice). GET /community/posts/notices/ */
export async function fetchNoticePosts(params?: { page?: number; pageSize?: number }): Promise<PostEntity[]> {
  const search = new URLSearchParams();
  if (params?.page != null) search.set("page", String(params.page));
  if (params?.pageSize != null) search.set("page_size", String(params.pageSize));
  const qs = search.toString();
  const url = qs ? `${PREFIX}/posts/notices/?${qs}` : `${PREFIX}/posts/notices/`;
  const res = await api.get(url);
  const data = res.data;
  return Array.isArray(data) ? data : [];
}

/** 공지 전체 목록을 페이지네이션으로 수집 (트리 노드별 개수 집계용, 최대 2000건) */
export async function fetchAllNoticePostsForCount(): Promise<PostEntity[]> {
  const pageSize = 200;
  const maxPages = 10;
  const all: PostEntity[] = [];
  for (let page = 1; page <= maxPages; page++) {
    const chunk = await fetchNoticePosts({ page, pageSize });
    all.push(...chunk);
    if (chunk.length < pageSize) break;
  }
  return all;
}

/** 관리자 목록: block_type_id, lecture_id, page, page_size */
export async function fetchAdminPosts(params: {
  blockTypeId?: number | null;
  lectureId?: number | null;
  page?: number;
  pageSize?: number;
}): Promise<{ results: PostEntity[]; count: number }> {
  const res = await api.get(`${PREFIX}/admin/posts/`, {
    params: {
      block_type_id: params.blockTypeId ?? undefined,
      lecture_id: params.lectureId ?? undefined,
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
  block_type: number;
  title: string;
  content: string;
  created_by?: number | null;
  node_ids: number[];
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
// 하위 호환용 별칭 (기존 페이지 점진 전환)
// ----------------------------------------
/** @deprecated use BlockType */
export type BoardCategory = BlockType & { name?: string };

/** @deprecated use PostEntity; 필드 매핑만 제공 */
export interface BoardPost {
  id: number;
  tenant: number | null;
  lecture: number | null;
  session: number | null;
  category: number;
  title: string;
  content: string;
  created_by: number | null;
  created_at: string;
  attachments: { id: number; post: number; file: string }[];
  lecture_title?: string;
  category_name?: string;
}

function postEntityToBoardPost(p: PostEntity): BoardPost {
  const firstNode = p.mappings?.[0]?.node_detail;
  return {
    id: p.id,
    tenant: p.tenant ?? null,
    lecture: firstNode?.lecture ?? null,
    session: firstNode?.session ?? null,
    category: p.block_type,
    title: p.title,
    content: p.content,
    created_by: p.created_by ?? null,
    created_at: p.created_at,
    attachments: [],
    lecture_title: firstNode?.lecture_title,
    category_name: p.block_type_label,
  };
}

/** scope/lecture/session에 맞는 node_id로 목록 조회 후 BoardPost[] 형태로 반환 (레거시 호환) */
export async function fetchCommunityBoardPosts(
  params: CommunityScopeParams & { categoryId?: number | null }
): Promise<BoardPost[]> {
  const nodes = await fetchScopeNodes();
  const nodeId = resolveNodeIdFromScope(nodes, params);
  const list = await fetchPosts({ nodeId: nodeId ?? undefined });
  const filtered =
    params.categoryId != null
      ? list.filter((p) => p.block_type === params.categoryId)
      : list;
  return filtered.map(postEntityToBoardPost);
}

/** block-types를 카테고리 형태로 반환 (레거시 호환) */
export async function fetchCommunityBoardCategories(
  _params: CommunityScopeParams
): Promise<BoardCategory[]> {
  const list = await fetchBlockTypes();
  return list.map((b) => ({
    ...b,
    name: b.label,
    tenant: null,
    lecture: null,
  }));
}

/** block-types는 읽기 전용. 레거시 호출 시 no-op 또는 에러 방지용 */
export async function createCommunityBoardCategory(_data: {
  scope: CommunityScope;
  lectureId?: number | null;
  name: string;
  order?: number;
}): Promise<BoardCategory> {
  throw new Error("block-types는 읽기 전용입니다. 관리자 설정을 사용하세요.");
}

/** JSON 기반 생성 (FormData 대체) */
export async function createCommunityBoardPost(data: {
  block_type: number;
  title: string;
  content: string;
  node_ids: number[];
}): Promise<BoardPost> {
  const post = await createPost({
    block_type: data.block_type,
    title: data.title,
    content: data.content,
    node_ids: data.node_ids,
  });
  return postEntityToBoardPost(post);
}

// ----------------------------------------
// QnA (block_type qna인 Post)
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
  };
}

/** 블록타입 code가 "qna"인 id 반환 (선생/학생 앱 공통). 없으면 null */
export async function getQnaBlockTypeId(): Promise<number | null> {
  const types = await fetchBlockTypes();
  const qna = types.find((t) => (t.code || "").toLowerCase() === "qna");
  return qna?.id ?? null;
}

/** 블록타입 code가 "notice"인 id 반환 (공지사항 관리용). 없으면 null */
export async function getNoticeBlockTypeId(): Promise<number | null> {
  const types = await fetchBlockTypes();
  const notice = types.find((t) => (t.code || "").toLowerCase() === "notice");
  return notice?.id ?? null;
}

/** QNA 블록타입만 필터한 질문 목록 (code "qna" 기준 — 선생 앱과 동일) */
export async function fetchCommunityQuestions(
  params?: CommunityScopeParams | null
): Promise<Question[]> {
  const qnaBlockTypeId = await getQnaBlockTypeId();
  const toQuestion = (p: PostEntity): Question => ({
    ...postEntityToQuestion(p),
    is_answered: (p.replies_count ?? 0) > 0,
  });

  const isQnaPost = (p: PostEntity) =>
    qnaBlockTypeId != null ? p.block_type === qnaBlockTypeId : (p.block_type_label || "").toLowerCase().includes("qna");

  // 관리자 "전체" 범위: admin API로 전체 QnA 목록 조회 (페이지네이션 500)
  if (!params || params.scope === "all") {
    const { results } = await fetchAdminPosts({
      blockTypeId: qnaBlockTypeId ?? undefined,
      pageSize: 500,
    });
    const filtered = qnaBlockTypeId != null ? results : results.filter(isQnaPost);
    return filtered.map(toQuestion);
  }
  const nodes = await fetchScopeNodes();
  const nodeId = resolveNodeIdFromScope(nodes, params);
  const list = await fetchPosts({ nodeId: nodeId ?? undefined });
  const qnaOnly = list.filter(isQnaPost);
  return qnaOnly.map(toQuestion);
}

export interface Answer {
  id: number;
  question: number;
  content: string;
  created_at: string;
  created_by_display?: string | null;
}

/**
 * 게시물의 답변 목록 조회
 */
export async function fetchPostReplies(postId: number): Promise<Answer[]> {
  try {
    const res = await api.get(`${PREFIX}/posts/${postId}/replies/`);
    return Array.isArray(res.data) ? res.data : [];
  } catch (error) {
    console.error("답변 목록 조회 실패:", error);
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
// 자료실 (백엔드 미제공 — 스텁)
// ----------------------------------------
export interface Material {
  id: number;
  tenant: number | null;
  lecture: number | null;
  session: number | null;
  category: number | null;
  title: string;
  description: string;
  file: string | null;
  url: string | null;
  order: number;
  is_public: boolean;
  created_at: string;
  lecture_title?: string;
}

export interface MaterialCategory {
  id: number;
  tenant: number | null;
  lecture: number | null;
  name: string;
  order: number;
}

export async function fetchCommunityMaterials(
  _params: CommunityScopeParams & { categoryId?: number | null }
): Promise<Material[]> {
  return [];
}

export async function fetchCommunityMaterialCategories(
  _params: CommunityScopeParams
): Promise<MaterialCategory[]> {
  return [];
}

export async function createCommunityMaterialCategory(_data: {
  scope: CommunityScope;
  lectureId?: number | null;
  name: string;
  order?: number;
}): Promise<MaterialCategory> {
  throw new Error("자료실 API가 준비 중입니다.");
}

export async function createCommunityMaterial(_formData: FormData): Promise<Material> {
  throw new Error("자료실 API가 준비 중입니다.");
}
