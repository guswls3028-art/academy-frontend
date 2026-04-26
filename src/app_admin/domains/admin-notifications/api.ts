/**
 * 선생앱(관리자) 알림 — 학생 앱에서 발생한 이벤트 요약
 * - QnA 답변 대기 건수 (학생 질문 등록)
 * - 상담 답변 대기 건수 (학생 상담 신청)
 * - 클리닉 예약 신청 건수 (학생 예약 신청, status=pending)
 * - 가입 신청 대기 건수 (학생 회원가입 신청, status=pending)
 */
import api from "@/shared/api/axios";
import { fetchAdminPosts } from "@admin/domains/community/api/community.api";
import { fetchClinicParticipants } from "@admin/domains/clinic/api/clinicParticipants.api";
import { fetchRegistrationRequests } from "@admin/domains/students/api/students.api";
import { fetchAdminSubmissions } from "@admin/domains/submissions/api/adminSubmissions";

export type AdminNotificationCounts = {
  qnaPending: number;
  counselPending: number;
  clinicPending: number;
  registrationRequestsPending: number;
  recentSubmissions: number;
  videoFailed: number;
  matchupReviewPending: number;
  scorePending: number;
  total: number;
};

export type AdminNotificationItem = {
  type:
    | "qna"
    | "counsel"
    | "clinic"
    | "registration_requests"
    | "submissions"
    | "video_failed"
    | "matchup_review_pending"
    | "score_pending";
  label: string;
  count: number;
  to: string;
};

async function countPendingPosts(postType: "qna" | "counsel"): Promise<number> {
  try {
    const { results } = await fetchAdminPosts({ postType, pageSize: 100 });
    return results.filter((p) => (p.replies_count ?? 0) === 0).length;
  } catch {
    return 0;
  }
}

type DashboardCountsResponse = {
  video_failed?: number;
  matchup_review_pending?: number;
  score_pending?: number;
};

async function fetchDashboardCounts(): Promise<DashboardCountsResponse> {
  try {
    const res = await api.get<DashboardCountsResponse>(
      "/results/admin/teacher-dashboard-counts/"
    );
    return res.data ?? {};
  } catch {
    return {};
  }
}

export async function fetchAdminNotificationCounts(): Promise<AdminNotificationCounts> {
  const empty: AdminNotificationCounts = {
    qnaPending: 0,
    counselPending: 0,
    clinicPending: 0,
    registrationRequestsPending: 0,
    recentSubmissions: 0,
    videoFailed: 0,
    matchupReviewPending: 0,
    scorePending: 0,
    total: 0,
  };

  try {
    const [
      participantsRes,
      qnaCount,
      counselCount,
      registrationRes,
      submissionsRes,
      dashboardCounts,
    ] = await Promise.all([
      fetchClinicParticipants({ status: "pending" }).then((r) => r).catch(() => []),
      countPendingPosts("qna"),
      countPendingPosts("counsel"),
      fetchRegistrationRequests({ status: "pending", page: 1, page_size: 1 }).then(
        (r) => r.count
      ).catch(() => 0),
      // 최근 24시간 내 학생 제출 중 처리 대기 건수
      fetchAdminSubmissions({ limit: 100 }).then((subs) => {
        const pending = subs.filter((s) =>
          s.status === "submitted" || s.status === "dispatched" ||
          s.status === "extracting" || s.status === "needs_identification" ||
          s.status === "answers_ready" || s.status === "grading"
        );
        return pending.length;
      }).catch(() => 0),
      fetchDashboardCounts(),
    ]);

    const clinicPending = Array.isArray(participantsRes) ? participantsRes.length : 0;
    const registrationRequestsPending = typeof registrationRes === "number" ? registrationRes : 0;
    const recentSubmissions = typeof submissionsRes === "number" ? submissionsRes : 0;
    const videoFailed = Number(dashboardCounts.video_failed ?? 0);
    const matchupReviewPending = Number(dashboardCounts.matchup_review_pending ?? 0);
    const scorePending = Number(dashboardCounts.score_pending ?? 0);

    const total =
      qnaCount + counselCount + clinicPending + registrationRequestsPending +
      recentSubmissions + videoFailed + matchupReviewPending + scorePending;

    return {
      qnaPending: qnaCount,
      counselPending: counselCount,
      clinicPending,
      registrationRequestsPending,
      recentSubmissions,
      videoFailed,
      matchupReviewPending,
      scorePending,
      total,
    };
  } catch {
    return empty;
  }
}

export function buildAdminNotificationItems(
  counts: AdminNotificationCounts
): AdminNotificationItem[] {
  const items: AdminNotificationItem[] = [];
  if (counts.qnaPending > 0) {
    items.push({
      type: "qna",
      label: "답변 대기 질문",
      count: counts.qnaPending,
      to: "/admin/community/qna",
    });
  }
  if (counts.counselPending > 0) {
    items.push({
      type: "counsel",
      label: "답변 대기 상담",
      count: counts.counselPending,
      to: "/admin/community/counsel",
    });
  }
  if (counts.clinicPending > 0) {
    items.push({
      type: "clinic",
      label: "클리닉 예약 신청",
      count: counts.clinicPending,
      to: "/admin/clinic/bookings",
    });
  }
  if (counts.registrationRequestsPending > 0) {
    items.push({
      type: "registration_requests",
      label: "가입 신청 학생",
      count: counts.registrationRequestsPending,
      to: "/admin/students/requests",
    });
  }
  if (counts.recentSubmissions > 0) {
    items.push({
      type: "submissions",
      label: "처리 대기 제출",
      count: counts.recentSubmissions,
      to: "/admin/results/submissions",
    });
  }
  if (counts.scorePending > 0) {
    items.push({
      type: "score_pending",
      label: "채점 미완료 응시",
      count: counts.scorePending,
      to: "/admin/results",
    });
  }
  if (counts.matchupReviewPending > 0) {
    items.push({
      type: "matchup_review_pending",
      label: "매치업 검수 대기",
      count: counts.matchupReviewPending,
      to: "/admin/matchup",
    });
  }
  if (counts.videoFailed > 0) {
    items.push({
      type: "video_failed",
      label: "영상 인코딩 실패",
      count: counts.videoFailed,
      to: "/admin/videos",
    });
  }
  return items;
}
