// PATH: src/app_admin/domains/lectures/api/board.ts
// 강의별 게시판 — community SSOT API 사용
// GET /api/v1/community/scope-nodes, block-types, posts

import {
  fetchScopeNodes,
  fetchPosts,
  createPost,
  type PostEntity,
} from "@admin/domains/community/api/community.api";

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
    category: 0,
    title: p.title,
    content: p.content,
    created_by: p.created_by ?? null,
    created_at: p.created_at,
    attachments: [],
  };
}

/* =========================
 * POSTS → scope-nodes + posts
 * ========================= */
export async function fetchBoardPosts(params: {
  lecture: number;
  postType?: string;
}): Promise<BoardPost[]> {
  const nodes = await fetchScopeNodes();
  const courseNode = nodes.find(
    (n) => n.lecture === params.lecture && n.session == null
  );
  if (!courseNode) return [];
  const list = await fetchPosts({ nodeId: courseNode.id });
  const filtered = params.postType
    ? list.filter((p) => p.post_type === params.postType)
    : list;
  return filtered.map(postEntityToBoardPost);
}

export async function createBoardPost(data: {
  post_type: string;
  title: string;
  content: string;
  node_ids: number[];
}): Promise<BoardPost> {
  const post = await createPost({
    post_type: data.post_type as "board",
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
