/**
 * 학생 앱 알림 API
 * 클리닉 예약 승인, QnA·상담 답변, 새 성적 알림 카운트 조회.
 * (영상 알림은 백엔드 ready_at 시그널 부재로 보류)
 */
import { fetchMyClinicBookingRequests } from "@student/domains/clinic/api/clinicBooking.api";
import { fetchMyQuestions, fetchMyCounselRequests } from "@student/domains/community/api/community.api";
import { fetchMyGradesSummary } from "@student/domains/grades/api/grades.api";
import { isNotificationSeen } from "../hooks/useSeenNotifications";
import type { QueryClient } from "@tanstack/react-query";
import { studentQueryKeys } from "@student/shared/api/queryKeys";

export type NotificationCounts = {
  clinic: number;
  qna: number;
  counsel: number;
  video: number;
  grade: number;
  total: number;
};

export type FetchNotificationCountsOptions = {
  /** 프로필 id. 전달 시 QnA·상담 질문 조회 가능 */
  profileId: number;
  queryClient: QueryClient;
};

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export async function fetchNotificationCounts(
  options: FetchNotificationCountsOptions
): Promise<NotificationCounts> {
  const sevenDaysAgo = Date.now() - SEVEN_DAYS_MS;
  // Badge and list share in-flight requests and fresh data. The 50-item notification
  // slices have their own keys so they cannot replace the full community lists.
  const cached = <T,>(queryKey: readonly string[], queryFn: () => Promise<T>) =>
    options.queryClient.fetchQuery({ queryKey, queryFn, staleTime: 30_000, retry: false });

  const [clinicBookings, questions, counselRequests, gradesSummary] = await Promise.all([
    cached(studentQueryKeys.clinicBookings, fetchMyClinicBookingRequests),
    cached(studentQueryKeys.notificationQuestions, () => fetchMyQuestions(options.profileId, 50)),
    cached(studentQueryKeys.notificationCounsel, () => fetchMyCounselRequests(options.profileId, 50)),
    cached(studentQueryKeys.gradesSummary, fetchMyGradesSummary),
  ]);

  const clinic = clinicBookings.filter((b) => {
    if (b.status !== "booked") return false;
    const t = b.status_changed_at ?? b.updated_at ?? b.created_at;
    if (new Date(t).getTime() <= sevenDaysAgo) return false;
    return !isNotificationSeen("clinic", b.id, options?.profileId);
  }).length;

  const qna = questions.filter((p) => {
    if ((p.replies_count || 0) === 0) return false;
    const t = p.updated_at ?? p.created_at;
    if (new Date(t).getTime() <= sevenDaysAgo) return false;
    return !isNotificationSeen("qna", p.id, options?.profileId);
  }).length;

  const counsel = counselRequests.filter((p) => {
    if ((p.replies_count || 0) === 0) return false;
    const t = p.updated_at ?? p.created_at;
    if (new Date(t).getTime() <= sevenDaysAgo) return false;
    return !isNotificationSeen("counsel", p.id, options?.profileId);
  }).length;

  const grade = (gradesSummary.exams || []).filter((e) => {
    if (!e.submitted_at) return false;
    if (e.meta_status === "NOT_SUBMITTED") return false;
    if (new Date(e.submitted_at).getTime() <= sevenDaysAgo) return false;
    return !isNotificationSeen("grade", e.exam_id, options?.profileId);
  }).length;

  const total = clinic + qna + counsel + grade;
  return { clinic, qna, counsel, video: 0, grade, total };
}
