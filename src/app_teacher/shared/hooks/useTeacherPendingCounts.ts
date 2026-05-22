// PATH: src/app_teacher/shared/hooks/useTeacherPendingCounts.ts
//
// 선생앱 전용 어댑터 — shared operational notification contract를 teacher 이름으로 노출.
// 추후 teacher 전용 엔드포인트가 생기면 이 어댑터의 내부만 교체하면 됨.
import { useOperationalNotificationCounts } from "@/shared/hooks/useOperationalNotificationCounts";

export type {
  OperationalNotificationCounts as TeacherPendingCounts,
  OperationalNotificationItem as TeacherPendingItem,
  OperationalNotificationSource as TeacherPendingSource,
} from "@/shared/api/contracts/notifications";

export function useTeacherPendingCounts() {
  return useOperationalNotificationCounts();
}
