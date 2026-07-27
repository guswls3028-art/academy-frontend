import type { CommunityHttpClient, PostAttachment } from "./community";

export type SupportTicketType = "bug" | "feedback";

export type SupportTicketReply = {
  id: number;
  post: number;
  question: number;
  content: string;
  created_by: number | null;
  created_by_display: string;
  author_role: string;
  created_at: string;
  is_platform_reply: boolean;
  can_delete: boolean;
};

export type SupportTicket = {
  source: "support";
  id: number;
  tenant_id: number;
  tenant_code: string | null;
  tenant_name: string | null;
  title: string;
  subject: string;
  content: string;
  category_label: string | null;
  author_display_name: string | null;
  author_role: string;
  created_at: string;
  status: "open" | "resolved";
  replies_count: number;
  platform_replies_count: number;
  replies: SupportTicketReply[];
  attachments: PostAttachment[];
  inquiry_type: SupportTicketType;
  source_label: string;
  content_format: "sanitized_html";
};

export type SupportTicketListResponse = {
  results: SupportTicket[];
  count: number;
};

export async function listSupportTickets(
  client: CommunityHttpClient,
  type: SupportTicketType | "all" = "all",
): Promise<SupportTicketListResponse> {
  const response = await client.get<SupportTicketListResponse>("/community/support/", {
    params: { type },
  });
  return response.data;
}

export async function createSupportTicket(
  client: CommunityHttpClient,
  payload: {
    type: SupportTicketType;
    subject: string;
    content: string;
    idempotency_key: string;
  },
): Promise<SupportTicket> {
  const response = await client.post<SupportTicket>("/community/support/", payload);
  return response.data;
}

export function supportText(value: string): string {
  if (!value) return "";
  return (new DOMParser().parseFromString(value, "text/html").body.textContent || "").trim();
}
