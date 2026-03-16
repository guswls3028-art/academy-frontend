/**
 * 선생앱(관리자) 알림 — 학생 앱에서 발생한 이벤트 요약
 * - QnA 답변 대기 건수 (학생 질문 등록)
 * - 클리닉 예약 신청 건수 (학생 예약 신청, status=pending)
 * - 가입 신청 대기 건수 (학생 회원가입 신청, status=pending)
 */
import { fetchAdminPosts } from "@/features/community/api/community.api";
import { fetchClinicParticipants } from "@/features/clinic/api/clinicParticipants.api";
import { fetchRegistrationRequests } from "@/features/students/api/students";
import { fetchAdminSubmissions } from "@/features/submissions/api/adminSubmissions";

export type AdminNotificationCounts = {
  qnaPending: number;
  clinicPending: number;
  registrationRequestsPending: number;
  recentSubmissions: number;
  total: number;
};

export type AdminNotificationItem = {
  type: "qna" | "clinic" | "registration_requests" | "submissions";
  label: string;
  count: number;
  to: string;
};

export async function fetchAdminNotificationCounts(): Promise<AdminNotificationCounts> {
  try {
    const [participantsRes, typesAndPosts, registrationRes, submissionsRes] = await Promise.all([
      fetchClinicParticipants({ status: "pending" }).then((r) => r).catch(() => []),
      (async () => {
        const { results } = await fetchAdminPosts({ postType: "qna", pageSize: 100 });
        return results.filter((p) => (p.replies_count ?? 0) === 0).length;
      })().catch(() => 0),
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
    ]);

    const qnaPending = typeof typesAndPosts === "number" ? typesAndPosts : 0;
    const clinicPending = Array.isArray(participantsRes) ? participantsRes.length : 0;
    const registrationRequestsPending = typeof registrationRes === "number" ? registrationRes : 0;
    const recentSubmissions = typeof submissionsRes === "number" ? submissionsRes : 0;

    return {
      qnaPending,
      clinicPending,
      registrationRequestsPending,
      recentSubmissions,
      total: qnaPending + clinicPending + registrationRequestsPending + recentSubmissions,
    };
  } catch {
    return { qnaPending: 0, clinicPending: 0, registrationRequestsPending: 0, recentSubmissions: 0, total: 0 };
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
      to: "/admin/results",
    });
  }
  return items;
}
