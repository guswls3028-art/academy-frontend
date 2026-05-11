// PATH: src/app_teacher/domains/notifications/routes.ts
// 선생앱 미처리 항목 → 라우트 매핑 SSOT
// TodayPage "지금 처리할 일", TopBar 벨 → NotificationsPage 양쪽이 동일 매핑 사용.
import type { AdminNotificationItem } from "@admin/domains/admin-notifications/api";

export const TEACHER_PENDING_ROUTES: Record<AdminNotificationItem["type"], string> = {
  qna: "/teacher/comms?tab=qna",
  counsel: "/teacher/comms?tab=counsel",
  clinic: "/teacher/clinic",
  registration_requests: "/teacher/students",
  submissions: "/teacher/submissions",
  video_failed: "/teacher/videos?status=failed",
  consult: "/admin/settings/consult",  // 선생앱에서 클릭 시 PC 어드민 콘솔로 (모바일 앱 페이지는 다음 turn)
  reports: "/admin/community/reports",  // 신고함 — admin console
  community: "/student/community",  // 본인 글 새 활동 — 학생/staff 모두 student community에서 본인 알림 확인
};
