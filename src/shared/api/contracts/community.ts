import type { AxiosRequestConfig } from "axios";

export const COMMUNITY_PREFIX = "/community";

export interface CommunityHttpClient {
  get<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<{ data: T }>;
  post<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<{ data: T }>;
  patch<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<{ data: T }>;
  delete<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<{ data: T }>;
}

export type CommunityScope = "all" | "lecture" | "session";

export interface CommunityScopeParams {
  scope: CommunityScope;
  lectureId?: number | null;
  sessionId?: number | null;
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

export interface PostAttachment {
  id: number;
  original_name: string;
  size_bytes: number;
  content_type: string;
  created_at: string;
  /** R2 presigned URL (1h TTL). 이미지/문서 inline 표시용. */
  download_url?: string | null;
}

export type PostType = "notice" | "board" | "materials" | "qna" | "counsel";
export type PostStatus = "draft" | "published" | "archived";

export interface PostEntity {
  id: number;
  tenant?: number;
  post_type: PostType;
  title: string;
  content: string;
  created_by: number | null;
  created_by_display?: string | null;
  created_by_deleted?: boolean;
  author_role?: "staff" | "student" | "parent";
  created_at: string;
  updated_at?: string;
  replies_count?: number;
  like_count?: number;
  is_liked?: boolean;
  mappings: PostMappingItem[];
  attachments?: PostAttachment[];
  category_label?: string | null;
  is_urgent?: boolean;
  is_pinned?: boolean;
  status?: PostStatus;
  published_at?: string | null;
  meta?: Record<string, unknown>;
}

export type PostUpdatePayload = Pick<
  PostEntity,
  "title" | "content" | "is_urgent" | "is_pinned" | "status" | "published_at"
>;

export type ResolvedPostScope =
  | { kind: "global"; nodeIds: number[] }
  | { kind: "scoped"; nodeIds: number[] }
  | { kind: "invalid"; nodeIds: number[] };

export interface CommunityPostCreatePayload {
  post_type?: PostType;
  title: string;
  content: string;
  created_by?: number | null;
  node_ids: number[];
  category_label?: string | null;
  is_urgent?: boolean;
  is_pinned?: boolean;
  status?: PostStatus;
  published_at?: string | null;
}

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
  created_by_deleted?: boolean;
  category_label?: string | null;
}

export interface Answer {
  id: number;
  question: number;
  content: string;
  created_at: string;
  created_by_display?: string | null;
  author_role?: string;
}

export type BulkStatusValue = PostStatus;

export interface BulkStatusResult {
  updated: number;
  status: BulkStatusValue;
}

export interface PostAuthorContext {
  id: number;
  name: string;
  displayName: string;
  school: string | null;
  schoolClass: string | null;
  grade: number | null;
  studentPhone: string | null;
  parentPhone: string | null;
  enrollments: Array<{
    id: number;
    lectureId: number | null;
    lectureName: string | null;
    lectureColor: string | null;
    lectureChipLabel: string | null;
  }>;
}

export interface PostCountsResponse {
  total: number;
  global_count: number;
  by_node_id: Record<number, number>;
  by_lecture_id: Record<number, number>;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object";
}

function listFromResponse<T>(data: unknown): T[] {
  if (isObject(data) && Array.isArray(data.results)) return data.results as T[];
  return Array.isArray(data) ? (data as T[]) : [];
}

export function communityRowsFromResponse(data: unknown): PostEntity[] {
  return listFromResponse<PostEntity>(data);
}

export function dedupeCommunityPostsById<T extends { id: number }>(rows: T[]): T[] {
  const seen = new Set<number>();
  const out: T[] = [];
  for (const row of rows) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    out.push(row);
  }
  return out;
}

