// PATH: src/app_teacher/shared/hooks/useTeacherPendingCounts.ts
//
// 선생앱 전용 어댑터 — admin notifications 데이터를 teacher 경계 안에서만 노출.
// 도메인 경계 보호: app_teacher 코드는 이 어댑터만 import (admin hook 직접 import 금지).
// 추후 teacher 전용 엔드포인트가 생기면 이 어댑터의 내부만 교체하면 됨.
import { useAdminNotificationCounts } from "@admin/domains/admin-notifications/useAdminNotificationCounts";

export type {
  AdminNotificationCounts as TeacherPendingCounts,
  AdminNotificationItem as TeacherPendingItem,
} from "@admin/domains/admin-notifications/api";

export function useTeacherPendingCounts() {
  return useAdminNotificationCounts();
}
