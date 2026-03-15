// PATH: src/student/domains/community/api/community.api.ts
// 학생 커뮤니티 단일 API — block_type 개념은 내부에서만 처리, UI에 노출하지 않음

import {
  fetchPosts,
  fetchPost,
  fetchBlockTypes,
  fetchPostReplies as _fetchReplies,
  createPost as _createPost,
  uploadPostAttachments as _uploadAttachments,
  getAttachmentDownloadUrl as _getDownloadUrl,
  ensureCounselBlockType,
  ensureMaterialsBlockType,
  type PostEntity,
  type PostAttachment,
  type Answer,
} from "@/features/community/api/community.api";

export type { PostEntity, PostAttachment, Answer };

/** 첨부파일 업로드 */
export const uploadPostAttachments = _uploadAttachments;

/** 첨부파일 다운로드 URL */
export const getAttachmentDownloadUrl = _getDownloadUrl;

// ── Block-type ID 캐시 (세션 동안 1회만 resolve) ──
let _typeCache: { qna: number | null; notice: number | null; counsel: number | null; materials: number | null } | null = null;

async function resolveTypeIds(): Promise<{ qna: number | null; notice: number | null; counsel: number | null; materials: number | null }> {
  if (_typeCache) return _typeCache;
  const types = await fetchBlockTypes();
  const find = (code: string) => types.find((t) => (t.code || "").toLowerCase() === code)?.id ?? null;
  _typeCache = { qna: find("qna"), notice: find("notice"), counsel: find("counsel"), materials: find("materials") };
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
  categoryLabel?: string | null,
): Promise<PostEntity> {
  const { qna } = await resolveTypeIds();
  if (qna == null) throw new Error("QnA 유형이 설정되지 않았습니다. 관리자에게 문의하세요.");
  return _createPost({
    block_type: qna,
    title,
    content,
    created_by: studentId,
    node_ids: [],
    category_label: categoryLabel || null,
  });
}

// ── 상담 신청 ──

/** counsel 블록 유형 ID를 확보 (목록에서 resolve, 없으면 생성 시도) */
async function getCounselTypeId(): Promise<number> {
  // 캐시에 있으면 바로 반환
  const cached = _typeCache?.counsel;
  if (cached != null) return cached;
  // 먼저 목록에서 resolve 시도 (학생도 접근 가능)
  const { counsel } = await resolveTypeIds();
  if (counsel != null) return counsel;
  // 목록에 없으면 생성 시도 (스태프만 가능, 학생은 403)
  try {
    const id = await ensureCounselBlockType();
    if (_typeCache) _typeCache.counsel = id;
    return id;
  } catch {
    throw new Error("상담 신청 유형이 설정되지 않았습니다. 관리자에게 문의하세요.");
  }
}

/** 내가 작성한 상담 신청 목록 */
export async function fetchMyCounselRequests(studentId: number, pageSize = 50): Promise<PostEntity[]> {
  const [counselId, posts] = await Promise.all([
    getCounselTypeId(),
    fetchPosts({ nodeId: null, pageSize }),
  ]);
  return posts
    .filter((p) => p.block_type === counselId && Number(p.created_by) === Number(studentId))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

/** 상담 신청 등록 */
export async function submitCounselRequest(
  title: string,
  content: string,
  studentId: number,
  categoryLabel?: string | null,
): Promise<PostEntity> {
  const counselId = await getCounselTypeId();
  return _createPost({
    block_type: counselId,
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
  const { fetchNoticePosts: _fetchNotices } = await import("@/features/community/api/community.api");
  const posts = await _fetchNotices({ pageSize });
  return posts.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

// ── 게시판 (QnA·공지·상담·자료실 제외 일반 게시물) ──

/** 일반 게시판 목록 */
export async function fetchBoardPosts(pageSize = 100): Promise<PostEntity[]> {
  const [{ qna, notice, counsel, materials }, posts] = await Promise.all([
    resolveTypeIds(),
    fetchPosts({ nodeId: null, pageSize }),
  ]);
  const excluded = new Set([qna, notice, counsel, materials].filter((v): v is number => v != null));
  return posts
    .filter((p) => !excluded.has(p.block_type))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

// ── 자료실 ──

/** materials 블록 유형 ID를 확보 (목록에서 resolve, 없으면 생성 시도) */
async function getMaterialsTypeId(): Promise<number> {
  const cached = _typeCache?.materials;
  if (cached != null) return cached;
  // 먼저 목록에서 resolve 시도 (학생도 접근 가능)
  const { materials } = await resolveTypeIds();
  if (materials != null) return materials;
  // 목록에 없으면 생성 시도 (스태프만 가능, 학생은 403)
  try {
    const id = await ensureMaterialsBlockType();
    if (_typeCache) _typeCache.materials = id;
    return id;
  } catch {
    throw new Error("자료실 유형이 설정되지 않았습니다. 관리자에게 문의하세요.");
  }
}

/** 자료실 목록 */
export async function fetchMaterialsPosts(pageSize = 100): Promise<PostEntity[]> {
  const [materialsId, posts] = await Promise.all([
    getMaterialsTypeId(),
    fetchPosts({ nodeId: null, pageSize }),
  ]);
  return posts
    .filter((p) => p.block_type === materialsId)
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
