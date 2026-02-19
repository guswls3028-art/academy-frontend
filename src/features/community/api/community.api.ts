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
  created_at: string;
  mappings: PostMappingItem[];
}

// ----------------------------------------
// Scope nodes (강의/차시 트리 → node_id 도출용)
// ----------------------------------------
export async function fetchScopeNodes(): Promise<ScopeNodeMinimal[]> {
  const res = await api.get(`${PREFIX}/scope-nodes/`);
  return Array.isArray(res.data) ? res.data : [];
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
      (x) => x.lecture === params.lectureId && x.session === params.sessionId
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
  return Array.isArray(res.data) ? res.data : [];
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
/** node_id 있으면 해당 노드(및 상속) 게시물, 없으면 tenant 전체 */
export async function fetchPosts(params: { nodeId?: number | null }): Promise<PostEntity[]> {
  const url = params.nodeId != null
    ? `${PREFIX}/posts/?node_id=${params.nodeId}`
    : `${PREFIX}/posts/`;
  const res = await api.get(url);
  return Array.isArray(res.data) ? res.data : [];
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
// 질의응답 (QNA = block_type QNA인 Post)
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
}

function postEntityToQuestion(p: PostEntity): Question {
  const firstNode = p.mappings?.[0]?.node_detail;
  return {
    id: p.id,
    title: p.title,
    content: p.content,
    created_at: p.created_at,
    lecture_id: firstNode?.lecture,
    lecture_title: firstNode?.lecture_title,
  };
}

/** QNA 타입 id로 필터한 목록 (scope → node_id 사용) */
export async function fetchCommunityQuestions(
  params?: CommunityScopeParams | null
): Promise<Question[]> {
  if (!params) {
    const { results } = await fetchAdminPosts({ pageSize: 100 });
    return results.map(postEntityToQuestion);
  }
  const nodes = await fetchScopeNodes();
  const nodeId = resolveNodeIdFromScope(nodes, params);
  const list = await fetchPosts({ nodeId: nodeId ?? undefined });
  return list.map(postEntityToQuestion);
}

export interface Answer {
  id: number;
  question: number;
  content: string;
  created_at: string;
}

/** 답변 API 미제공 — 스텁 */
export async function fetchQuestionAnswer(_questionId: number): Promise<Answer | null> {
  return null;
}

/** 답변 API 미제공 — 스텁 */
export async function createAnswer(_questionId: number, _content: string): Promise<Answer> {
  throw new Error("답변 API가 준비 중입니다.");
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
