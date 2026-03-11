// PATH: src/student/domains/community/api/community.api.ts
// 학생 커뮤니티 단일 API — block_type 개념은 내부에서만 처리, UI에 노출하지 않음

import api from "@/shared/api/axios";
import {
  fetchPosts,
  fetchPost,
  fetchBlockTypes,
  fetchPostReplies as _fetchReplies,
  fetchNoticePosts,
  createPost as _createPost,
  type PostEntity,
  type Answer,
  type BlockType,
} from "@/features/community/api/community.api";

export type { PostEntity, Answer };

// ── Block-type ID 캐시 (세션 동안 1회만 resolve) ──
let _typeCache: { qna: number | null; notice: number | null } | null = null;

async function resolveTypeIds(): Promise<{ qna: number | null; notice: number | null }> {
  if (_typeCache) return _typeCache;
  const types = await fetchBlockTypes();
  const find = (code: string) => types.find((t) => (t.code || "").toLowerCase() === code)?.id ?? null;
  _typeCache = { qna: find("qna"), notice: find("notice") };
  return _typeCache;
}

/** 캐시 초기화 (테스트용) */
export function resetTypeCache() {
  _typeCache = null;
}

// ── QnA ──

/** 내가 작성한 질문 목록 */
export async function fetchMyQuestions(studentId: number, pageSize = 50): Promise<PostEntity[]> {
  const [{ qna }, posts] = await Promise.all([
    resolveTypeIds(),
    fetchPosts({ nodeId: null, pageSize }),
  ]);
  return posts
    .filter((p) => {
      const isQna = qna != null ? p.block_type === qna : (p.block_type_label || "").toLowerCase().includes("qna");
      return isQna && Number(p.created_by) === Number(studentId);
    })
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

/** 질문 상세 (QnA 타입 검증 포함) */
export async function fetchQuestionDetail(id: number): Promise<PostEntity | null> {
  const [{ qna }, post] = await Promise.all([resolveTypeIds(), fetchPost(id)]);
  if (!post) return null;
  const isQna = qna != null ? post.block_type === qna : (post.block_type_label || "").toLowerCase().includes("qna");
  return isQna ? post : null;
}

/** 답변 여부 */
export function isAnswered(post: PostEntity): boolean {
  return (post.replies_count ?? 0) > 0;
}

/** 질문 등록 */
export async function submitQuestion(
  title: string,
  content: string,
  studentId: number,
): Promise<PostEntity> {
  const { qna } = await resolveTypeIds();
  if (qna == null) throw new Error("QnA 유형이 설정되지 않았습니다. 관리자에게 문의하세요.");
  return _createPost({
    block_type: qna,
    title,
    content,
    created_by: studentId,
    node_ids: [],
  });
}

// ── 게시판 (QnA·공지 제외 일반 게시물) ──

/** 일반 게시판 목록 */
export async function fetchBoardPosts(pageSize = 100): Promise<PostEntity[]> {
  const [{ qna, notice }, posts] = await Promise.all([
    resolveTypeIds(),
    fetchPosts({ nodeId: null, pageSize }),
  ]);
  const excluded = new Set([qna, notice].filter((v): v is number => v != null));
  return posts
    .filter((p) => !excluded.has(p.block_type))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
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
