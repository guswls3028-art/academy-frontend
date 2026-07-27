import api from "@/shared/api/axios";

export type InboxSource = "support" | "lead" | "incident";
export type InboxType = "bug" | "feedback" | "contact";
export type InboxStatus = "open" | "resolved";

export type InboxReply = {
  id: number;
  post: number;
  question: number;
  content: string;
  created_by: number | null;
  created_by_display: string;
  author_role: string;
  created_at: string;
  is_platform_reply: boolean;
};

export type InboxAttachment = {
  id: number;
  original_name: string;
  size_bytes: number;
  content_type: string;
  created_at: string;
};

export type InboxItem = {
  source: InboxSource;
  id: number;
  tenant_id: number | null;
  tenant_code: string | null;
  tenant_name: string | null;
  title: string;
  subject: string;
  content: string;
  category_label: string | null;
  author_display_name: string | null;
  author_role: string;
  created_at: string;
  status: InboxStatus;
  replies_count: number;
  platform_replies_count: number;
  replies: InboxReply[];
  attachments: InboxAttachment[];
  inquiry_type: InboxType;
  source_label: string;
  content_format: "plain" | "sanitized_html";
  contact_phone: string | null;
  read_at: string | null;
  admin_memo: string;
  context: {
    source?: string;
    route?: string;
    screen_size?: string | null;
    sentry_event_id?: string | null;
    privacy_agreed?: boolean;
    privacy_policy_version?: string;
  };
};

export type InboxSummary = {
  total: number;
  bugs: number;
  feedbacks: number;
  contacts: number;
  open: number;
  resolved: number;
};

export type InboxFilters = {
  type: InboxType | "all";
  status: InboxStatus | "all";
  q: string;
  page: number;
  pageSize: number;
};

export type InboxResponse = {
  results: InboxItem[];
  count: number;
  page: number;
  page_size: number;
  summary: InboxSummary;
};

export async function getInboxItems(filters: InboxFilters): Promise<InboxResponse> {
  const res = await api.get<InboxResponse>("/community/platform/inbox/", {
    params: {
      type: filters.type,
      status: filters.status,
      q: filters.q || undefined,
      page: filters.page,
      page_size: filters.pageSize,
    },
  });
  return res.data;
}

export async function createInboxReply(
  postId: number,
  content: string,
  idempotencyKey: string,
): Promise<InboxReply> {
  const res = await api.post<InboxReply>(
    `/community/platform/inbox/${postId}/replies/`,
    { content, idempotency_key: idempotencyKey },
  );
  return res.data;
}

export async function updateInboxItem(
  item: Pick<InboxItem, "source" | "id">,
  payload: { status: InboxStatus; admin_memo: string },
): Promise<InboxItem> {
  if (item.source === "support") {
    throw new Error("지원 티켓 상태는 답변 등록으로 변경됩니다.");
  }
  const segment = item.source === "lead" ? "leads" : "incidents";
  const res = await api.patch<InboxItem>(
    `/community/platform/inbox/${segment}/${item.id}/`,
    payload,
  );
  return res.data;
}

export async function getInboxAttachmentUrl(
  postId: number,
  attId: number,
): Promise<{ url: string; original_name: string }> {
  const res = await api.get<{ url: string; original_name: string }>(
    `/community/platform/inbox/${postId}/attachments/${attId}/download/`,
  );
  return res.data;
}
