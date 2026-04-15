// PATH: src/app_teacher/domains/comms/api/index.ts
// 소통 도메인 API — community + registration + messaging
import api from "@/shared/api/axios";

/* ─── Types ─── */
export interface Post {
  id: number;
  post_type: string;
  title: string;
  content: string;
  author_display_name?: string;
  author_role?: string;
  replies_count?: number;
  is_urgent?: boolean;
  is_pinned?: boolean;
  created_at: string;
}

export interface Reply {
  id: number;
  post: number;
  content: string;
  author_display_name?: string;
  author_role?: string;
  created_at: string;
}

export interface RegistrationRequest {
  id: number;
  name: string;
  phone: string;
  parent_phone: string;
  school_type: string;
  grade: string;
  gender: string;
  memo: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  elementary_school?: string;
  middle_school?: string;
  high_school?: string;
}

export interface MessageTemplate {
  id: number;
  name: string;
  category: string;
  subject: string;
  body: string;
}

/* ─── Community ─── */
export async function fetchPosts(postType: string, pageSize = 30): Promise<Post[]> {
  const res = await api.get("/community/posts/", {
    params: { post_type: postType, page_size: pageSize, ordering: "-created_at" },
  });
  const raw = res.data;
  return Array.isArray(raw?.results) ? raw.results : Array.isArray(raw) ? raw : [];
}

export async function fetchPostDetail(postId: number): Promise<Post> {
  const res = await api.get(`/community/posts/${postId}/`);
  return res.data;
}

export async function fetchPostReplies(postId: number): Promise<Reply[]> {
  const res = await api.get(`/community/posts/${postId}/replies/`);
  return Array.isArray(res.data) ? res.data : [];
}

export async function createReply(postId: number, content: string): Promise<Reply> {
  const res = await api.post(`/community/posts/${postId}/replies/`, { content });
  return res.data;
}

/* ─── Registration Requests ─── */
export async function fetchRegistrationRequests(
  status = "pending",
  page = 1,
  pageSize = 20,
): Promise<{ results: RegistrationRequest[]; count: number }> {
  const res = await api.get("/students/registration_requests/", {
    params: { status, page, page_size: pageSize },
  });
  return {
    results: Array.isArray(res.data?.results) ? res.data.results : [],
    count: res.data?.count ?? 0,
  };
}

export async function approveRegistration(id: number): Promise<void> {
  await api.post(`/students/registration_requests/${id}/approve/`);
}

export async function rejectRegistration(id: number): Promise<void> {
  await api.post(`/students/registration_requests/${id}/reject/`);
}

/* ─── Messaging ─── */
export async function fetchMessageTemplates(): Promise<MessageTemplate[]> {
  const res = await api.get("/messaging/templates/", { params: { page_size: 100 } });
  return Array.isArray(res.data?.results) ? res.data.results : Array.isArray(res.data) ? res.data : [];
}

export async function sendMessage(payload: {
  student_ids: number[];
  send_to: "student" | "parent";
  message_mode: "sms" | "alimtalk";
  raw_body: string;
  raw_subject?: string;
  template_id?: number;
}): Promise<{ queued: number }> {
  const res = await api.post("/messaging/send/", payload);
  return res.data;
}

/* ─── Notification Summary (BFF) ─── */
export interface NotificationSummary {
  total: number;
  qna_pending: number;
  registration_pending: number;
  clinic_pending: number;
}

export async function fetchNotificationSummary(): Promise<NotificationSummary> {
  const res = await api.get("/teacher-app/notifications/summary/");
  return res.data;
}
