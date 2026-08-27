// PATH: src/app_admin/domains/clinic/api/clinicParticipants.api.ts
import api from "@/shared/api/axios";
import type { AxiosResponse } from "axios";

export type ClinicParticipantStatus =
  | "pending"
  | "booked"
  | "attended"
  | "no_show"
  | "cancelled"
  | "rejected";

export type ClinicRecipient = "student" | "parent" | "both";

export type ClinicNotificationOutcome = {
  requested: number;
  failed: number;
  send_to: ClinicRecipient;
} | null;

export type ClinicParticipantMutationResult = ClinicParticipant & {
  notification: ClinicNotificationOutcome;
};

export type ClinicParticipant = {
  id: number;

  // ✅ 백엔드 단일진실: session FK
  session: number;

  /** student PK (백엔드 fields="__all__"로 포함) */
  student: number;
  student_name: string;
  enrollment_id?: number;
  clinic_reason?: "exam" | "homework" | "both";

  session_date: string;
  session_title?: string | null;
  session_start_time: string;
  session_end_time?: string;
  session_location: string;

  status: ClinicParticipantStatus;
  preferred_start_time?: string | null;
  preferred_end_time?: string | null;
  /** 학생·학부모 작성 출처가 확인된 요청사항 */
  student_request_memo?: string;
  /** 작성 출처가 불명확한 레거시 운영 메모. 학생에게 노출하지 않음 */
  memo?: string;
  /** 교직원에게만 반환되는 내부 인수인계 메모 */
  staff_memo?: string;
  checked_in_at?: string | null;
  is_late?: boolean;
  checked_out_at?: string | null;
  checked_out_by_name?: string | null;

  // 학생 SSOT 표시용
  lecture_title?: string | null;
  lecture_color?: string | null;
  lecture_chip_label?: string | null;
  name_highlight_clinic_target?: boolean;
  profile_photo_url?: string | null;

  completed_at?: string | null;
  completed_by_name?: string | null;
  planned_clinic_link_ids?: number[];
};

export type ClinicParticipantListParams = {
  session?: number; // ParticipantFilter.session (session_id)
  session_date_from?: string;
  session_date_to?: string;
  onsite_date?: string;
  status?: ClinicParticipantStatus;
};

type ClinicParticipantPage = {
  next: string | null;
  results: ClinicParticipant[];
};

function isPaginatedParticipantPage(value: unknown): value is ClinicParticipantPage {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return Object.prototype.hasOwnProperty.call(row, "next") && Array.isArray(row.results) && (
    row.next === null || (typeof row.next === "string" && row.next.length > 0)
  );
}

function assertUniqueParticipant(
  participant: ClinicParticipant,
  seenIds: Set<number>,
  onsiteDate: string | undefined,
) {
  if (!Number.isInteger(participant.id) || seenIds.has(participant.id)) {
    throw new Error("클리닉 참가자 페이지가 중복되거나 올바르지 않습니다.");
  }
  seenIds.add(participant.id);

  if (!onsiteDate) return;
  if (
    participant.session_date !== onsiteDate ||
    participant.status !== "attended" ||
    !participant.checked_in_at ||
    participant.checked_out_at != null
  ) {
    throw new Error("현재 등원중 참가자 응답에 일관되지 않은 상태가 포함되었습니다.");
  }
}

function assertSafeNextPage(next: string, visited: Set<string>): string {
  const apiBase = new URL(api.defaults.baseURL ?? "/", window.location.origin);
  const resolved = new URL(next, apiBase);
  if (
    resolved.origin !== apiBase.origin ||
    !resolved.pathname.endsWith("/clinic/participants/") ||
    visited.has(resolved.href)
  ) {
    throw new Error("클리닉 참가자 페이지 연결이 올바르지 않습니다.");
  }
  visited.add(resolved.href);
  return resolved.href;
}

