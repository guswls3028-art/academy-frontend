import api from "@/shared/api/axios";
import {
  uploadCommunityPostAttachments,
} from "@/shared/api/contracts/community";
import {
  createSupportTicket,
  listSupportTickets,
  type SupportTicketType,
} from "@/shared/api/contracts/supportTickets";

export function getDeveloperSupportTickets(type: SupportTicketType) {
  return listSupportTickets(api, type);
}

export function createDeveloperSupportTicket(data: {
  type: SupportTicketType;
  subject: string;
  content: string;
  idempotency_key: string;
}) {
  return createSupportTicket(api, data);
}

export function uploadDeveloperPostAttachments(
  postId: number,
  files: File[],
  idempotencyKey?: string,
) {
  return uploadCommunityPostAttachments(api, postId, files, idempotencyKey);
}
