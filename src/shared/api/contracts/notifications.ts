import api from "@/shared/api/axios";
import { fetchArrivalOverview } from "@/shared/api/contracts/arrivalOverview";

export type OperationalNotificationCounts = {
  qnaPending: number;
  counselPending: number;
  clinicPending: number;
  registrationRequestsPending: number;
  recentSubmissions: number;
  videoFailed: number;
  consultUnread: number;
  reportsPending: number;
  communityUnread: number;
  arrivalsSoon: number;
  arrivalsOverdue: number;
  arrivalsTimeUnset: number;
  total: number;
};

export type OperationalNotificationSource =
  | "qna"
  | "counsel"
  | "clinic"
  | "registration_requests"
  | "submissions"
  | "video_failed"
  | "consult"
  | "reports"
  | "community"
  | "arrivals_soon"
  | "arrivals_overdue"
  | "arrivals_time_unset";

export type OperationalNotificationCountsResult = {
  counts: OperationalNotificationCounts;
  failures: OperationalNotificationSource[];
};

export type OperationalNotificationItem = {
  type: OperationalNotificationSource;
  label: string;
  count: number;
  to: string;
};

export type AdminNotificationCounts = OperationalNotificationCounts;
export type AdminNotificationSource = OperationalNotificationSource;
export type AdminNotificationCountsResult = OperationalNotificationCountsResult;
export type AdminNotificationItem = OperationalNotificationItem;

type ListEnvelope<T> = {
  count?: number;
  results?: T[];
  items?: T[];
};

type CommunityPostRow = {
  replies_count?: number | null;
  author_role?: string | null;
  category_label?: string | null;
};

export function createEmptyOperationalNotificationCounts(): OperationalNotificationCounts {
  return {
    qnaPending: 0,
    counselPending: 0,
    clinicPending: 0,
    registrationRequestsPending: 0,
    recentSubmissions: 0,
    videoFailed: 0,
    consultUnread: 0,
    reportsPending: 0,
    communityUnread: 0,
    arrivalsSoon: 0,
    arrivalsOverdue: 0,
    arrivalsTimeUnset: 0,
    total: 0,
  };
}

function unwrapList<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  const envelope = data as ListEnvelope<T> | null | undefined;
  if (Array.isArray(envelope?.results)) return envelope.results;
  if (Array.isArray(envelope?.items)) return envelope.items;
  return [];
}

function countFromListEnvelope(data: unknown): number {
  const envelope = data as ListEnvelope<unknown> | null | undefined;
  if (typeof envelope?.count === "number") return envelope.count;
  return unwrapList<unknown>(data).length;
}

async function fetchAdminPosts(params: {
  postType?: "qna" | "counsel" | null;
  pageSize?: number;
}): Promise<{ results: CommunityPostRow[]; count: number }> {
  const res = await api.get("/community/admin/posts/", {
    params: {
      post_type: params.postType ?? undefined,
      page: 1,
      page_size: params.pageSize ?? 20,
    },
  });
  const results = unwrapList<CommunityPostRow>(res.data);
  return { results, count: countFromListEnvelope(res.data) };
}

async function countPendingPosts(postType: "qna" | "counsel"): Promise<number | null> {
  try {
    const { results } = await fetchAdminPosts({ postType, pageSize: 100 });
    return results.filter((p) => {
      if (postType === "counsel" && (p.author_role === "staff" || p.category_label === "teacher_internal_memo")) {
        return false;
      }
      return (p.replies_count ?? 0) === 0;
    }).length;
  } catch {
    return null;
  }
}

async function fetchClinicPendingCount(): Promise<number | null> {
  try {
    const res = await api.get("/clinic/participants/", {
      params: { status: "pending", page_size: 1 },
    });
    return countFromListEnvelope(res.data);
  } catch {
    return null;
  }
}

async function fetchRegistrationRequestsPendingCount(): Promise<number | null> {
  try {
    const res = await api.get("/students/registration_requests/", {
      params: { status: "pending", page: 1, page_size: 1 },
    });
    return countFromListEnvelope(res.data);
  } catch {
    return null;
  }
}

async function fetchRecentSubmissionsCount(): Promise<number | null> {
  try {
    const res = await api.get("/submissions/submissions/pending/", { params: { filter: "pending" } });
    return unwrapList<unknown>(res.data).length;
  } catch {
    return null;
  }
}

async function fetchDashboardVideoFailedCount(): Promise<number | null> {
  try {
    const res = await api.get<{ video_failed?: number }>("/results/admin/teacher-dashboard-counts/");
    return Number(res.data?.video_failed ?? 0);
  } catch {
    return null;
  }
}

async function fetchCommunityUnread(): Promise<number | null> {
  try {
    const res = await api.get<{ count?: number }>("/community/notifications/unread-count/");
    return res.data?.count ?? 0;
  } catch (e) {
    const status = (e as { response?: { status?: number } })?.response?.status;
    if (status === 401 || status === 403) return 0;
    return null;
  }
}

async function fetchReportsPending(): Promise<number | null> {
  try {
    const res = await api.get<{ count?: number }>("/community/admin/reports/pending-count/");
    return res.data?.count ?? 0;
  } catch (e) {
    const status = (e as { response?: { status?: number } })?.response?.status;
    if (status === 403) return 0;
    return null;
  }
}

async function fetchConsultUnread(): Promise<number | null> {
  try {
    const res = await api.get<{ summary?: { unread?: number } }>("/core/landing/admin/consult/");
    return res.data?.summary?.unread ?? 0;
  } catch (e) {
    const status = (e as { response?: { status?: number } })?.response?.status;
    if (status === 403) return 0;
    return null;
  }
}

