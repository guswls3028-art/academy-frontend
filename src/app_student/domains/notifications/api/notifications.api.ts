/**
 * 학생 앱 알림 API
 * 클리닉 예약 승인, QnA·상담 답변, 새 성적 알림 카운트 조회.
 * (영상 알림은 백엔드 ready_at 시그널 부재로 보류)
 */
import { fetchMyClinicBookingRequests } from "@student/domains/clinic/api/clinicBooking.api";
import { fetchMyQuestions, fetchMyCounselRequests } from "@student/domains/community/api/community.api";
import { fetchMyGradesSummary } from "@student/domains/grades/api/grades.api";
import { isNotificationSeen } from "../hooks/useSeenNotifications";

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
  profileId?: number | null;
};

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export async function fetchNotificationCounts(
  options?: FetchNotificationCountsOptions
): Promise<NotificationCounts> {
  const sevenDaysAgo = Date.now() - SEVEN_DAYS_MS;

  try {
    const hasProfile = options?.profileId != null;
    const qnaPromise = hasProfile ? fetchMyQuestions(options!.profileId!, 50) : Promise.resolve([]);
    const counselPromise = hasProfile ? fetchMyCounselRequests(options!.profileId!, 50) : Promise.resolve([]);

    const [clinicResult, qnaResult, counselResult, gradesResult] = await Promise.allSettled([
      fetchMyClinicBookingRequests(),
      qnaPromise,
      counselPromise,
      fetchMyGradesSummary(),
    ]);

    let clinic = 0;
    if (clinicResult.status === "fulfilled") {
      clinic = clinicResult.value.filter((b) => {
        if (b.status !== "booked" && b.status !== "approved") return false;
        const t = b.status_changed_at ?? b.updated_at ?? b.created_at;
        if (new Date(t).getTime() <= sevenDaysAgo) return false;
        return !isNotificationSeen("clinic", b.id);
      }).length;
    }

    let qna = 0;
    if (qnaResult.status === "fulfilled") {
      qna = qnaResult.value.filter((p) => {
        if ((p.replies_count || 0) === 0) return false;
        const t = p.updated_at ?? p.created_at;
        if (new Date(t).getTime() <= sevenDaysAgo) return false;
        return !isNotificationSeen("qna", p.id);
      }).length;
    }

    let counsel = 0;
    if (counselResult.status === "fulfilled") {
      counsel = counselResult.value.filter((p) => {
        if ((p.replies_count || 0) === 0) return false;
        const t = p.updated_at ?? p.created_at;
        if (new Date(t).getTime() <= sevenDaysAgo) return false;
        return !isNotificationSeen("counsel", p.id);
      }).length;
    }

    let grade = 0;
    if (gradesResult.status === "fulfilled") {
      grade = (gradesResult.value.exams || []).filter((e) => {
        if (!e.submitted_at) return false;
        if (e.meta_status === "NOT_SUBMITTED") return false;
        if (new Date(e.submitted_at).getTime() <= sevenDaysAgo) return false;
        return !isNotificationSeen("grade", e.exam_id);
      }).length;
    }

    const total = clinic + qna + counsel + grade;
    return { clinic, qna, counsel, video: 0, grade, total };
  } catch {
    return { clinic: 0, qna: 0, counsel: 0, video: 0, grade: 0, total: 0 };
  }
}
