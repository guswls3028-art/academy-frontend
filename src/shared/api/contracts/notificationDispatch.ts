// features/messages/api/notificationDispatch.api.ts
// 수동 알림 발송 API — preview → confirm 2단계
import api from "@/shared/api/axios";

export interface NotificationPreviewLecture {
  lecture_title?: string | null;
  lecture_name?: string | null;
  title?: string | null;
  lecture_color?: string | null;
  color?: string | null;
  lecture_chip_label?: string | null;
  chip_label?: string | null;
}

export interface NotificationPreviewRecipient {
  student_id: number;
  student_name: string;
  phone: string;
  status?: string;
  message_body: string;
  excluded: boolean;
  exclude_reason?: string;
  lectures?: NotificationPreviewLecture[];
  lecture_title?: string | null;
  lecture_color?: string | null;
  color?: string | null;
  lecture_chip_label?: string | null;
  chip_label?: string | null;
}

export interface NotificationPreviewPayload {
  preview_token: string | null;
  recipients: NotificationPreviewRecipient[];
  total_count: number;
  excluded_count: number;
  message_preview?: string;
  session_title?: string | null;
  lecture_title?: string | null;
}

export interface NotificationConfirmResult {
  batch_id: string;
  sent_count: number;
  pending_count: number;
  accepted_count: number;
  failed_count: number;
  blocked_count: number;
}

export async function previewAttendanceNotification(params: {
  session_id: number;
  notification_type: "check_in" | "absent";
  send_to?: "parent" | "student";
}, signal?: AbortSignal): Promise<NotificationPreviewPayload> {
  const { data } = await api.post("/messaging/attendance-notification/preview/", params, { signal });
  return data;
}

export async function confirmAttendanceNotification(
  preview_token: string,
): Promise<NotificationConfirmResult> {
  const { data } = await api.post("/messaging/attendance-notification/confirm/", {
    preview_token,
  });
  return data;
}

// 범용 수동 알림 발송 (시험/과제/퇴원 등)
export async function previewManualNotification(params: {
  trigger: string;
  student_ids?: number[];
  send_to?: "parent" | "student";
  context?: Record<string, string>;
  context_per_student?: Record<number, Record<string, string>>;
  context_source?: Record<string, unknown>;
}, signal?: AbortSignal): Promise<NotificationPreviewPayload> {
  const { data } = await api.post("/messaging/manual-notification/preview/", params, { signal });
  return data;
}

export async function confirmManualNotification(
  preview_token: string,
): Promise<NotificationConfirmResult> {
  const { data } = await api.post("/messaging/manual-notification/confirm/", {
    preview_token,
  });
  return data;
}
