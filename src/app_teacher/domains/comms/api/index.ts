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

/* ─── Scope Nodes ─── */
export interface ScopeNode {
  id: number;
  level: "COURSE" | "SESSION";
  lecture: number;
  session: number | null;
  lecture_title: string;
  session_title: string | null;
}

export async function fetchScopeNodes(): Promise<ScopeNode[]> {
  const res = await api.get("/community/scope-nodes/", { params: { page_size: 500 } });
  const data = res.data;
  if (data != null && Array.isArray(data.results)) return data.results;
  return Array.isArray(data) ? data : [];
}

/* ─── Community ─── */
export async function fetchPosts(postType: string, pageSize = 30, search?: string): Promise<Post[]> {
  const res = await api.get("/community/posts/", {
    params: { post_type: postType, page_size: pageSize, ordering: "-created_at", search: search || undefined },
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

export async function deleteReply(postId: number, replyId: number): Promise<void> {
  await api.delete(`/community/posts/${postId}/replies/${replyId}/`);
}

export async function createPost(data: {
  post_type: string;
  title: string;
  content: string;
  node_ids: number[];
  is_urgent?: boolean;
  is_pinned?: boolean;
}): Promise<Post> {
  const res = await api.post("/community/posts/", data);
  return res.data;
}

export async function updatePost(postId: number, data: { title?: string; content?: string }): Promise<Post> {
  const res = await api.patch(`/community/posts/${postId}/`, data);
  return res.data;
}

export async function deletePost(postId: number): Promise<void> {
  await api.delete(`/community/posts/${postId}/`);
}

export async function togglePostPin(postId: number, isPinned: boolean): Promise<Post> {
  const res = await api.patch(`/community/posts/${postId}/`, { is_pinned: isPinned });
  return res.data;
}

/* ─── Attachments ─── */
export async function uploadPostAttachment(postId: number, file: File): Promise<any> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await api.post(`/community/posts/${postId}/attachments/`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
}

export async function deletePostAttachment(postId: number, attachmentId: number): Promise<void> {
  await api.delete(`/community/posts/${postId}/attachments/${attachmentId}/`);
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

/* ─── Message Log (발송 이력) ─── */
export interface MessageLogItem {
  id: number;
  sent_at: string;
  success: boolean;
  amount_deducted: string;
  recipient_summary?: string;
  template_summary?: string;
  failure_reason?: string | null;
  message_body?: string;
  message_mode?: string;
}

export async function fetchMessageLog(page = 1, pageSize = 20): Promise<{ results: MessageLogItem[]; count: number }> {
  const res = await api.get("/messaging/log/", { params: { page, page_size: pageSize } });
  return { results: res.data?.results ?? [], count: res.data?.count ?? 0 };
}

/* ─── Messaging Info & Templates ─── */
export interface MessagingInfo {
  sms_allowed: boolean;
  messaging_provider: string;
  messaging_sender: string;
  kakao_pfid: string;
  balance?: number;
  sms_price?: number;
  alimtalk_price?: number;
  own_credentials?: boolean;
}

export async function fetchMessagingInfo(): Promise<MessagingInfo> {
  const res = await api.get("/messaging/info/");
  return res.data;
}

export async function updateMessagingInfo(payload: Partial<MessagingInfo & { own_solapi_api_key?: string; own_solapi_api_secret?: string }>): Promise<MessagingInfo> {
  const res = await api.patch("/messaging/info/", payload);
  return res.data;
}

export interface MsgTemplate {
  id: number;
  category: string;
  name: string;
  subject?: string;
  body: string;
  is_default?: boolean;
  is_system?: boolean;
}

export async function fetchAllTemplates(): Promise<MsgTemplate[]> {
  const res = await api.get("/messaging/templates/", { params: { page_size: 200 } });
  const raw = res.data;
  return Array.isArray(raw?.results) ? raw.results : Array.isArray(raw) ? raw : [];
}

export async function createTemplate(payload: { name: string; category: string; body: string; subject?: string }): Promise<MsgTemplate> {
  const res = await api.post("/messaging/templates/", payload);
  return res.data;
}

export async function updateTemplate(id: number, payload: { name?: string; body?: string; subject?: string; category?: string }): Promise<MsgTemplate> {
  const res = await api.patch(`/messaging/templates/${id}/`, payload);
  return res.data;
}

export async function deleteTemplate(id: number): Promise<void> {
  await api.delete(`/messaging/templates/${id}/`);
}

/* ─── Auto-send configs ─── */
export async function fetchAutoSendConfigs() {
  const res = await api.get("/messaging/auto-send-configs/");
  return res.data;
}

export async function updateAutoSendConfigs(configs: any[]) {
  const res = await api.patch("/messaging/auto-send-configs/", configs);
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