export async function fetchOperationalNotificationCounts(): Promise<OperationalNotificationCountsResult> {
  const [
    clinicPendingRes,
    qnaCount,
    counselCount,
    registrationRequestsRes,
    recentSubmissionsRes,
    videoFailedRes,
    consultRes,
    reportsRes,
    communityRes,
    arrivalRes,
  ] = await Promise.all([
    fetchClinicPendingCount(),
    countPendingPosts("qna"),
    countPendingPosts("counsel"),
    fetchRegistrationRequestsPendingCount(),
    fetchRecentSubmissionsCount(),
    fetchDashboardVideoFailedCount(),
    fetchConsultUnread(),
    fetchReportsPending(),
    fetchCommunityUnread(),
    fetchArrivalOverview().catch(() => null),
  ]);

  const failures: OperationalNotificationSource[] = [];
  if (qnaCount === null) failures.push("qna");
  if (counselCount === null) failures.push("counsel");
  if (clinicPendingRes === null) failures.push("clinic");
  if (registrationRequestsRes === null) failures.push("registration_requests");
  if (recentSubmissionsRes === null) failures.push("submissions");
  if (videoFailedRes === null) failures.push("video_failed");
  if (consultRes === null) failures.push("consult");
  if (reportsRes === null) failures.push("reports");
  if (communityRes === null) failures.push("community");
  if (arrivalRes === null) failures.push("arrivals_soon");

  const qna = qnaCount ?? 0;
  const counsel = counselCount ?? 0;
  const clinicPending = clinicPendingRes ?? 0;
  const registrationRequestsPending = registrationRequestsRes ?? 0;
  const recentSubmissions = recentSubmissionsRes ?? 0;
  const videoFailed = videoFailedRes ?? 0;
  const consultUnread = consultRes ?? 0;
  const reportsPending = reportsRes ?? 0;
  const communityUnread = communityRes ?? 0;
  const arrivalsSoon = arrivalRes?.summary.soon ?? 0;
  const arrivalsOverdue = arrivalRes?.summary.overdue ?? 0;
  const arrivalsTimeUnset = arrivalRes?.summary.time_unset ?? 0;
  const total =
    qna +
    counsel +
    clinicPending +
    registrationRequestsPending +
    recentSubmissions +
    videoFailed +
    consultUnread +
    reportsPending +
    communityUnread +
    arrivalsSoon +
    arrivalsOverdue +
    arrivalsTimeUnset;

  if (failures.length === 10) {
    return { counts: createEmptyOperationalNotificationCounts(), failures };
  }

  return {
    counts: {
      qnaPending: qna,
      counselPending: counsel,
      clinicPending,
      registrationRequestsPending,
      recentSubmissions,
      videoFailed,
      consultUnread,
      reportsPending,
      communityUnread,
      arrivalsSoon,
      arrivalsOverdue,
      arrivalsTimeUnset,
      total,
    },
    failures,
  };
}

export const fetchAdminNotificationCounts = fetchOperationalNotificationCounts;

export function buildOperationalNotificationItems(
  counts: OperationalNotificationCounts
): OperationalNotificationItem[] {
  const items: OperationalNotificationItem[] = [];
  if (counts.videoFailed > 0) {
    items.push({ type: "video_failed", label: "영상 인코딩 실패", count: counts.videoFailed, to: "/workspace/videos" });
  }
  if (counts.arrivalsOverdue > 0) {
    items.push({
      type: "arrivals_overdue",
      label: "예정 시간 지난 등원",
      count: counts.arrivalsOverdue,
      to: "/workspace/dashboard#arrival-overview",
    });
  }
  if (counts.arrivalsSoon > 0) {
    items.push({
      type: "arrivals_soon",
      label: "1시간 내 등원 예정",
      count: counts.arrivalsSoon,
      to: "/workspace/dashboard#arrival-overview",
    });
  }
  if (counts.arrivalsTimeUnset > 0) {
    items.push({
      type: "arrivals_time_unset",
      label: "시간 미정 보강",
      count: counts.arrivalsTimeUnset,
      to: "/workspace/dashboard#arrival-overview",
    });
  }
  if (counts.consultUnread > 0) {
    items.push({ type: "consult", label: "새 상담 요청", count: counts.consultUnread, to: "/workspace/settings/consult" });
  }
  if (counts.reportsPending > 0) {
    items.push({ type: "reports", label: "신고 대기", count: counts.reportsPending, to: "/workspace/community/reports" });
  }
  if (counts.communityUnread > 0) {
    items.push({ type: "community", label: "커뮤니티 새 활동", count: counts.communityUnread, to: "/student/community" });
  }
  if (counts.registrationRequestsPending > 0) {
    items.push({
      type: "registration_requests",
      label: "가입 신청 학생",
      count: counts.registrationRequestsPending,
      to: "/workspace/students/requests",
    });
  }
  if (counts.clinicPending > 0) {
    items.push({ type: "clinic", label: "클리닉 예약 신청", count: counts.clinicPending, to: "/workspace/clinic/bookings" });
  }
  if (counts.counselPending > 0) {
    items.push({ type: "counsel", label: "답변 대기 상담", count: counts.counselPending, to: "/workspace/community/counsel" });
  }
  if (counts.qnaPending > 0) {
    items.push({ type: "qna", label: "답변 대기 질문", count: counts.qnaPending, to: "/workspace/community/qna" });
  }
  if (counts.recentSubmissions > 0) {
    items.push({ type: "submissions", label: "처리 대기 제출", count: counts.recentSubmissions, to: "/workspace/results/submissions" });
  }
  return items;
}

export const buildAdminNotificationItems = buildOperationalNotificationItems;
