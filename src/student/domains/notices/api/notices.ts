// PATH: src/student/domains/notices/api/notices.ts
// 학생 앱 공지 API

import { fetchPosts, fetchPost, type PostEntity } from "@/features/community/api/community.api";

/**
 * 학생이 볼 수 있는 모든 공지 목록 조회
 * block_type_label에 "공지" 또는 "notice"가 포함된 게시물만 필터링
 */
export async function fetchNotices(): Promise<PostEntity[]> {
  try {
    // 전체 게시물 조회 (학생 앱에서는 tenant 전체 공지)
    // nodeId를 null로 전달하면 전체 공지 조회
    const allPosts = await fetchPosts({ nodeId: null });
    
    // block_type_label에 "공지" 또는 "notice"가 포함된 것만 필터링
    const notices = allPosts.filter((post) => {
      const label = (post.block_type_label || "").toLowerCase();
      return label.includes("notice") || label.includes("공지");
    });
    
    // 최신순 정렬
    return notices.sort((a, b) => {
      const dateA = new Date(a.created_at).getTime();
      const dateB = new Date(b.created_at).getTime();
      return dateB - dateA;
    });
  } catch (error) {
    console.error("공지 목록 조회 실패:", error);
    return [];
  }
}

/**
 * 공지 상세 조회
 */
export async function fetchNoticeDetail(id: number): Promise<PostEntity | null> {
  try {
    return await fetchPost(id);
  } catch (error) {
    console.error("공지 상세 조회 실패:", error);
    return null;
  }
}