export function sortCommunityPostsPinnedFirst<T extends Pick<PostEntity, "is_pinned" | "created_at">>(
  posts: T[],
): T[] {
  return [...posts].sort((a, b) => {
    if ((a.is_pinned ?? false) !== (b.is_pinned ?? false)) return a.is_pinned ? -1 : 1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}

export function isCommunityPostAnswered(post: Pick<PostEntity, "replies_count">): boolean {
  return (post.replies_count ?? 0) > 0;
}

export function isHttpStatus(error: unknown, status: number): boolean {
  if (!isObject(error) || !isObject(error.response)) return false;
  return error.response.status === status;
}

export function resolveNodeIdFromScope(
  nodes: ScopeNodeMinimal[],
  params: CommunityScopeParams,
): number | null {
  if (params.scope === "all") return null;
  if (params.scope === "lecture" && params.lectureId != null) {
    const node = nodes.find((x) => x.lecture === params.lectureId && x.session == null);
    return node?.id ?? null;
  }
  if (params.scope === "session" && params.lectureId != null && params.sessionId != null) {
    const node = nodes.find(
      (x) => x.lecture === params.lectureId && Number(x.session) === params.sessionId,
    );
    return node?.id ?? null;
  }
  return null;
}

export function resolvePostNodeIdsForCreate(
  nodes: ScopeNodeMinimal[],
  params: CommunityScopeParams,
): ResolvedPostScope {
  if (params.scope === "all") return { kind: "global", nodeIds: [] };
  if (params.scope === "session" && params.lectureId != null && params.sessionId != null) {
    const node = nodes.find(
      (x) => x.lecture === params.lectureId && Number(x.session) === params.sessionId,
    );
    return node ? { kind: "scoped", nodeIds: [node.id] } : { kind: "invalid", nodeIds: [] };
  }
  if (params.scope === "lecture" && params.lectureId != null) {
    const nodeIds = nodes
      .filter((x) => x.lecture === params.lectureId && x.level === "COURSE")
      .map((x) => x.id);
    return nodeIds.length > 0 ? { kind: "scoped", nodeIds } : { kind: "invalid", nodeIds: [] };
  }
  return { kind: "invalid", nodeIds: [] };
}

export function postEntityToQuestion(post: PostEntity): Omit<Question, "is_answered"> {
  const firstNode = post.mappings?.[0]?.node_detail;
  return {
    id: post.id,
    title: post.title,
    content: post.content,
    created_at: post.created_at,
    student_name: post.created_by_display ?? undefined,
    created_by: post.created_by ?? undefined,
    created_by_deleted: post.created_by_deleted,
    lecture_id: firstNode?.lecture,
    lecture_title: firstNode?.lecture_title,
    category_label: post.category_label,
  };
}

function paramsWithPage(params?: { page?: number; pageSize?: number }): Record<string, number> {
  const out: Record<string, number> = {};
  if (params?.page != null) out.page = params.page;
  if (params?.pageSize != null) out.page_size = params.pageSize;
  return out;
}

export async function fetchCommunityScopeNodes(
  client: CommunityHttpClient,
): Promise<ScopeNodeMinimal[]> {
  const res = await client.get(`${COMMUNITY_PREFIX}/scope-nodes/`, { params: { page_size: 500 } });
  return listFromResponse<ScopeNodeMinimal>(res.data);
}

export async function fetchCommunityPosts(
  client: CommunityHttpClient,
  params: { nodeId?: number | null; pageSize?: number; postType?: PostType },
): Promise<PostEntity[]> {
  const res = await client.get<PostEntity[] | { results?: PostEntity[] }>(
    `${COMMUNITY_PREFIX}/posts/`,
    {
      params: {
        node_id: params.nodeId ?? undefined,
        page_size: params.pageSize,
        post_type: params.postType,
      },
    },
  );
  return communityRowsFromResponse(res.data);
}

export async function fetchCommunityPost(
  client: CommunityHttpClient,
  id: number,
): Promise<PostEntity | null> {
  try {
    const res = await client.get<PostEntity>(`${COMMUNITY_PREFIX}/posts/${id}/`);
    return res.data;
  } catch (error: unknown) {
    if (isHttpStatus(error, 404)) return null;
    throw error;
  }
}

export async function fetchCommunityEndpointPosts(
  client: CommunityHttpClient,
  endpoint: "notices" | "board" | "materials",
  params?: { page?: number; pageSize?: number },
): Promise<PostEntity[]> {
  const res = await client.get<PostEntity[] | { results?: PostEntity[] }>(
    `${COMMUNITY_PREFIX}/posts/${endpoint}/`,
    { params: paramsWithPage(params) },
  );
  return dedupeCommunityPostsById(communityRowsFromResponse(res.data));
}

export function fetchCommunityNoticePosts(
  client: CommunityHttpClient,
  params?: { page?: number; pageSize?: number },
): Promise<PostEntity[]> {
  return fetchCommunityEndpointPosts(client, "notices", params);
}

export function fetchCommunityBoardPosts(
  client: CommunityHttpClient,
  params?: { page?: number; pageSize?: number },
): Promise<PostEntity[]> {
  return fetchCommunityEndpointPosts(client, "board", params);
}

export function fetchCommunityMaterialsPosts(
  client: CommunityHttpClient,
  params?: { page?: number; pageSize?: number },
): Promise<PostEntity[]> {
  return fetchCommunityEndpointPosts(client, "materials", params);
}

export async function fetchCommunityAdminPosts(
  client: CommunityHttpClient,
  params: {
    postType?: PostType | null;
    lectureId?: number | null;
    q?: string | null;
    page?: number;
    pageSize?: number;
  },
): Promise<{ results: PostEntity[]; count: number }> {
  const res = await client.get<{ results?: PostEntity[]; count?: number }>(
    `${COMMUNITY_PREFIX}/admin/posts/`,
    {
      params: {
        post_type: params.postType ?? undefined,
        lecture_id: params.lectureId ?? undefined,
        q: params.q ?? undefined,
        page: params.page ?? 1,
        page_size: params.pageSize ?? 20,
      },
    },
  );
  return {
    results: Array.isArray(res.data.results) ? res.data.results : [],
    count: typeof res.data.count === "number" ? res.data.count : 0,
  };
}

export async function createCommunityPost(
  client: CommunityHttpClient,
  data: CommunityPostCreatePayload,
): Promise<PostEntity> {
  const res = await client.post<PostEntity>(`${COMMUNITY_PREFIX}/posts/`, data);
  return res.data;
}

export async function updateCommunityPostNodes(
  client: CommunityHttpClient,
  postId: number,
  nodeIds: number[],
): Promise<PostEntity> {
  const res = await client.patch<PostEntity>(`${COMMUNITY_PREFIX}/posts/${postId}/nodes/`, {
    node_ids: nodeIds,
  });
  return res.data;
}

export async function updateCommunityPost(
  client: CommunityHttpClient,
  postId: number,
  data: Partial<PostUpdatePayload>,
): Promise<PostEntity> {
  const res = await client.patch<PostEntity>(`${COMMUNITY_PREFIX}/posts/${postId}/`, data);
  return res.data;
}

export async function deleteCommunityPost(client: CommunityHttpClient, postId: number): Promise<void> {
  await client.delete(`${COMMUNITY_PREFIX}/posts/${postId}/`);
}

export async function bulkUpdateCommunityPostStatus(
  client: CommunityHttpClient,
  ids: number[],
  newStatus: BulkStatusValue,
): Promise<BulkStatusResult> {
  const res = await client.post<BulkStatusResult>(`${COMMUNITY_PREFIX}/admin/posts/bulk-status/`, {
    ids,
    status: newStatus,
  });
  return res.data;
}

export async function fetchCommunityPostReplies(
  client: CommunityHttpClient,
  postId: number,
  options?: { fallbackToEmpty?: boolean; emptyOn404?: boolean },
): Promise<Answer[]> {
  try {
    const res = await client.get<Answer[] | { results?: Answer[] }>(
      `${COMMUNITY_PREFIX}/posts/${postId}/replies/`,
    );
    return listFromResponse<Answer>(res.data);
  } catch (error: unknown) {
    if (options?.fallbackToEmpty || (options?.emptyOn404 && isHttpStatus(error, 404))) return [];
    throw error;
  }
}

export async function createCommunityAnswer(
  client: CommunityHttpClient,
  questionId: number,
  content: string,
): Promise<Answer> {
  const res = await client.post<{
    id: number;
    post?: number;
    question?: number;
    content: string;
    created_at: string;
    created_by_display?: string | null;
  }>(`${COMMUNITY_PREFIX}/posts/${questionId}/replies/`, { content });
  return {
    id: res.data.id,
    question: res.data.question ?? res.data.post ?? questionId,
    content: res.data.content,
    created_at: res.data.created_at,
    created_by_display: res.data.created_by_display ?? null,
  };
}

export async function updateCommunityReply(
  client: CommunityHttpClient,
  postId: number,
  replyId: number,
  content: string,
): Promise<Answer> {
  const res = await client.patch<Answer>(
    `${COMMUNITY_PREFIX}/posts/${postId}/replies/${replyId}/`,
    { content },
  );
  return res.data;
}

export async function deleteCommunityReply(
  client: CommunityHttpClient,
  postId: number,
  replyId: number,
): Promise<void> {
  await client.delete(`${COMMUNITY_PREFIX}/posts/${postId}/replies/${replyId}/`);
}

export async function uploadCommunityPostAttachments(
  client: CommunityHttpClient,
  postId: number,
  files: File[],
): Promise<PostAttachment[]> {
  const formData = new FormData();
  for (const file of files) formData.append("files", file);
  const res = await client.post<PostAttachment[]>(
    `${COMMUNITY_PREFIX}/posts/${postId}/attachments/`,
    formData,
    { headers: { "Content-Type": "multipart/form-data" } },
  );
  return Array.isArray(res.data) ? res.data : [];
}

export async function getCommunityAttachmentDownloadUrl(
  client: CommunityHttpClient,
  postId: number,
  attId: number,
): Promise<{ url: string; original_name: string }> {
  const res = await client.get<{ url: string; original_name: string }>(
    `${COMMUNITY_PREFIX}/posts/${postId}/attachments/${attId}/download/`,
  );
  return res.data;
}

export async function deleteCommunityPostAttachment(
  client: CommunityHttpClient,
  postId: number,
  attId: number,
): Promise<void> {
  await client.delete(`${COMMUNITY_PREFIX}/posts/${postId}/attachments/${attId}/`);
}

export async function fetchCommunityPostCounts(
  client: CommunityHttpClient,
  postType: PostType,
): Promise<PostCountsResponse> {
  const res = await client.get<Partial<PostCountsResponse>>(`${COMMUNITY_PREFIX}/posts/counts/`, {
    params: { post_type: postType },
  });
  return {
    total: typeof res.data.total === "number" ? res.data.total : 0,
    global_count: typeof res.data.global_count === "number" ? res.data.global_count : 0,
    by_node_id: res.data.by_node_id ?? {},
    by_lecture_id: res.data.by_lecture_id ?? {},
  };
}
