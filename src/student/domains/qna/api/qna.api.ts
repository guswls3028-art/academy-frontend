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

/**
 * 학생이 작성한 QnA 질문 목록 조회
 * block_type code "qna" id로 필터 (선생 앱 알림/목록과 동일 기준)
 */
export async function fetchMyQnaQuestions(): Promise<PostEntity[]> {
  try {
    const [profile, qnaBlockTypeId, allPosts] = await Promise.all([
      fetchMyProfile(),
      getQnaBlockTypeId(),
      fetchPosts({ nodeId: null }),
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
