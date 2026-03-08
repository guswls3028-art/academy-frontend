/**
 * 학생 QnA API
 * 블록타입 code "qna" 기준으로 선생 앱과 동일하게 식별
 */
import {
  fetchPosts,
  fetchPost,
  getQnaBlockTypeId,
  type PostEntity,
} from "@/features/community/api/community.api";
import { fetchMyProfile } from "@/student/domains/profile/api/profile";

export type FetchMyQnaOptions = {
  /** 캐시된 프로필 전달 시 fetchMyProfile() 생략 (알림 카운트 등에서 프로필 중복 호출 방지) */
  profile?: { id: number };
  /** 목록 최대 건수. 미지정 시 200. 알림 카운트용 호출 시 작은 값(예: 50) 권장 */
  pageSize?: number;
};

/**
 * 학생이 작성한 QnA 질문 목록 조회
 * block_type code "qna" id로 필터 (선생 앱 알림/목록과 동일 기준)
 */
export async function fetchMyQnaQuestions(options?: FetchMyQnaOptions): Promise<PostEntity[]> {
  const pageSize = options?.pageSize ?? 200;
  try {
    const profilePromise = options?.profile != null
      ? Promise.resolve(options.profile)
      : fetchMyProfile();
    const [profile, qnaBlockTypeId, allPosts] = await Promise.all([
      profilePromise,
      getQnaBlockTypeId(),
      fetchPosts({ nodeId: null, pageSize }),
    ]);
    const studentId = profile.id;
    const qnaQuestions = allPosts.filter((post) => {
      if (qnaBlockTypeId != null && post.block_type !== qnaBlockTypeId) return false;
      if (qnaBlockTypeId == null) {
        const isQna = (post.block_type_label || "").toLowerCase().includes("qna");
        if (!isQna) return false;
      }
      return Number(post.created_by) === Number(studentId);
    });
    return qnaQuestions.sort((a, b) => {
      const dateA = new Date(a.created_at).getTime();
      const dateB = new Date(b.created_at).getTime();
      return dateB - dateA;
    });
  } catch (error) {
    console.error("QnA 질문 목록 조회 실패:", error);
    return [];
  }
}

/**
 * QnA 질문 상세 조회 (block_type code "qna" 또는 라벨 fallback)
 */
export async function fetchQnaQuestionDetail(questionId: number): Promise<PostEntity | null> {
  try {
    const [post, qnaBlockTypeId] = await Promise.all([
      fetchPost(questionId),
      getQnaBlockTypeId(),
    ]);
    if (!post) return null;
    const isQnaByType = qnaBlockTypeId != null && post.block_type === qnaBlockTypeId;
    const isQnaByLabel = (post.block_type_label || "").toLowerCase().includes("qna");
    if (!isQnaByType && !isQnaByLabel) return null;
    return post;
  } catch (error) {
    console.error("QnA 질문 상세 조회 실패:", error);
    return null;
  }
}

/**
 * 질문에 답변이 있는지 확인
 */
export function hasAnswer(post: PostEntity): boolean {
  return (post.replies_count || 0) > 0;
}

/**
 * 질문이 답변 대기 중인지 확인
 */
export function isPendingAnswer(post: PostEntity): boolean {
  return !hasAnswer(post);
}
