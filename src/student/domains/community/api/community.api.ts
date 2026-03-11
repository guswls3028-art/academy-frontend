// PATH: src/student/domains/community/api/community.api.ts
// 학생 커뮤니티 API — 게시판(비-QnA, 비-공지) 게시물 + 자료실(스텁)

import {
  fetchPosts,
  fetchPost,
  fetchBlockTypes,
  fetchCommunityMaterials,
  type PostEntity,
  type BlockType,
  type Material,
  type CommunityScopeParams,
} from "@/features/community/api/community.api";

/** QnA·공지 제외한 "일반 게시판" 블록타입 목록 */
export async function fetchBoardBlockTypes(): Promise<BlockType[]> {
  const types = await fetchBlockTypes();
  const EXCLUDED = ["qna", "notice"];
  return types.filter((t) => !EXCLUDED.includes((t.code || "").toLowerCase()));
}

/** 일반 게시판 게시물 목록 (QnA·공지 제외) */
export async function fetchBoardPosts(pageSize = 100): Promise<PostEntity[]> {
  const [allPosts, types] = await Promise.all([
    fetchPosts({ nodeId: null, pageSize }),
    fetchBlockTypes(),
  ]);
  const EXCLUDED = ["qna", "notice"];
  const excludedIds = new Set(
    types.filter((t) => EXCLUDED.includes((t.code || "").toLowerCase())).map((t) => t.id)
  );
  return allPosts
    .filter((p) => !excludedIds.has(p.block_type))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

/** 게시물 상세 */
export { fetchPost as fetchBoardPostDetail };

/** 자료실 목록 (백엔드 미구현 — 스텁) */
export async function fetchStudentMaterials(): Promise<Material[]> {
  return fetchCommunityMaterials({ scope: "all" });
}
