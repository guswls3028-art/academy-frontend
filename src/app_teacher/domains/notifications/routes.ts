// PATH: src/app_teacher/domains/notifications/routes.ts
// 선생앱 미처리 항목 → 라우트 매핑 SSOT
// TodayPage "지금 처리할 일", TopBar 벨 → NotificationsPage 양쪽이 동일 매핑 사용.
import type { AdminNotificationItem } from "@admin/domains/admin-notifications/api";

export const TEACHER_PENDING_ROUTES: Record<AdminNotificationItem["type"], string> = {
  qna: "/teacher/comms",
  counsel: "/teacher/comms",
  clinic: "/teacher/clinic",
  registration_requests: "/teacher/students",
  submissions: "/teacher/submissions",
  video_failed: "/teacher/videos?status=failed",
};
