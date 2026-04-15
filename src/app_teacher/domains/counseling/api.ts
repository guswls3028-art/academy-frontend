// PATH: src/app_teacher/domains/counseling/api.ts
// 상담 메모 API — community posts (post_type=counsel) 기반
import api from "@/shared/api/axios";

/** 상담 메모 목록 (관리자 뷰, counsel 타입) */
export async function fetchCounselingPosts(params?: { page?: number; pageSize?: number }) {
  const res = await api.get("/community/admin/posts/", {
    params: {
      post_type: "counsel",
      page: params?.page ?? 1,
      page_size: params?.pageSize ?? 50,
      ordering: "-created_at",
    },
  });
  const raw = res.data;
  return {
    results: Array.isArray(raw?.results) ? raw.results : Array.isArray(raw) ? raw : [],
    count: raw?.count ?? 0,
  };
}

/** 상담 메모 상세 */
export async function fetchCounselingPost(postId: number) {
  const res = await api.get(`/community/posts/${postId}/`);
  return res.data;
}

/** 상담 답글 목록 */
export async function fetchCounselingReplies(postId: number) {
  const res = await api.get(`/community/posts/${postId}/replies/`);
  const raw = res.data;
  return Array.isArray(raw?.results) ? raw.results : Array.isArray(raw) ? raw : [];
}

/** 상담 메모 작성 */
export async function createCounselingPost(data: {
  title: string;
  content: string;
  node_ids?: number[];
}) {
  const res = await api.post("/community/posts/", {
    ...data,
    post_type: "counsel",
    status: "published",
    node_ids: data.node_ids ?? [],
  });
  return res.data;
}

/** 답글 작성 */
export async function createCounselingReply(postId: number, content: string) {
  const res = await api.post(`/community/posts/${postId}/replies/`, { content });
  return res.data;
}

/** 상담 메모 삭제 */
export async function deleteCounselingPost(postId: number) {
  await api.delete(`/community/posts/${postId}/`);
}
