/**
 * 선생앱(관리자) 알림 — 학생 앱에서 발생한 이벤트 요약
 * - QnA 답변 대기 건수 (학생 질문 등록)
 * - 클리닉 예약 신청 건수 (학생 예약 신청, status=pending)
 * - 가입 신청 대기 건수 (학생 회원가입 신청, status=pending)
 */
import { fetchBlockTypes, fetchAdminPosts } from "@/features/community/api/community.api";
import { fetchClinicParticipants } from "@/features/clinic/api/clinicParticipants.api";
import { fetchRegistrationRequests } from "@/features/students/api/students";

export type AdminNotificationCounts = {
  qnaPending: number;
  clinicPending: number;
  registrationRequestsPending: number;
  total: number;
};

export type AdminNotificationItem = {
  type: "qna" | "clinic" | "registration_requests";
  label: string;
  count: number;
  to: string;
};

export async function fetchAdminNotificationCounts(): Promise<AdminNotificationCounts> {
  try {
    const [participantsRes, typesAndPosts, registrationRes] = await Promise.all([
      fetchClinicParticipants({ status: "pending" }).then((r) => r).catch(() => []),
      (async () => {
        const types = await fetchBlockTypes();
        const qnaType = types.find((t) => (t.code || "").toLowerCase() === "qna");
        const posts = qnaType
          ? (await fetchAdminPosts({ blockTypeId: qnaType.id, pageSize: 500 })).results
          : [];
        return posts.filter((p) => (p.replies_count ?? 0) === 0).length;
      })().catch(() => 0),
      fetchRegistrationRequests({ status: "pending", page: 1, page_size: 1 }).then(
        (r) => r.count
      ).catch(() => 0),
    ]);

    const qnaPending = typeof typesAndPosts === "number" ? typesAndPosts : 0;
    const clinicPending = Array.isArray(participantsRes) ? participantsRes.length : 0;
    const registrationRequestsPending = typeof registrationRes === "number" ? registrationRes : 0;

    return {
      qnaPending,
      clinicPending,
      registrationRequestsPending,
      total: qnaPending + clinicPending + registrationRequestsPending,
    };
  } catch (e) {
    console.error("fetchAdminNotificationCounts:", e);
    return { qnaPending: 0, clinicPending: 0, registrationRequestsPending: 0, total: 0 };
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
  return items;
}
