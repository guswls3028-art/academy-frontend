/**
 * 학생 앱 알림 API
 * 클리닉 예약 승인, QnA 답변, 새 영상, 새 성적 등의 알림 카운트 조회
 * 실데이터 기반: 내 클리닉 예약, 내 QnA 질문에 달린 답변만 집계
 */
import { fetchMyClinicBookingRequests } from "@/student/domains/clinic/api/clinicBooking.api";
import { fetchMyQnaQuestions } from "@/student/domains/qna/api/qna.api";

export type NotificationCounts = {
  clinic: number; // 클리닉 예약 승인/거부 알림
  qna: number; // QnA 답변 알림
  video: number; // 새 영상 알림
  grade: number; // 새 성적 알림
  total: number; // 전체 알림 수
};

/**
 * 알림 카운트 조회
 * 각 도메인별로 읽지 않은 알림 수를 집계
 * 
 * 최적화:
 * - 병렬 API 호출로 성능 개선
 * - 에러 발생 시 해당 도메인만 0으로 처리
 * - 학생 프로필을 먼저 조회하여 QnA 필터링에 사용
 */
export async function fetchNotificationCounts(): Promise<NotificationCounts> {
  const now = Date.now();
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

  try {
    const [clinicBookings, myQnaQuestions] = await Promise.allSettled([
      fetchMyClinicBookingRequests(),
      fetchMyQnaQuestions(), // 내 질문만 반환 (실데이터)
    ]);

    // 클리닉: 승인된 예약 중 최근 7일 이내 상태 변경된 것
    let clinicCount = 0;
    if (clinicBookings.status === "fulfilled") {
      clinicCount = clinicBookings.value.filter((b) => {
        if (b.status !== "booked" && b.status !== "approved") return false;
        const changeDate = b.status_changed_at
          ? new Date(b.status_changed_at).getTime()
          : b.updated_at
            ? new Date(b.updated_at).getTime()
            : new Date(b.created_at).getTime();
        return changeDate > sevenDaysAgo;
      }).length;
    }

    // QnA: 내 질문에 답변이 달린 것 중 최근 7일 이내
    let qnaCount = 0;
    if (myQnaQuestions.status === "fulfilled") {
      qnaCount = myQnaQuestions.value.filter((p) => {
        if ((p.replies_count || 0) === 0) return false;
        const updatedTime = p.updated_at ? new Date(p.updated_at).getTime() : new Date(p.created_at).getTime();
        return updatedTime > sevenDaysAgo;
      }).length;
    }

    // 영상: 새 영상 알림 (백엔드 API 확장 필요, 현재는 0)
    const videoCount = 0;

    // 성적: 새 성적 알림 (백엔드 API 확장 필요, 현재는 0)
    const gradeCount = 0;

    const total = clinicCount + qnaCount + videoCount + gradeCount;

    return {
      clinic: clinicCount,
      qna: qnaCount,
      video: videoCount,
      grade: gradeCount,
      total,
    };
  } catch (error) {
    console.error("알림 카운트 조회 실패:", error);
    // 에러 발생 시 안전한 기본값 반환
    return {
      clinic: 0,
      qna: 0,
      video: 0,
      grade: 0,
      total: 0,
    };
  }
}