export async function fetchClinicParticipants(
  params: ClinicParticipantListParams,
  signal?: AbortSignal,
) {
  const participants: ClinicParticipant[] = [];
  const seenIds = new Set<number>();
  const visitedPages = new Set<string>();
  let next: string | null = "/clinic/participants/";
  let firstPage = true;
  let pagesFetched = 0;

  while (next) {
    pagesFetched += 1;
    if (pagesFetched > 500) {
      throw new Error("클리닉 참가자 페이지 수가 안전 한도를 초과했습니다.");
    }
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    const res: AxiosResponse<unknown> = await api.get(next, {
      params: firstPage ? params : undefined,
      signal,
    });
    firstPage = false;

    if (Array.isArray(res.data)) {
      for (const participant of res.data as ClinicParticipant[]) {
        assertUniqueParticipant(participant, seenIds, params.onsite_date);
        participants.push(participant);
      }
      next = null;
      continue;
    }
    if (!isPaginatedParticipantPage(res.data)) {
      throw new Error("클리닉 참가자 목록 응답 형식이 올바르지 않습니다.");
    }
    for (const participant of res.data.results) {
      assertUniqueParticipant(participant, seenIds, params.onsite_date);
      participants.push(participant);
    }
    next = res.data.next ? assertSafeNextPage(res.data.next, visitedPages) : null;
  }

  if (params.onsite_date) {
    participants.sort((a, b) =>
      (a.checked_in_at ?? "").localeCompare(b.checked_in_at ?? "") ||
      a.session_start_time.localeCompare(b.session_start_time) ||
      a.id - b.id
    );
  }
  return participants;
}

export async function createClinicParticipant(payload: {
  session: number;
  enrollment_id?: number;
  student?: number;
  status?: ClinicParticipantStatus;
  memo?: string;
  source?: string;
  clinic_reason?: "exam" | "homework" | "both";
}) {
  const res = await api.post("/clinic/participants/", payload);
  return res.data as ClinicParticipant;
}

export async function patchClinicParticipantStatus(
  id: number,
  payload: {
    status: ClinicParticipantStatus;
    memo?: string;
    is_late?: boolean;
    send_to?: ClinicRecipient;
  }
) {
  const res = await api.patch(`/clinic/participants/${id}/set_status/`, payload);
  return res.data as ClinicParticipantMutationResult;
}

export async function patchClinicParticipantStaffMemo(id: number, staffMemo: string) {
  const res = await api.patch(`/clinic/participants/${id}/staff-memo/`, {
    staff_memo: staffMemo,
  });
  return res.data as ClinicParticipant;
}

export type ClinicParticipantReminderResult = {
  ok: true;
  status: "ok";
  sent: number;
  scheduled?: number;
  skipped: number;
};

export async function remindClinicParticipant(
  id: number,
  payload: {
    mode: "once" | "repeat";
    send_to: ClinicRecipient;
    interval_minutes?: number;
    repeat_until?: string;
  },
) {
  const res = await api.post<ClinicParticipantReminderResult>(
    `/clinic/participants/${id}/remind/`,
    payload,
  );
  return res.data;
}

export async function checkoutClinicParticipant(
  id: number,
  payload: { send_to: ClinicRecipient },
) {
  const res = await api.post(`/clinic/participants/${id}/checkout/`, payload);
  return res.data as ClinicParticipantMutationResult;
}

export async function replaceClinicParticipantPlan(
  id: number,
  plannedClinicLinkIds: number[],
) {
  const res = await api.put(
    `/clinic/participants/${id}/planned-clinic-links/`,
    { planned_clinic_link_ids: plannedClinicLinkIds },
  );
  return res.data as ClinicParticipant;
}

export async function changeClinicParticipantBooking(
  id: number,
  payload: { new_session_id: number; memo?: string; send_to: ClinicRecipient },
) {
  const res = await api.post(`/clinic/participants/${id}/change-booking/`, payload);
  return res.data as ClinicParticipantMutationResult;
}

export async function completeClinicParticipant(
  id: number,
  payload: { send_to?: ClinicRecipient } = {},
) {
  const res = await api.post(`/clinic/participants/${id}/complete/`, payload);
  return res.data as ClinicParticipantMutationResult;
}

export async function uncompleteClinicParticipant(id: number) {
  const res = await api.post(`/clinic/participants/${id}/uncomplete/`);
  return res.data as ClinicParticipant;
}
