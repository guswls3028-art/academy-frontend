// PATH: src/student/domains/notices/api/notices.ts
// 학생 앱 공지 API — 관리자 공지사항 탭과 동일 데이터 (GET /community/posts/notices/)

import { fetchNoticePosts, fetchPost, type PostEntity } from "@/features/community/api/community.api";

/**
 * 학생이 볼 수 있는 공지 목록 조회
 * - 관리자 공지사항 탭에서 등록한 공지(post_type=notice)와 동일한 API 사용
 */
export async function fetchNotices(): Promise<PostEntity[]> {
  return await fetchNoticePosts({ pageSize: 50 });
}

/**
 * 공지 상세 조회
 */
export async function fetchNoticeDetail(id: number): Promise<PostEntity | null> {
  return await fetchPost(id);
}
