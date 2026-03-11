/**
 * 학생 앱 알림 API
 * 클리닉 예약 승인, QnA 답변, 새 영상, 새 성적 등의 알림 카운트 조회
 */
import { fetchMyClinicBookingRequests } from "@/student/domains/clinic/api/clinicBooking.api";
import { fetchMyQuestions } from "@/student/domains/community/api/community.api";

export type NotificationCounts = {
  clinic: number;
  qna: number;
  video: number;
  grade: number;
  total: number;
};

export type FetchNotificationCountsOptions = {
  /** 프로필 id. 전달 시 QnA 질문 조회 가능 */
  profileId?: number | null;
};

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export async function fetchNotificationCounts(
  options?: FetchNotificationCountsOptions
): Promise<NotificationCounts> {
  const sevenDaysAgo = Date.now() - SEVEN_DAYS_MS;

  try {
    const qnaPromise = options?.profileId != null
      ? fetchMyQuestions(options.profileId, 50)
      : Promise.resolve([]);

    const [clinicResult, qnaResult] = await Promise.allSettled([
      fetchMyClinicBookingRequests(),
      qnaPromise,
    ]);

    let clinic = 0;
    if (clinicResult.status === "fulfilled") {
      clinic = clinicResult.value.filter((b) => {
        if (b.status !== "booked" && b.status !== "approved") return false;
        const t = b.status_changed_at ?? b.updated_at ?? b.created_at;
        return new Date(t).getTime() > sevenDaysAgo;
      }).length;
    }

    let qna = 0;
    if (qnaResult.status === "fulfilled") {
      qna = qnaResult.value.filter((p) => {
        if ((p.replies_count || 0) === 0) return false;
        const t = p.updated_at ?? p.created_at;
        return new Date(t).getTime() > sevenDaysAgo;
      }).length;
    }

    const total = clinic + qna;
    return { clinic, qna, video: 0, grade: 0, total };
  } catch {
    return { clinic: 0, qna: 0, video: 0, grade: 0, total: 0 };
  }
}
