// PATH: src/dev_app/api/inbox.ts
// Platform inbox API — 크로스테넌트 버그/피드백 수신함

import api from "@/shared/api/axios";

export type InboxReply = {
  id: number;
  post: number;
  question: number;
  content: string;
  created_by: number | null;
  created_by_display: string;
  author_role: string;
  created_at: string;
};

export type InboxAttachment = {
  id: number;
  original_name: string;
  size_bytes: number;
  content_type: string;
  created_at: string;
};

export type InboxPost = {
  id: number;
  tenant_id: number;
  tenant_code: string;
  tenant_name: string;
  title: string;
  content: string;
  category_label: string | null;
  author_display_name: string | null;
  author_role: string;
  created_at: string;
  replies_count: number;
  replies: InboxReply[];
  attachments: InboxAttachment[];
  inquiry_type: "bug" | "feedback";
};

export async function getInboxPosts(type?: "bug" | "feedback" | "all"): Promise<{ results: InboxPost[]; count: number }> {
  const res = await api.get<{ results: InboxPost[]; count: number }>("/community/platform/inbox/", {
    params: type && type !== "all" ? { type } : undefined,
  });
  return res.data;
}

export async function createInboxReply(postId: number, content: string): Promise<InboxReply> {
  const res = await api.post<InboxReply>(`/community/platform/inbox/${postId}/replies/`, { content });
  return res.data;
}

export async function deleteInboxReply(postId: number, replyId: number): Promise<void> {
  await api.delete(`/community/platform/inbox/${postId}/replies/${replyId}/`);
}

export async function getInboxAttachmentUrl(postId: number, attId: number): Promise<{ url: string; original_name: string }> {
  const res = await api.get<{ url: string; original_name: string }>(
    `/community/platform/inbox/${postId}/attachments/${attId}/download/`,
  );
  return res.data;
}
