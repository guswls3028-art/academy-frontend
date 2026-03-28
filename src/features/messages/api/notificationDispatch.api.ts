// features/messages/api/notificationDispatch.api.ts
// 수동 알림 발송 API — preview → confirm 2단계
import api from "@/shared/api/axios";

export interface NotificationPreviewRecipient {
  student_id: number;
  student_name: string;
  phone: string;
  status: string;
  message_body: string;
  excluded: boolean;
  exclude_reason?: string;
}

export interface NotificationPreviewResponse {
  preview_token: string | null;
  recipients: NotificationPreviewRecipient[];
  total_count: number;
  excluded_count: number;
  message_preview: string;
  session_title: string;
  lecture_title: string;
}

export interface NotificationConfirmResponse {
  batch_id: string;
  sent_count: number;
  failed_count: number;
  blocked_count: number;
}

export async function previewAttendanceNotification(params: {
  session_id: number;
  notification_type: "check_in" | "absent";
  send_to?: "parent" | "student";
}): Promise<NotificationPreviewResponse> {
  const { data } = await api.post("/messaging/attendance-notification/preview/", params);
  return data;
}

export async function confirmAttendanceNotification(
  preview_token: string,
): Promise<NotificationConfirmResponse> {
  const { data } = await api.post("/messaging/attendance-notification/confirm/", {
    preview_token,
  });
  return data;
}
