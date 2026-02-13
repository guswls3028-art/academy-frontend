// PATH: src/features/lectures/api/board.ts
// 강의별 게시판 — community SSOT API 사용
// GET /api/v1/community/scope-nodes, block-types, posts

import {
  fetchScopeNodes,
  fetchBlockTypes,
  fetchPosts,
  createPost,
  type BlockType,
  type PostEntity,
} from "@/features/community/api/community.api";

/* =========================
 * TYPES (community 호환)
 * ========================= */
export type BoardCategory = BlockType;

export interface BoardAttachment {
  id: number;
  post: number;
  file: string;
}

export interface BoardPost {
  id: number;
  lecture: number;
  category: number;
  title: string;
  content: string;
  created_by: number | null;
  created_at: string;
  attachments: BoardAttachment[];
}

export interface BoardReadStatus {
  id: number;
  post: number;
  enrollment: number;
  checked_at: string;
  student_name?: string;
}

function postEntityToBoardPost(p: PostEntity): BoardPost {
  const firstNode = p.mappings?.[0]?.node_detail;
  return {
    id: p.id,
    lecture: firstNode?.lecture ?? 0,
    category: p.block_type,
    title: p.title,
    content: p.content,
    created_by: p.created_by ?? null,
    created_at: p.created_at,
    attachments: [],
  };
}

/* =========================
 * CATEGORY → block-types (읽기 전용)
 * ========================= */
export async function fetchBoardCategories(_lectureId: number): Promise<BoardCategory[]> {
  return fetchBlockTypes();
}

export async function createBoardCategory(_payload: {
  lecture: number;
  name: string;
}): Promise<BoardCategory> {
  throw new Error("블록 타입은 읽기 전용입니다.");
}

/* =========================
 * POSTS → scope-nodes + posts
 * ========================= */
export async function fetchBoardPosts(params: {
  lecture: number;
  category?: number;
}): Promise<BoardPost[]> {
  const nodes = await fetchScopeNodes();
  const courseNode = nodes.find(
    (n) => n.lecture === params.lecture && n.session == null
  );
  if (!courseNode) return [];
  const list = await fetchPosts({ nodeId: courseNode.id });
  const filtered =
    params.category != null
      ? list.filter((p) => p.block_type === params.category)
      : list;
  return filtered.map(postEntityToBoardPost);
}

export async function createBoardPost(data: {
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

/** 강의 COURSE 노드 1개 id. 글 작성 시 node_ids에 사용 */
export async function getCourseNodeIdForLecture(lectureId: number): Promise<number | null> {
  const nodes = await fetchScopeNodes();
  const n = nodes.find((x) => x.lecture === lectureId && x.session == null);
  return n?.id ?? null;
}

/* =========================
 * READ STATUS (미제공 — 스텁)
 * ========================= */
export async function fetchBoardReadStatus(_postId: number): Promise<BoardReadStatus[]> {
  return [];
}
