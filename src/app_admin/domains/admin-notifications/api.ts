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
  total: number;
};

/** 알림 카운트 소스 — 1개라도 실패하면 사용자에게 ⚠️ 가시화. 운영 영향 1순위 */
export type AdminNotificationSource =
  | "qna"
  | "counsel"
  | "clinic"
  | "registration_requests"
  | "submissions"
  | "video_failed";

export type AdminNotificationCountsResult = {
  counts: AdminNotificationCounts;
  failures: AdminNotificationSource[];
};

export type AdminNotificationItem = {
  type: AdminNotificationSource;
  label: string;
  count: number;
  to: string;
};

/** 성공 시 0 이상 정수, 실패 시 null */
async function countPendingPosts(
  postType: "qna" | "counsel"
): Promise<number | null> {
  try {
    const { results } = await fetchAdminPosts({ postType, pageSize: 100 });
    return results.filter((p) => (p.replies_count ?? 0) === 0).length;
  } catch {
    return null;
  }
}

type DashboardCountsResponse = {
  video_failed?: number;
};

async function fetchDashboardCounts(): Promise<DashboardCountsResponse | null> {
  try {
    const res = await api.get<DashboardCountsResponse>(
      "/results/admin/teacher-dashboard-counts/"
    );
    return res.data ?? {};
  } catch {
    return null;
  }
}

export async function fetchAdminNotificationCounts(): Promise<AdminNotificationCountsResult> {
  const empty: AdminNotificationCounts = {
    qnaPending: 0,
    counselPending: 0,
    clinicPending: 0,
    registrationRequestsPending: 0,
    recentSubmissions: 0,
    videoFailed: 0,
    total: 0,
  };

  const [
    participantsRes,
    qnaCount,
    counselCount,
    registrationRes,
    submissionsRes,
    dashboardCounts,
  ] = await Promise.all([
    fetchClinicParticipants({ status: "pending" })
      .then((r) => (Array.isArray(r) ? r.length : 0))
      .catch(() => null as number | null),
    countPendingPosts("qna"),
    countPendingPosts("counsel"),
    fetchRegistrationRequests({ status: "pending", page: 1, page_size: 1 })
      .then((r) => r.count)
      .catch(() => null as number | null),
    // 최근 학생 제출 중 처리 대기 건수
    fetchAdminSubmissions({ limit: 100 })
      .then((subs) =>
        subs.filter(
          (s) =>
            s.status === "submitted" ||
            s.status === "dispatched" ||
            s.status === "extracting" ||
            s.status === "needs_identification" ||
            s.status === "answers_ready" ||
            s.status === "grading"
        ).length
      )
      .catch(() => null as number | null),
    fetchDashboardCounts(),
  ]);

  const failures: AdminNotificationSource[] = [];
  if (qnaCount === null) failures.push("qna");
  if (counselCount === null) failures.push("counsel");
  if (participantsRes === null) failures.push("clinic");
  if (registrationRes === null) failures.push("registration_requests");
  if (submissionsRes === null) failures.push("submissions");
  if (dashboardCounts === null) failures.push("video_failed");

  const qna = qnaCount ?? 0;
  const counsel = counselCount ?? 0;
  const clinicPending = participantsRes ?? 0;
  const registrationRequestsPending = registrationRes ?? 0;
  const recentSubmissions = submissionsRes ?? 0;
  const videoFailed = Number(dashboardCounts?.video_failed ?? 0);

  const total =
    qna +
    counsel +
    clinicPending +
    registrationRequestsPending +
    recentSubmissions +
    videoFailed;

  // 모든 소스가 실패한 경우에도 counts는 0으로 안전하게 반환 (UI는 failures로 판단)
  if (failures.length === 6) {
    return { counts: empty, failures };
  }

  return {
    counts: {
      qnaPending: qna,
      counselPending: counsel,
      clinicPending,
      registrationRequestsPending,
      recentSubmissions,
      videoFailed,
      total,
    },
    failures,
  };
}

/**
 * 우선순위(높을수록 위) — P3-6.
 * video_failed       : 운영 critical (인코딩 실패는 학생이 수업 영상을 못 봄)
 * registration_*     : 가입 대기 (학생이 서비스 진입 전 단계 — 블로킹)
 * clinic             : 예약 신청 (시간 임박)
 * counsel            : 상담 답변 대기
 * qna                : 답변 대기 질문
 * submissions        : 처리 대기 제출 (대부분 자동 처리)
 */
export function buildAdminNotificationItems(
  counts: AdminNotificationCounts
): AdminNotificationItem[] {
  const items: AdminNotificationItem[] = [];
  if (counts.videoFailed > 0) {
    items.push({
      type: "video_failed",
      label: "영상 인코딩 실패",
      count: counts.videoFailed,
      to: "/admin/videos",
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
  if (counts.clinicPending > 0) {
    items.push({
      type: "clinic",
      label: "클리닉 예약 신청",
      count: counts.clinicPending,
      to: "/admin/clinic/bookings",
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
  if (counts.qnaPending > 0) {
    items.push({
      type: "qna",
      label: "답변 대기 질문",
      count: counts.qnaPending,
      to: "/admin/community/qna",
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
  return items;
}
