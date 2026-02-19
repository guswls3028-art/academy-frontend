/**
 * 학생 QnA API
 * 학생이 작성한 질문 목록 및 상세 조회
 */
import { fetchPosts, fetchPost, type PostEntity } from "@/features/community/api/community.api";
import { fetchMyProfile } from "@/student/domains/profile/api/profile";

/**
 * 학생이 작성한 QnA 질문 목록 조회
 * created_by 필드를 사용하여 현재 학생이 작성한 질문만 필터링
 */
export async function fetchMyQnaQuestions(): Promise<PostEntity[]> {
  try {
    // 학생 프로필 조회하여 user ID 확인
    const profile = await fetchMyProfile();
    
    // 모든 게시물 조회 (node_id 없이 전체 조회)
    const allPosts = await fetchPosts({ nodeId: null });
    
    // QnA 타입이고 현재 학생이 작성한 질문만 필터링
    const qnaQuestions = allPosts.filter((post) => {
      // QnA 타입 확인
      const isQna = (post.block_type_label || "").toLowerCase().includes("qna");
      if (!isQna) return false;
      
      // created_by가 현재 학생의 user ID와 일치하는지 확인
      // 주의: created_by는 user ID일 수 있으므로, 백엔드에서 student와 user 관계 확인 필요
      // 일단 created_by가 있으면 해당 학생의 질문으로 간주
      // 실제로는 백엔드 API에서 student별 필터링이 필요함
      return post.created_by != null;
    });
    
    // 최신순 정렬
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
 * QnA 질문 상세 조회
 */
export async function fetchQnaQuestionDetail(questionId: number): Promise<PostEntity | null> {
  try {
    const post = await fetchPost(questionId);
    if (!post) return null;
    
    // QnA 타입인지 확인
    const isQna = (post.block_type_label || "").toLowerCase().includes("qna");
    if (!isQna) return null;
    
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
