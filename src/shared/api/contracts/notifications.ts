import api from "@/shared/api/axios";
import {
  fetchArrivalOverview,
  type ArrivalOverview,
} from "@/shared/api/contracts/arrivalOverview";
import { isSelfRegistrationDisabledError } from "@/shared/api/contracts/students";

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
  arrivalsTomorrow: number;
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
  | "arrivals_tomorrow"
  | "arrivals_overdue"
  | "arrivals_time_unset";

export type OperationalNotificationCountsResult = {
  counts: OperationalNotificationCounts;
  failures: OperationalNotificationSource[];
  selfRegistrationDisabled: boolean;
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

type OperationalNotificationOptions = {
  includeConsult?: boolean;
  includeRegistrationRequests?: boolean;
};

type ListEnvelope<T> = {
  count?: number;
  results?: T[];
  items?: T[];
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
    arrivalsTomorrow: 0,
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

async function fetchDashboardWorkCounts() {
  const empty = { qna: null, counsel: null, submissions: null, video: null };
  try {
    const { data } = await api.get<Record<string, unknown>>("/results/admin/teacher-dashboard-counts/");
    const read = (key: string): number | null => {
      const value = data?.[key];
      return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
    };
    return { qna: read("qna_pending"), counsel: read("counsel_pending"), submissions: read("submission_pending"), video: read("video_failed") };
  } catch {
    return empty;
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

type RegistrationRequestsPendingCount = {
  count: number | null;
  selfRegistrationDisabled: boolean;
};

async function fetchRegistrationRequestsPendingCount(): Promise<RegistrationRequestsPendingCount> {
  try {
    const res = await api.get("/students/registration_requests/", {
      params: { status: "pending", page: 1, page_size: 1 },
    });
    return {
      count: countFromListEnvelope(res.data),
      selfRegistrationDisabled: false,
    };
  } catch (error) {
    if (isSelfRegistrationDisabledError(error)) {
      return { count: 0, selfRegistrationDisabled: true };
    }
    return { count: null, selfRegistrationDisabled: false };
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

export async function fetchOperationalNotificationCounts(
  loadArrivalOverview: () => Promise<ArrivalOverview> = fetchArrivalOverview,
  options: OperationalNotificationOptions = {},
): Promise<OperationalNotificationCountsResult> {
  const includeConsult = options.includeConsult ?? true;
  const includeRegistrationRequests = options.includeRegistrationRequests ?? true;
  const [
    clinicPendingRes,
    workCounts,
    registrationRequestsRes,
    consultRes,
    reportsRes,
    communityRes,
    arrivalRes,
  ] = await Promise.all([
    fetchClinicPendingCount(),
    fetchDashboardWorkCounts(),
    includeRegistrationRequests
      ? fetchRegistrationRequestsPendingCount()
      : Promise.resolve({ count: 0, selfRegistrationDisabled: true }),
    includeConsult ? fetchConsultUnread() : Promise.resolve(0),
    fetchReportsPending(),
    fetchCommunityUnread(),
    loadArrivalOverview().catch(() => null),
  ]);

  const { qna: qnaCount, counsel: counselCount, submissions: recentSubmissionsRes, video: videoFailedRes } = workCounts;

  const failures: OperationalNotificationSource[] = [];
  if (qnaCount === null) failures.push("qna");
  if (counselCount === null) failures.push("counsel");
  if (clinicPendingRes === null) failures.push("clinic");
  if (registrationRequestsRes.count === null) failures.push("registration_requests");
  if (recentSubmissionsRes === null) failures.push("submissions");
  if (videoFailedRes === null) failures.push("video_failed");
  if (includeConsult && consultRes === null) failures.push("consult");
  if (reportsRes === null) failures.push("reports");
  if (communityRes === null) failures.push("community");
  if (arrivalRes === null) failures.push("arrivals_soon");

  const qna = qnaCount ?? 0;
  const counsel = counselCount ?? 0;
  const clinicPending = clinicPendingRes ?? 0;
  const registrationRequestsPending = registrationRequestsRes.count ?? 0;
  const recentSubmissions = recentSubmissionsRes ?? 0;
  const videoFailed = videoFailedRes ?? 0;
  const consultUnread = consultRes ?? 0;
  const reportsPending = reportsRes ?? 0;
  const communityUnread = communityRes ?? 0;
  const arrivalsSoon = arrivalRes?.summary.soon ?? 0;
  const arrivalsTomorrow = arrivalRes?.items.filter(
    (item) => item.date === arrivalRes.tomorrow && !item.is_resolved,
  ).length ?? 0;
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
    arrivalsTomorrow +
    arrivalsOverdue +
    arrivalsTimeUnset;

  const requestedSourceCount = includeConsult ? 10 : 9;
  if (failures.length === requestedSourceCount) {
    return {
      counts: createEmptyOperationalNotificationCounts(),
      failures,
      selfRegistrationDisabled: registrationRequestsRes.selfRegistrationDisabled,
    };
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
      arrivalsTomorrow,
      arrivalsOverdue,
      arrivalsTimeUnset,
      total,
    },
    failures,
    selfRegistrationDisabled: registrationRequestsRes.selfRegistrationDisabled,
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
  if (counts.arrivalsTomorrow > 0) {
    items.push({
      type: "arrivals_tomorrow",
      label: "내일 등원 준비",
      count: counts.arrivalsTomorrow,
      to: "/workspace/dashboard#arrival-overview",
    });
  }
  if (counts.arrivalsTimeUnset > 0) {
    items.push({
      type: "arrivals_time_unset",
      label: "시간 미정 등원",
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
