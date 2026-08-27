// PATH: src/app_teacher/domains/notifications/routes.ts
// 선생앱 미처리 항목 → 라우트 매핑 SSOT
// TodayPage "지금 처리할 일", TopBar 벨 → NotificationsPage 양쪽이 동일 매핑 사용.
import type { TeacherPendingItem } from "@teacher/shared/hooks/useTeacherPendingCounts";

export const TEACHER_PENDING_ROUTES: Record<TeacherPendingItem["type"], string> = {
  qna: "/workspace/mobile/comms?tab=qna",
  counsel: "/workspace/mobile/comms?tab=counsel",
  clinic: "/workspace/mobile/clinic",
  registration_requests: "/workspace/mobile/comms?tab=requests",
  submissions: "/workspace/mobile/submissions",
  video_failed: "/workspace/mobile/videos?status=failed",
  consult: "/workspace/settings/consult",  // 선생앱에서 클릭 시 PC 어드민 콘솔로 (모바일 앱 페이지는 다음 turn)
  reports: "/workspace/community/reports",  // 신고함 — admin console
  community: "/student/community",  // 본인 글 새 활동 — 학생/staff 모두 student community에서 본인 알림 확인
  arrivals_soon: "/workspace/dashboard#arrival-overview",
  arrivals_tomorrow: "/workspace/dashboard#arrival-overview",
  arrivals_overdue: "/workspace/dashboard#arrival-overview",
  arrivals_time_unset: "/workspace/dashboard#arrival-overview",
};
