/**
 * PATH: src/features/clinic/pages/OperationsConsolePage/ClinicConsoleWorkspace.tsx
 * 선택한 클리닉 수업의 대상자 관리 — 운영 헤더 + 상태 필터 + 처리 큐 + 상세 드로어
 * 재설계: 단순 카드 나열 → 운영/처리 워크스페이스
 */

import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import dayjs from "dayjs";
import "dayjs/locale/ko";

import {
  FileQuestion,
  BookOpen,
  CheckCircle,
  XCircle,
  X,
  UserPlus,
  Clock,
  MapPin,
  Users,
  CheckCheck,
  ShieldCheck,
  RotateCcw,
  ArrowRightCircle,
  Ban,
  CircleCheckBig,
  Undo2,
  Pencil,
  Trash2,
  MessageCircle,
  Bell,
  BellOff,
  BellRing,
  CalendarClock,
  Send,
  UserMinus,
} from "lucide-react";
import type { ClinicSessionDetail, ClinicSessionTreeNode } from "../../api/clinicSessions.api";
import type {
  ClinicNotificationOutcome,
  ClinicParticipant,
  ClinicParticipantReminderResult,
} from "../../api/clinicParticipants.api";
import {
  patchClinicParticipantStatus,
  createClinicParticipant,
  changeClinicParticipantBooking,
  checkoutClinicParticipant,
  completeClinicParticipant,
  remindClinicParticipant,
  replaceClinicParticipantPlan,
  patchClinicParticipantStaffMemo,
  uncompleteClinicParticipant,
} from "../../api/clinicParticipants.api";
import { fetchClinicSessions } from "../../api/clinicSessions.api";
import type { ClinicTarget } from "../../api/clinicTargets";
import { getCutlineLabel } from "../BookingsPage/remediationFormatters";
import { useClinicTargets } from "../../hooks/useClinicTargets";
import {
  resolveClinicLink,
  waiveClinicLink,
  waiveMissingExamTarget,
  carryOverClinicLink,
  submitClinicRetake,
} from "../../api/clinicLinks.api";
import { fetchAdminExam, updateAdminExam } from "@admin/domains/exams/api/adminExam";
import { feedback } from "@/shared/ui/feedback/feedback";
import { useAutoSendConfig } from "@admin/domains/messages/hooks/useAutoSendConfig";
import NotificationPreviewModal from "@/shared/ui/notifications/NotificationPreviewModal";
import ClinicTargetSelectModal from "../../components/ClinicTargetSelectModal";
import type { ClinicTargetSelectResult } from "../../components/ClinicTargetSelectModal";
import ClinicManualHomeworkCompleteDialog from "../../components/ClinicManualHomeworkCompleteDialog";
import { buildParticipantPayload } from "../../utils/buildParticipantPayload";
import StudentNameWithLectureChip from "@/shared/ui/chips/StudentNameWithLectureChip";
import { hhmmText } from "@/shared/ui/time/timeFormat";
import { clinicQueryKeys } from "../../queryKeys";
import {
  canCompleteManualHomework,
  canWaiveMissingExamWithoutLink,
  clinicTargetKey,
  completeManualHomework,
  isMissingExamTarget,
  isPositiveClinicIdentifier,
  requiresManualHomeworkCompletion,
} from "../../api/completeManualHomework";
import ClinicParticipantActionDialog, {
  type ClinicParticipantAction,
  type ClinicParticipantActionPayload,
  type ClinicRecipient,
} from "../../components/ClinicParticipantActionDialog";
import { useConfirm } from "@/shared/ui/confirm";

dayjs.locale("ko");

const SECTION_BADGE_STYLE: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  padding: "2px 8px",
  borderRadius: 999,
  background: "color-mix(in srgb, var(--color-brand-primary) 14%, var(--color-bg-surface))",
  color: "var(--color-brand-primary)",
  border: "1px solid color-mix(in srgb, var(--color-brand-primary) 24%, transparent)",
};
const CONFIRM_BAR_DELTA_STYLE: CSSProperties = { marginRight: 8 };
const CUTLINE_MARKER_STYLE: CSSProperties = { left: "100%" };

function clinicActionErrorMessage(error: unknown, fallback: string): string {
  if (!isAxiosError(error)) return fallback;
  const detail = (error.response?.data as { detail?: unknown } | undefined)?.detail;
  return typeof detail === "string" && detail.trim() ? detail : fallback;
}

function reportClinicNotification(
  successMessage: string,
  notification: ClinicNotificationOutcome,
) {
  if (notification?.failed) {
    feedback.warning(
      `${successMessage} 상태는 저장됐지만 알림톡 요청 ${notification.requested}건 완료, ${notification.failed}건 실패했습니다.`,
    );
    return;
  }
  if (notification?.requested) {
    feedback.success(`${successMessage} · 알림톡 요청 완료 (${notification.requested}건)`);
    return;
  }
  feedback.success(successMessage);
}

const StudentsDetailOverlay = lazy(
  () => import("@admin/domains/students/public/StudentsDetailOverlay")
);

/* ── helpers ── */

function formatReasonLabel(reason: string | undefined): string {
  if (reason === "exam") return "시험 미통과";
  if (reason === "homework") return "과제 미통과";
  if (reason === "both") return "시험·과제 미통과";
  return "클리닉 대상";
}

function formatScoreDetail(target: ClinicTarget): string {
  const parts: string[] = [];

  const isExamSource = target.source_type === "exam" || (
    target.source_type == null &&
    (target.clinic_reason === "exam" || target.clinic_reason === "both")
  );
  if (isExamSource) {
    if (target.reason === "missing") {
      parts.push("시험 미응시");
    } else if (target.exam_score != null && target.cutline_score != null) {
      parts.push(`시험 ${target.exam_score}/${target.cutline_score}점`);
    } else {
      parts.push("시험 미통과");
    }
  }

  if (
    target.source_type === "homework" ||
    target.clinic_reason === "homework" ||
    target.clinic_reason === "both"
  ) {
    if (target.reason === "missing") {
      parts.push("과제 미제출");
    } else if (target.homework_score != null && target.homework_cutline != null) {
      parts.push(
        `과제 ${target.homework_score}점 / 기준 ${getCutlineLabel(target)}`,
      );
    } else {
      parts.push("과제 미통과");
    }
  }

  if (parts.length === 0) {
    parts.push(formatReasonLabel(target.clinic_reason));
  }

  return parts.join(" · ");
}

function getTargetReasonLabel(target: ClinicTarget): string {
  if (isMissingHomeworkTarget(target)) return "과제 미제출";
  if (isMissingExamTarget(target)) return "시험 미응시";
  return formatReasonLabel(target.clinic_reason);
}

function getTargetDisplayTitle(target: ClinicTarget): string {
  return target.source_title?.trim() || target.session_title?.trim() || getTargetReasonLabel(target);
}

function getTargetContext(target: ClinicTarget): string {
  const context = [target.lecture_title?.trim(), target.session_title?.trim()]
    .filter((value, index, values): value is string => !!value && values.indexOf(value) === index);
  return context.join(" · ");
}

function isMissingHomeworkTarget(target: ClinicTarget): boolean {
  return target.reason === "missing" && target.source_type === "homework";
}

function getStatusLabel(status: string): string {
  if (status === "pending") return "승인 대기";
  if (status === "booked") return "미등원";
  if (status === "attended") return "등원";
  if (status === "no_show") return "결석";
  if (status === "cancelled") return "취소";
  if (status === "rejected") return "거절";
  return "미확인";
}

function getParticipantStatusLabel(participant: ClinicParticipant): string {
  if (participant.checked_out_at) {
    return participant.checkout_mode === "arrival_not_recorded"
      ? "미등원 하원 완료"
      : "하원 완료";
  }
  if (participant.status === "attended" && participant.is_late) return "지각 등원";
  return getStatusLabel(participant.status);
}

function preferredTimeText(participant: ClinicParticipant): string | null {
  if (!participant.preferred_start_time || !participant.preferred_end_time) return null;
  return `${hhmmText(participant.preferred_start_time, "-")}–${hhmmText(participant.preferred_end_time, "-")}`;
}

function getResolutionLabel(type: string | null | undefined): string {
  if (type === "EXAM_PASS") return "시험 통과";
  if (type === "HOMEWORK_PASS") return "과제 통과";
  if (type === "MANUAL_OVERRIDE") return "수동 통과";
  if (type === "WAIVED") return "면제";
  if (type === "BOOKING_LEGACY") return "레거시";
  return "";
}

function getCycleLabel(cycle: number | undefined): string {
  if (!cycle || cycle <= 1) return "";
  return `${cycle}차`;
}

function widthPercentStyle(percent: number): CSSProperties {
  return { width: `${percent}%` };
}

function scoreWidthStyle(score: number, cutline: number): CSSProperties {
  return widthPercentStyle(Math.min(100, (score / cutline) * 100));
}

type StatusFilter = "all" | "requests" | "pending" | "attended" | "no_show";

function isActiveRosterParticipant(participant: ClinicParticipant): boolean {
  return participant.status !== "cancelled" && participant.status !== "rejected";
}

type ClinicStudentGroup = {
  key: string;
  participants: ClinicParticipant[];
};

function participantStudentKey(participant: ClinicParticipant): string {
  return Number.isInteger(participant.student) && participant.student > 0
    ? `student:${participant.student}`
    : `participant:${participant.id}`;
}

function groupParticipantsByStudent(participants: ClinicParticipant[]): ClinicStudentGroup[] {
  const groups = new Map<string, ClinicStudentGroup>();
  for (const participant of participants) {
    const key = participantStudentKey(participant);
    const existing = groups.get(key);
    if (existing) {
      existing.participants.push(participant);
    } else {
      groups.set(key, { key, participants: [participant] });
    }
  }
  return [...groups.values()];
}

function countStudents(participants: ClinicParticipant[]): number {
  return groupParticipantsByStudent(participants).length;
}

function participantForTarget(
  participants: ClinicParticipant[],
  target: ClinicTarget,
): ClinicParticipant | null {
  const plannedOwners = participants.filter((participant) =>
    (participant.planned_clinic_link_ids ?? []).includes(target.clinic_link_id ?? -1)
  );
  if (plannedOwners.length === 1) return plannedOwners[0];

  const enrollmentMatches = participants.filter(
    (participant) => participant.enrollment_id === target.enrollment_id,
  );
  if (enrollmentMatches.length === 1) return enrollmentMatches[0];
  return participants.length === 1 ? participants[0] : null;
}

function isApprovalPending(status: string): boolean {
  return status === "pending";
}

function isAttendancePending(status: string): boolean {
  return status === "booked";
}

function supportsClinicOperations(status: string): boolean {
  return status === "pending" || status === "booked" || status === "no_show" || status === "attended";
}

type Props = {
  selectedDate: string;
  session: ClinicSessionTreeNode | null;
  participants: ClinicParticipant[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  workspaceMode: "onsite" | "day";
  isAggregate: boolean;
  onEditSession?: (sessionId: number) => void;
  onDeleteSession?: (sessionId: number, label: string) => void;
  changeNoticeDraft?: {
    sessionId: number;
    oldSchedule: string;
    newSchedule: string;
  } | null;
  onChangeNoticeConsumed?: () => void;
};

export default function ClinicConsoleWorkspace({
  selectedDate,
  session,
  participants,
  isLoading,
  isError,
  onRetry,
  workspaceMode,
  isAggregate,
  onEditSession,
  onDeleteSession,
  changeNoticeDraft,
  onChangeNoticeConsumed,
}: Props) {
  const qc = useQueryClient();
  const confirm = useConfirm();
  // Drawer stores participant ID only — derive live data from participants prop
  const [drawerParticipantId, setDrawerParticipantId] = useState<number | null>(null);
  const [drawerActiveTargetKey, setDrawerActiveTargetKey] = useState<string | null>(null);
  const [drawerParticipantContextConfirmed, setDrawerParticipantContextConfirmed] = useState(false);
  const [staffMemoDraft, setStaffMemoDraft] = useState("");
  const [staffMemoSaving, setStaffMemoSaving] = useState(false);
  const drawerTriggerRef = useRef<HTMLElement | null>(null);
  const drawerRef = useRef<HTMLDivElement | null>(null);
  const drawerHeadingRef = useRef<HTMLHeadingElement | null>(null);
  const planToggleRef = useRef<HTMLButtonElement | null>(null);
  const pendingPlanFocusRef = useRef<{ participantId: number; clinicLinkId: number } | null>(null);
  const [studentOverlayId, setStudentOverlayId] = useState<number | null>(null);
  const [addStudentModalOpen, setAddStudentModalOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  // Per-participant pending tracking for rapid processing
  const [mutatingIds, setMutatingIds] = useState<Set<number>>(new Set());
  const [actionDialog, setActionDialog] = useState<{
    participant: ClinicParticipant;
    action: ClinicParticipantAction;
  } | null>(null);
  const [rescheduleParticipant, setRescheduleParticipant] = useState<ClinicParticipant | null>(null);
  const [rescheduleMode, setRescheduleMode] = useState<"absence" | "booking">("absence");
  const [rescheduleRecipient, setRescheduleRecipient] = useState<ClinicRecipient>("parent");
  const [replacementSessions, setReplacementSessions] = useState<ClinicSessionDetail[]>([]);
  const [replacementSessionId, setReplacementSessionId] = useState("");
  const [replacementSessionsLoading, setReplacementSessionsLoading] = useState(false);
  const [replacementSessionsError, setReplacementSessionsError] = useState(false);
  // 출석/불참 체크 상태 (API 호출 전 로컬 상태)
  const [pendingStatuses, setPendingStatuses] = useState<Map<number, "attended" | "no_show">>(new Map());

  // Inline retake score input: clinic_link_id → score string
  const [retakeScores, setRetakeScores] = useState<Map<number, string>>(new Map());
  const [retakingIds, setRetakingIds] = useState<Set<number>>(new Set());
  const [completingIds, setCompletingIds] = useState<Set<number>>(new Set());
  const [planningParticipantIds, setPlanningParticipantIds] = useState<Set<number>>(new Set());
  // Prevent double-click on remediation actions (resolve/waive/carryover/retake)
  const [remediatingLinkIds, setRemediatingLinkIds] = useState<Set<number>>(new Set());
  const [completeTarget, setCompleteTarget] = useState<ClinicTarget | null>(null);
  const [waiveTarget, setWaiveTarget] = useState<ClinicTarget | null>(null);
  const [waivingTargetKey, setWaivingTargetKey] = useState<string | null>(null);

  const { configs: autoSendConfigs, toggleEnabled, isToggling } = useAutoSendConfig();
  const clinicTargetsQuery = useClinicTargets();
  const {
    data: clinicTargets,
    isLoading: clinicTargetsLoading,
    isError: clinicTargetsError,
  } = clinicTargetsQuery;

  // 알림 설정 미리보기 팝업
  const [previewTrigger, setPreviewTrigger] = useState<string | null>(null);
  const [changeNoticeOpen, setChangeNoticeOpen] = useState(false);

  // 발송 완료 팝업
  const [sendResult, setSendResult] = useState<{
    type: "attended" | "no_show";
    students: { name: string; id: number }[];
    messageBody: string;
  } | null>(null);
  const [sendResultPreviewOpen, setSendResultPreviewOpen] = useState(false);

  // 세션 변경 시 로컬 상태 전체 초기화 (메시지 선택 포함)
  const sessionId = session?.id;
  const workspaceContextKey = isAggregate ? `aggregate:${workspaceMode}` : `session:${sessionId ?? "none"}`;
  const prevWorkspaceContextRef = useRef(workspaceContextKey);
  useEffect(() => {
    if (prevWorkspaceContextRef.current === workspaceContextKey) return;
    prevWorkspaceContextRef.current = workspaceContextKey;
    setPendingStatuses(new Map());
    setMutatingIds(new Set());
    setCompletingIds(new Set());
    setRetakingIds(new Set());
    setRetakeScores(new Map());
    setRemediatingLinkIds(new Set());
    setCompleteTarget(null);
    setWaiveTarget(null);
    setWaivingTargetKey(null);
    setPlanningParticipantIds(new Set());
    setDrawerParticipantId(null);
    setDrawerActiveTargetKey(null);
    setDrawerParticipantContextConfirmed(false);
    drawerTriggerRef.current = null;
    setSendResult(null);
    setSendResultPreviewOpen(false);
    setPreviewTrigger(null);
    setChangeNoticeOpen(false);
    setStatusFilter("all");
    setActionDialog(null);
    setRescheduleParticipant(null);
    setReplacementSessions([]);
    setReplacementSessionId("");
    setAddStudentModalOpen(false);
  }, [workspaceContextKey]);

  // ESC 통합 핸들러: 트리거 미리보기 닫기.
  // (발송 완료 팝업은 capture phase로 별도 등록되어 가장 먼저 처리됨)
  useEffect(() => {
    if (!previewTrigger) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (previewTrigger) {
        setPreviewTrigger(null);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [previewTrigger]);

  // 발송 완료 팝업: Enter/ESC로 닫기 (capture phase로 등록하여 drawer ESC보다 먼저 처리)
  useEffect(() => {
    if (!sendResult) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Enter") {
        e.stopImmediatePropagation();
        setSendResult(null);
        setSendResultPreviewOpen(false);
      }
    };
    document.addEventListener("keydown", handler, true);
    return () => document.removeEventListener("keydown", handler, true);
  }, [sendResult]);

  // Build enrollment_id → ClinicTarget[] map for O(1) lookup
  const targetsByEnrollment = useMemo(() => {
    const map = new Map<number, ClinicTarget[]>();
    if (!clinicTargets) return map;
    for (const t of clinicTargets) {
      const existing = map.get(t.enrollment_id);
      if (existing) {
        existing.push(t);
      } else {
        map.set(t.enrollment_id, [t]);
      }
    }
    return map;
  }, [clinicTargets]);

  // A clinic booking owns one enrollment, but the work queue belongs to the
  // student. Keep every unresolved target from the student's active courses.
  const targetsByStudent = useMemo(() => {
    const map = new Map<number, ClinicTarget[]>();
    if (!clinicTargets) return map;
    for (const target of clinicTargets) {
      if (target.student_id == null) continue;
      const existing = map.get(target.student_id);
      if (existing) {
        existing.push(target);
      } else {
        map.set(target.student_id, [target]);
      }
    }
    return map;
  }, [clinicTargets]);

  const invalidateAll = useCallback(async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: clinicQueryKeys.targets }),
      qc.invalidateQueries({ queryKey: clinicQueryKeys.participants }),
      qc.invalidateQueries({ queryKey: clinicQueryKeys.sessionsTree }),
      qc.invalidateQueries({ queryKey: clinicQueryKeys.notificationCounts }),
    ]);
  }, [qc]);

  const timeLabel = hhmmText(session?.start_time, "—");
  const dateLabel = dayjs(selectedDate).format("M월 D일 (dd)");
  const rosterParticipants = useMemo(
    () => (isAggregate ? participants : participants.filter(isActiveRosterParticipant)),
    [isAggregate, participants],
  );
  const changeNoticeStudentIds = useMemo(() => {
    const ids = new Set<number>();
    for (const participant of participants) {
      if (participant.status === "cancelled" || participant.status === "rejected") continue;
      if (participant.student) ids.add(participant.student);
    }
    return [...ids];
  }, [participants]);
  const changeNoticeContextSource = useMemo(
    () => {
      if (!session) return undefined;
      const source: Record<string, unknown> = {
        type: "clinic_session_change",
        session_id: session.id,
      };
      if (changeNoticeDraft?.sessionId === session.id && changeNoticeDraft.oldSchedule) {
        source.old_schedule = changeNoticeDraft.oldSchedule;
      }
      return source;
    },
    [changeNoticeDraft, session]
  );
  const hasFreshChangeNotice = !!session && changeNoticeDraft?.sessionId === session.id;

  /* ── progress ── */
  const progress = useMemo(() => {
    const attended = countStudents(rosterParticipants.filter((p) => p.status === "attended"));
    const noShow = countStudents(rosterParticipants.filter((p) => p.status === "no_show"));
    const completed = countStudents(rosterParticipants.filter((p) => !!p.completed_at));
    const approvalPending = countStudents(rosterParticipants.filter((p) => isApprovalPending(p.status)));
    const pending = countStudents(rosterParticipants.filter((p) => isAttendancePending(p.status)));
    const total = countStudents(rosterParticipants.filter((p) =>
      p.status === "attended" || p.status === "no_show" || isAttendancePending(p.status)
    ));
    return { attended, noShow, pending, approvalPending, completed, total };
  }, [rosterParticipants]);
  const studentCount = useMemo(() => countStudents(rosterParticipants), [rosterParticipants]);

  const pendingIds = useMemo(
    () =>
      rosterParticipants
        .filter((p) => isAttendancePending(p.status))
        .map((p) => p.id),
    [rosterParticipants]
  );

  /* ── filtered list — 미확인 우선, 불참 다음, 출석 마지막 ── */
  const filteredParticipants = useMemo(() => {
    let list: ClinicParticipant[];
    if (statusFilter === "all") list = [...rosterParticipants];
    else if (statusFilter === "requests")
      list = rosterParticipants.filter((p) => isApprovalPending(p.status));
    else if (statusFilter === "attended")
      list = rosterParticipants.filter((p) => p.status === "attended");
    else if (statusFilter === "no_show")
      list = rosterParticipants.filter((p) => p.status === "no_show");
    else
      list = rosterParticipants.filter((p) => isAttendancePending(p.status));
    if (workspaceMode === "onsite") {
      list.sort((a, b) =>
        (a.checked_in_at ?? "").localeCompare(b.checked_in_at ?? "") ||
        a.session_start_time.localeCompare(b.session_start_time) ||
        a.id - b.id
      );
      return list;
    }
    // Sort: approval requests → attendance queue → no_show → attended.
    const ORDER: Record<string, number> = { pending: 0, booked: 1, no_show: 2, attended: 3 };
    list.sort((a, b) => (ORDER[a.status] ?? 0) - (ORDER[b.status] ?? 0));
    return list;
  }, [rosterParticipants, statusFilter, workspaceMode]);
  const filteredParticipantGroups = useMemo(
    () => groupParticipantsByStudent(filteredParticipants),
    [filteredParticipants],
  );

  /* ── Drawer: derive from live participants ── */
  const drawerParticipant = useMemo(
    () => (drawerParticipantId != null ? rosterParticipants.find((p) => p.id === drawerParticipantId) ?? null : null),
    [drawerParticipantId, rosterParticipants]
  );
  const drawerParticipantGroup = useMemo(() => {
    if (!drawerParticipant) return [];
    const key = participantStudentKey(drawerParticipant);
    return rosterParticipants.filter((participant) => participantStudentKey(participant) === key);
  }, [drawerParticipant, rosterParticipants]);
  const drawerContextRequired = drawerParticipantGroup.length > 1 && !drawerParticipantContextConfirmed;

  useEffect(() => {
    setStaffMemoDraft(drawerParticipant?.staff_memo ?? "");
  }, [drawerParticipant?.id, drawerParticipant?.staff_memo]);

  async function saveStaffMemo() {
    if (!drawerParticipant || staffMemoSaving) return;
    setStaffMemoSaving(true);
    try {
      await patchClinicParticipantStaffMemo(drawerParticipant.id, staffMemoDraft.trim());
      await qc.invalidateQueries({ queryKey: clinicQueryKeys.participants });
      feedback.success("교직원 인수인계 메모를 저장했습니다.");
    } catch {
      feedback.error("교직원 인수인계 메모를 저장하지 못했습니다.");
    } finally {
      setStaffMemoSaving(false);
    }
  }

  const closeDrawer = useCallback(() => {
    const trigger = drawerTriggerRef.current;
    pendingPlanFocusRef.current = null;
    setDrawerParticipantId(null);
    setDrawerActiveTargetKey(null);
    setDrawerParticipantContextConfirmed(false);
    window.requestAnimationFrame(() => {
      if (trigger?.isConnected) trigger.focus();
    });
  }, []);

  const openDrawer = useCallback((
    participantId: number,
    targetKey: string | null,
    trigger: HTMLElement,
    contextConfirmed = true,
  ) => {
    drawerTriggerRef.current = trigger;
    setDrawerParticipantId(participantId);
    setDrawerActiveTargetKey(targetKey);
    setDrawerParticipantContextConfirmed(contextConfirmed);
  }, []);

  // Close drawer if participant was removed from list
  useEffect(() => {
    if (drawerParticipantId != null && !drawerParticipant) {
      closeDrawer();
    }
  }, [closeDrawer, drawerParticipantId, drawerParticipant]);

  // Modal keyboard contract: initial focus, Escape close, and focus trap.
  useEffect(() => {
    if (drawerParticipantId == null) return;
    drawerHeadingRef.current?.focus();
    function handleKeyDown(e: KeyboardEvent) {
      if (actionDialog || rescheduleParticipant) return;
      if (e.key === "Escape") {
        e.preventDefault();
        closeDrawer();
        return;
      }
      if (e.key !== "Tab" || !drawerRef.current) return;
      const focusable = Array.from(
        drawerRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const activeElement = document.activeElement;
      if (
        e.shiftKey &&
        (activeElement === first || activeElement === drawerHeadingRef.current)
      ) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && activeElement === last) {
        e.preventDefault();
        first.focus();
      } else if (activeElement == null || !drawerRef.current.contains(activeElement)) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [actionDialog, closeDrawer, drawerParticipantId, rescheduleParticipant]);

  async function handleClinicAction(payload: ClinicParticipantActionPayload) {
    if (!actionDialog || mutatingIds.has(actionDialog.participant.id)) return;
    const { participant: p, action } = actionDialog;
    const recipient: ClinicRecipient = payload.send_to ?? (action === "remind" ? "student" : "parent");
    setMutatingIds((prev) => new Set(prev).add(p.id));
    try {
      let notification: ClinicNotificationOutcome = null;
      let reminder: ClinicParticipantReminderResult | null = null;
      if (action === "arrive" || action === "late" || action === "absent") {
        const result = await patchClinicParticipantStatus(p.id, {
          status: action === "absent" ? "no_show" : "attended",
          is_late: action === "late",
          send_to: recipient,
        });
        notification = result.notification;
      } else if (action === "checkout") {
        const withoutArrival = !p.checked_in_at;
        const result = await checkoutClinicParticipant(p.id, withoutArrival ? {
          confirm_without_arrival: true,
          expected_session_id: p.session,
          expected_student_id: p.student,
          send_to: recipient,
        } : { send_to: recipient });
        notification = result.notification;
      } else {
        reminder = await remindClinicParticipant(p.id, {
          mode: payload.mode ?? "once",
          send_to: recipient,
          interval_minutes: payload.interval_minutes,
          repeat_until: payload.repeat_until,
        });
      }

      setActionDialog(null);
      await invalidateAll();
      if (action === "absent") {
        await openRescheduleDialog(p, "absence", recipient);
        reportClinicNotification(`${p.student_name} 결석 처리 완료`, notification);
      } else if (action === "remind" && reminder) {
        const scheduled = reminder.scheduled ?? 0;
        if (reminder.skipped > 0) {
          feedback.warning(
            `${p.student_name} 재촉 알림톡 요청 ${reminder.sent + scheduled}건 완료, ${reminder.skipped}건 제외되었습니다.`,
          );
        } else {
          feedback.success(
            `${p.student_name} 재촉 알림톡 요청 완료 (${reminder.sent + scheduled}건)`,
          );
        }
      } else {
        const label = action === "arrive" ? "등원" : action === "late" ? "지각 등원" : "하원";
        const checkoutLabel = p.checked_in_at ? "하원" : "미등원 하원";
        reportClinicNotification(
          `${p.student_name} ${action === "checkout" ? checkoutLabel : label} 처리 완료`,
          notification,
        );
      }
    } catch (error) {
      await invalidateAll();
      feedback.error(
        clinicActionErrorMessage(
          error,
          "클리닉 처리에 실패했습니다. 상태와 알림 설정을 확인해 주세요.",
        ),
      );
    } finally {
      setMutatingIds((prev) => {
        const next = new Set(prev);
        next.delete(p.id);
        return next;
      });
    }
  }

  function closeRescheduleDialog() {
    setRescheduleParticipant(null);
    setReplacementSessionId("");
    setReplacementSessions([]);
    setReplacementSessionsError(false);
  }

  async function openRescheduleDialog(
    participant: ClinicParticipant,
    mode: "absence" | "booking",
    recipient: ClinicRecipient = "parent",
  ) {
    setRescheduleParticipant(participant);
    setRescheduleMode(mode);
    setRescheduleRecipient(recipient);
    setReplacementSessionId("");
    setReplacementSessions([]);
    setReplacementSessionsLoading(true);
    setReplacementSessionsError(false);
    try {
      const rows = await fetchClinicSessions({
        date_from: participant.session_date,
        date_to: dayjs(participant.session_date).add(30, "day").format("YYYY-MM-DD"),
        ordering: "date,start_time,id",
      });
      setReplacementSessions(rows.filter((row) => row.id !== participant.session));
    } catch {
      setReplacementSessionsError(true);
      feedback.error("변경할 클리닉 일정을 불러오지 못했습니다.");
    } finally {
      setReplacementSessionsLoading(false);
    }
  }

  async function handleReschedule() {
    if (!rescheduleParticipant || !replacementSessionId || mutatingIds.has(rescheduleParticipant.id)) return;
    const participant = rescheduleParticipant;
    const participantId = participant.id;
    const isBookingChange = rescheduleMode === "booking";
    setMutatingIds((prev) => new Set(prev).add(participantId));
    try {
      const result = await changeClinicParticipantBooking(participantId, {
        new_session_id: Number(replacementSessionId),
        memo: isBookingChange ? "교직원 예약 일정 변경" : "결석 후 보충 일정 이동",
        send_to: rescheduleRecipient,
      });
      closeRescheduleDialog();
      if (drawerParticipantId === participantId) closeDrawer();
      await invalidateAll();
      reportClinicNotification(
        isBookingChange
          ? `${participant.student_name} 학생 일정을 변경했습니다.`
          : "보충 일정을 옮겼습니다.",
        result.notification,
      );
    } catch (error) {
      feedback.error(
        clinicActionErrorMessage(
          error,
          isBookingChange ? "일정 변경에 실패했습니다." : "보충 일정 이동에 실패했습니다.",
        ),
      );
    } finally {
      setMutatingIds((prev) => {
        const next = new Set(prev);
        next.delete(participantId);
        return next;
      });
    }
  }

  async function handleCancelBooking(participant: ClinicParticipant) {
    if (mutatingIds.has(participant.id)) return;
    const confirmed = await confirm({
      title: "클리닉 명단에서 빼기",
      message: "아래 학생과 일정을 확인해 주세요.",
      confirmText: "명단에서 빼기",
      cancelText: "돌아가기",
      danger: true,
      review: {
        eyebrow: "취소 전 확인",
        items: [
          { label: "학생", value: participant.student_name, tone: "accent" },
          {
            label: "일정",
            value: `${dayjs(participant.session_date).format("M/D")} ${hhmmText(participant.session_start_time, "시간 미정")}`,
          },
          { label: "장소", value: participant.session_location || "장소 미정" },
          { label: "알림", value: "보호자 취소 알림톡 요청", tone: "warning" },
        ],
        note: "명단에서는 제외되지만 기존 예약과 취소 이력은 보존됩니다.",
      },
    });
    if (!confirmed) return;

    setMutatingIds((prev) => new Set(prev).add(participant.id));
    try {
      const result = await patchClinicParticipantStatus(participant.id, {
        status: "cancelled",
        send_to: "parent",
      });
      if (drawerParticipantId === participant.id) closeDrawer();
      await invalidateAll();
      reportClinicNotification(
        `${participant.student_name} 학생을 명단에서 뺐습니다.`,
        result.notification,
      );
    } catch (error) {
      await invalidateAll();
      feedback.error(clinicActionErrorMessage(error, "명단에서 빼기에 실패했습니다."));
    } finally {
      setMutatingIds((prev) => {
        const next = new Set(prev);
        next.delete(participant.id);
        return next;
      });
    }
  }

  async function handleBookingDecision(
    p: ClinicParticipant,
    target: "booked" | "rejected"
  ) {
    if (mutatingIds.has(p.id)) return;
    setMutatingIds((prev) => new Set(prev).add(p.id));
    try {
      const result = await patchClinicParticipantStatus(p.id, { status: target });
      await invalidateAll();
      reportClinicNotification(
        target === "booked" ? "예약을 승인했습니다." : "예약을 거절했습니다.",
        result.notification,
      );
    } catch (error) {
      await invalidateAll();
      feedback.error(
        clinicActionErrorMessage(
          error,
          target === "booked" ? "예약 승인에 실패했습니다." : "예약 거절에 실패했습니다.",
        ),
      );
    } finally {
      setMutatingIds((prev) => {
        const next = new Set(prev);
        next.delete(p.id);
        return next;
      });
    }
  }

  /* ── 일괄 출석/결석 알림 발송 ── */
  async function handleBulkConfirmStatuses() {
    const entries = Array.from(pendingStatuses.entries());
    if (entries.length === 0) return;
    // Double-click guard: if any pending id is already mutating, bail out
    if (entries.some(([id]) => mutatingIds.has(id))) return;

    // 이미 같은 상태인 항목 필터 — 불필요한 API 호출 방지
    const actualEntries = entries.filter(([id, status]) => {
      const p = participants.find((pp) => pp.id === id);
      return p && p.status !== status;
    });
    if (actualEntries.length === 0) {
      feedback.info("변경할 항목이 없습니다. 이미 같은 상태입니다.");
      setPendingStatuses(new Map());
      return;
    }
    // 스킵된 항목은 pending에서 제거
    if (actualEntries.length < entries.length) {
      const skippedNames = entries
        .filter(([id, status]) => { const p = participants.find((pp) => pp.id === id); return p && p.status === status; })
        .map(([id]) => participants.find((pp) => pp.id === id)?.student_name)
        .filter(Boolean);
      if (skippedNames.length > 0) {
        feedback.info(`${skippedNames.join(', ')}은(는) 이미 같은 상태 — 건너뜀`);
      }
    }

    const ids = actualEntries.map(([id]) => id);
    setMutatingIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      return next;
    });

    const results = await Promise.allSettled(
      actualEntries.map(([id, status]) => patchClinicParticipantStatus(id, { status }))
    );

    const failed = results.filter((result) => result.status === "rejected").length;
    const fulfilled = results.filter((result) => result.status === "fulfilled");
    const succeeded = fulfilled.length;
    const notificationRequested = fulfilled.reduce(
      (sum, result) => sum + (result.value.notification?.requested ?? 0),
      0,
    );
    const notificationFailed = fulfilled.reduce(
      (sum, result) => sum + (result.value.notification?.failed ?? 0),
      0,
    );

    await invalidateAll();
    setPendingStatuses(new Map());
    setMutatingIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.delete(id));
      return next;
    });

    if (failed > 0) {
      const notificationFailure = notificationFailed > 0
        ? ` · 알림톡 요청 ${notificationRequested}건 완료, ${notificationFailed}건 실패`
        : "";
      feedback.error(`${succeeded}명 처리 완료, ${failed}명 상태 저장 실패${notificationFailure}`);
    } else if (notificationFailed > 0) {
      feedback.warning(
        `${succeeded}명 상태 저장 완료, 알림톡 요청 ${notificationRequested}건 완료, ${notificationFailed}건 실패`,
      );
    } else if (notificationRequested === 0) {
      feedback.success(`${succeeded}명 상태 저장 완료`);
    } else {
      // 알림톡 요청 완료 팝업 — provider delivery가 아닌 enqueue 결과
      // 출석/결석 혼합이면 출석 기준으로 표시
      const attendedStudents = actualEntries
        .filter(([, st]) => st === "attended")
        .map(([id]) => participants.find((pp) => pp.id === id))
        .filter(Boolean) as ClinicParticipant[];
      const noShowStudents = actualEntries
        .filter(([, st]) => st === "no_show")
        .map(([id]) => participants.find((pp) => pp.id === id))
        .filter(Boolean) as ClinicParticipant[];
      const primaryType: "attended" | "no_show" = attendedStudents.length >= noShowStudents.length ? "attended" : "no_show";
      const allStudents = actualEntries
        .map(([id]) => participants.find((pp) => pp.id === id))
        .filter(Boolean) as ClinicParticipant[];
      const trigger = primaryType === "attended" ? "clinic_check_in" : "clinic_absent";
      const cfg = autoSendConfigs.find((c) => c.trigger === trigger);
      setSendResultPreviewOpen(false);
      setSendResult({
        type: primaryType,
        students: allStudents.map((s) => ({ name: s.student_name, id: s.student })),
        messageBody: cfg?.template_body || "",
      });
    }
  }

  /* ── 클리닉 완료/취소 ── */
  async function handleComplete(p: ClinicParticipant) {
    if (completingIds.has(p.id)) return;
    setCompletingIds((prev) => new Set(prev).add(p.id));
    try {
      const result = await completeClinicParticipant(p.id);
      await invalidateAll();
      reportClinicNotification(`${p.student_name} 세션 처리 완료`, result.notification);
    } catch (error) {
      feedback.error(clinicActionErrorMessage(error, "완료 처리에 실패했습니다."));
    } finally {
      setCompletingIds((prev) => {
        const next = new Set(prev);
        next.delete(p.id);
        return next;
      });
    }
  }

  function handleUncomplete(p: ClinicParticipant) {
    if (completingIds.has(p.id)) return;
    setCompletingIds((prev) => new Set(prev).add(p.id));
    uncompleteClinicParticipant(p.id)
      .then(() => {
        invalidateAll();
        feedback.success("완료 취소됨");
      })
      .catch(() => feedback.error("완료 취소에 실패했습니다."))
      .finally(() => {
        setCompletingIds((prev) => {
          const next = new Set(prev);
          next.delete(p.id);
          return next;
        });
      });
  }

  /* ── 인라인 재시험/과제 점수 입력 ── */
  function handleRetakeSubmit(clinicLinkId: number, maxScore?: number | null) {
    const scoreStr = retakeScores.get(clinicLinkId);
    const score = parseFloat(scoreStr ?? "");
    if (isNaN(score) || score < 0) {
      feedback.error("올바른 점수를 입력하세요.");
      return;
    }
    const effectiveMax = maxScore ?? 100;
    if (effectiveMax > 0 && score > effectiveMax) {
      feedback.error(`최대 점수(${effectiveMax})를 초과할 수 없습니다.`);
      return;
    }
    setRetakingIds((prev) => new Set(prev).add(clinicLinkId));
    submitClinicRetake(clinicLinkId, { score })
      .then((result) => {
        if (result.passed) {
          feedback.success(`통과! (${result.score}점)`);
        } else {
          feedback.warning(`미통과 (${result.score}점) — 재도전 필요`);
        }
        qc.invalidateQueries({ queryKey: clinicQueryKeys.targets });
        qc.invalidateQueries({ queryKey: clinicQueryKeys.participants });
        setRetakeScores((prev) => {
          const next = new Map(prev);
          next.delete(clinicLinkId);
          return next;
        });
      })
      .catch(() => feedback.error("점수 입력에 실패했습니다."))
      .finally(() => {
        setRetakingIds((prev) => {
          const next = new Set(prev);
          next.delete(clinicLinkId);
          return next;
        });
      });
  }

  function getTargetsForParticipant(p: ClinicParticipant): ClinicTarget[] {
    if (clinicTargetsLoading || clinicTargetsError) return [];
    let targets = targetsByStudent.get(p.student) ?? [];
    if (targets.length === 0 && p.enrollment_id) {
      targets = (targetsByEnrollment.get(p.enrollment_id) ?? []).filter(
        (target) => target.student_id == null || target.student_id === p.student,
      );
    }
    return [...targets].sort((left, right) => {
      const byCreated = dayjs(right.created_at).valueOf() - dayjs(left.created_at).valueOf();
      if (Number.isFinite(byCreated) && byCreated !== 0) return byCreated;
      return String(right.session_title ?? "").localeCompare(String(left.session_title ?? ""), "ko", { numeric: true });
    });
  }

  async function handleManualHomeworkComplete(target: ClinicTarget, memo: string) {
    const linkId = target.clinic_link_id;
    if (!linkId) {
      feedback.error("과제 완료에 필요한 정보가 부족합니다. 목록을 새로고침해 주세요.");
      return;
    }

    setRemediatingLinkIds((prev) => new Set(prev).add(linkId));
    try {
      await completeManualHomework(target, memo);
      const refreshed = await clinicTargetsQuery.refetch();
      const targetKey = clinicTargetKey(target);
      if (
        refreshed.isError ||
        !Array.isArray(refreshed.data) ||
        refreshed.data.some((item) => !item.resolved_at && clinicTargetKey(item) === targetKey)
      ) {
        throw new Error("homework_completion_not_persisted");
      }
      await qc.invalidateQueries({ queryKey: clinicQueryKeys.participants });
      setCompleteTarget(null);
      feedback.success("과제 제출 확인을 저장하고 목록을 다시 확인했습니다.");
    } catch {
      feedback.error("완료 상태를 다시 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setRemediatingLinkIds((prev) => {
        const next = new Set(prev);
        next.delete(linkId);
        return next;
      });
    }
  }

  async function handleMissingExamWaive(target: ClinicTarget, memo: string) {
    const targetKey = clinicTargetKey(target);
    const linkId = isPositiveClinicIdentifier(target.clinic_link_id)
      ? target.clinic_link_id
      : null;
    if (!isMissingExamTarget(target) || (!linkId && !canWaiveMissingExamWithoutLink(target))) {
      feedback.error("시험 면제에 필요한 정보가 부족합니다. 목록을 새로고침해 주세요.");
      return;
    }

    setWaivingTargetKey(targetKey);
    try {
      if (linkId) {
        await waiveClinicLink(linkId, memo);
      } else {
        await waiveMissingExamTarget({
          session_id: target.session_id!,
          enrollment_id: target.enrollment_id,
          exam_id: target.exam_id!,
          memo,
        });
      }
      await Promise.all([
        qc.invalidateQueries({ queryKey: clinicQueryKeys.targets }),
        qc.invalidateQueries({ queryKey: clinicQueryKeys.participants }),
      ]);
      setWaiveTarget(null);
      feedback.success("시험 미응시 사유와 면제 처리를 저장했습니다.");
    } catch {
      feedback.error("시험 면제 처리에 실패했습니다. 다시 시도해 주세요.");
    } finally {
      setWaivingTargetKey(null);
    }
  }

  const drawerTargets = drawerParticipant ? getTargetsForParticipant(drawerParticipant) : [];
  const drawerUnresolvedTargets = drawerTargets.filter((target) => !target.resolved_at);
  const activeDrawerTarget = drawerUnresolvedTargets.find(
    (target) => clinicTargetKey(target) === drawerActiveTargetKey,
  ) ?? drawerUnresolvedTargets[0] ?? null;
  const activeDrawerTargetIsPlanned = !drawerContextRequired && activeDrawerTarget != null &&
    isPositiveClinicIdentifier(activeDrawerTarget.clinic_link_id) &&
    (drawerParticipant?.planned_clinic_link_ids ?? []).includes(activeDrawerTarget.clinic_link_id);

  useEffect(() => {
    const pending = pendingPlanFocusRef.current;
    if (!pending || planningParticipantIds.has(pending.participantId)) return;
    if (
      drawerParticipant?.id !== pending.participantId ||
      drawerActiveTargetKey !== `link:${pending.clinicLinkId}`
    ) {
      pendingPlanFocusRef.current = null;
      return;
    }
    const toggle = planToggleRef.current;
    if (!toggle || toggle.disabled) return;
    pendingPlanFocusRef.current = null;
    toggle.focus();
  }, [drawerActiveTargetKey, drawerParticipant?.id, planningParticipantIds]);

  async function handleToggleTodayPlan(
    participant: ClinicParticipant,
    clinicLinkId: number,
  ) {
    if (!drawerParticipantContextConfirmed || drawerParticipant?.id !== participant.id) {
      feedback.error("처리할 클리닉 시간대를 먼저 선택해 주세요.");
      return;
    }
    if (planningParticipantIds.has(participant.id)) return;
    const validIds = new Set(
      getTargetsForParticipant(participant)
        .filter((target) => !target.resolved_at && isPositiveClinicIdentifier(target.clinic_link_id))
        .map((target) => target.clinic_link_id as number),
    );
    const currentIds = (participant.planned_clinic_link_ids ?? []).filter((id) => validIds.has(id));
    const nextIds = currentIds.includes(clinicLinkId)
      ? currentIds.filter((id) => id !== clinicLinkId)
      : [...currentIds, clinicLinkId];
    nextIds.sort((left, right) => left - right);

    pendingPlanFocusRef.current = { participantId: participant.id, clinicLinkId };
    setPlanningParticipantIds((current) => new Set(current).add(participant.id));
    try {
      const updated = await replaceClinicParticipantPlan(participant.id, nextIds);
      qc.setQueriesData<ClinicParticipant[]>(
        { queryKey: clinicQueryKeys.participants },
        (current) => current?.map((row) => row.id === updated.id ? updated : row),
      );
      await qc.invalidateQueries({ queryKey: clinicQueryKeys.participants });
      feedback.success(nextIds.includes(clinicLinkId) ? "오늘 할 일에 추가했습니다." : "오늘 할 일에서 뺐습니다.");
    } catch {
      feedback.error("오늘 할 일 저장에 실패했습니다. 최신 상태를 다시 불러옵니다.");
      await Promise.all([
        qc.invalidateQueries({ queryKey: clinicQueryKeys.participants }),
        qc.invalidateQueries({ queryKey: clinicQueryKeys.targets }),
      ]);
    } finally {
      setPlanningParticipantIds((current) => {
        const next = new Set(current);
        next.delete(participant.id);
        return next;
      });
    }
  }

  const filterCounts = {
    all: studentCount,
    requests: progress.approvalPending,
    pending: progress.pending,
    attended: progress.attended,
    no_show: progress.noShow,
  };

  const filters: { key: StatusFilter; label: string }[] = [
    { key: "all", label: "전체" },
    { key: "requests", label: "승인 대기" },
    { key: "pending", label: "미등원" },
    { key: "attended", label: "등원" },
    { key: "no_show", label: "결석" },
  ];

  return (
    <>
      {clinicTargetsLoading && (
        <div className="clinic-ops__target-query-state" role="status" aria-live="polite">
          클리닉 과제 정보를 불러오는 중입니다.
        </div>
      )}
      {clinicTargetsError && (
        <div
          className="clinic-ops__target-query-state clinic-ops__target-query-state--error"
          role="alert"
        >
          <span>클리닉 과제 정보를 불러오지 못했습니다.</span>
          <button
            type="button"
            className="clinic-ops__target-query-retry"
            onClick={() => clinicTargetsQuery.refetch()}
            disabled={clinicTargetsQuery.isFetching}
          >
            {clinicTargetsQuery.isFetching ? "다시 불러오는 중…" : "다시 시도"}
          </button>
        </div>
      )}
      {/* ═══ A. 운영 헤더 — 처리 워크스페이스 밴드 ═══ */}
      <div className="clinic-ops__header">
        {/* 핵심 식별 + 액션 */}
        <div className="clinic-ops__header-top">
          <div className="clinic-ops__header-info">
            <div className="clinic-ops__header-title-row">
              <h3 className="clinic-ops__header-date">{dateLabel}</h3>
              {isAggregate && (
                <span className="clinic-ops__header-session-name clinic-ops__header-session-name--live">
                  {workspaceMode === "onsite" ? "현재 현장" : "전체 시간"}
                </span>
              )}
              {session?.section_label && (
                <span
                  style={SECTION_BADGE_STYLE}
                  aria-label={`${session.section_label}반`}
                >
                  {session.section_label}반
                </span>
              )}
              {session?.title && (
                <span className="clinic-ops__header-session-name">{session.title}</span>
              )}
            </div>
            <div className="clinic-ops__header-meta">
              <span className="clinic-ops__header-meta-item">
                <Clock size={16} aria-hidden />
                {isAggregate ? "여러 시간대" : timeLabel}
              </span>
              {session?.location && (
                <span className="clinic-ops__header-meta-item">
                  <MapPin size={16} aria-hidden />
                  {session.location}
                </span>
              )}
              <span className="clinic-ops__header-meta-item clinic-ops__header-meta-item--count">
                <Users size={16} aria-hidden />
                {workspaceMode === "onsite" ? "현장" : "학생"}
                {!isLoading && !isError && <> <strong>{studentCount}</strong>명</>}
                {progress.approvalPending > 0 && (
                  <span className="clinic-ops__header-meta-note">
                    승인 대기 {progress.approvalPending}
                  </span>
                )}
              </span>
            </div>
          </div>

          {!isAggregate && (
            <div className="clinic-ops__header-actions">
              {selectedDate >= dayjs().format("YYYY-MM-DD") && onEditSession && session && (
              <button
                type="button"
                className="clinic-ops__action-btn clinic-ops__action-btn--ghost"
                onClick={() => onEditSession(session.id)}
                title="클리닉 수정"
              >
                <Pencil size={14} aria-hidden />
                수정
              </button>
              )}
              {selectedDate >= dayjs().format("YYYY-MM-DD") && onDeleteSession && session && (
              <button
                type="button"
                className="clinic-ops__action-btn clinic-ops__action-btn--danger"
                onClick={() => {
                  const label = `${hhmmText(session.start_time, "—")} ${session.location || ""}`.trim();
                  onDeleteSession(session.id, label);
                }}
                title="클리닉 삭제"
              >
                <Trash2 size={14} aria-hidden />
                삭제
              </button>
              )}
              <button
              type="button"
              className="clinic-ops__action-btn clinic-ops__action-btn--secondary"
              onClick={() => setAddStudentModalOpen(true)}
            >
              <UserPlus size={14} aria-hidden />
              학생 추가
              </button>
              {changeNoticeStudentIds.length > 0 && (
              <button
                type="button"
                className={`clinic-ops__action-btn clinic-ops__action-btn--notice ${
                  hasFreshChangeNotice ? "clinic-ops__action-btn--notice-hot" : ""
                }`}
                onClick={() => setChangeNoticeOpen(true)}
                title="수정된 클리닉 정보를 보호자에게 발송"
              >
                <BellRing size={14} aria-hidden />
                {hasFreshChangeNotice ? "수정 알림 보내기" : "변경 알림"}
              </button>
              )}
              {!isLoading && !isError && pendingIds.length > 0 && (
              <button
                type="button"
                className="clinic-ops__action-btn clinic-ops__action-btn--primary"
                onClick={() => {
                  setPendingStatuses((prev) => {
                    const next = new Map(prev);
                    pendingIds.forEach((id) => next.set(id, "attended"));
                    return next;
                  });
                }}
              >
                <CheckCheck size={14} aria-hidden />
                전체 출석 체크 ({pendingIds.length}명)
              </button>
              )}
            </div>
          )}
        </div>

        {hasFreshChangeNotice && (
          <div className="clinic-ops__change-alert">
            <div className="clinic-ops__change-alert-copy">
              <span className="clinic-ops__change-alert-kicker">수정 내용 저장됨</span>
              <strong className="clinic-ops__change-alert-title">
                보호자에게 보낼 변경 알림을 확인하세요.
              </strong>
              <span className="clinic-ops__change-alert-route">
                {changeNoticeDraft?.oldSchedule} → {changeNoticeDraft?.newSchedule}
              </span>
            </div>
            <button
              type="button"
              className="clinic-ops__change-alert-cta"
              onClick={() => setChangeNoticeOpen(true)}
            >
              <BellRing size={16} aria-hidden />
              미리보기 열기
            </button>
          </div>
        )}

        {/* KPI 밴드 — 운영 현황 한 줄 요약 */}
        {!isLoading && !isError && rosterParticipants.length > 0 && (
          <div className="clinic-ops__kpi-row">
            <div className="clinic-ops__kpi-counters">
              {progress.pending > 0 && (
                <div className="clinic-ops__kpi clinic-ops__kpi--pending clinic-ops__kpi--highlight">
                  <span className="clinic-ops__kpi-value">{progress.pending}</span>
                  <span className="clinic-ops__kpi-label">미확인</span>
                </div>
              )}
              {progress.approvalPending > 0 && (
                <div className="clinic-ops__kpi clinic-ops__kpi--approval clinic-ops__kpi--highlight">
                  <span className="clinic-ops__kpi-value">{progress.approvalPending}</span>
                  <span className="clinic-ops__kpi-label">승인 대기</span>
                </div>
              )}
              <div className="clinic-ops__kpi clinic-ops__kpi--attended">
                <span className="clinic-ops__kpi-value">{progress.attended}</span>
                <span className="clinic-ops__kpi-label">출석</span>
              </div>
              {progress.noShow > 0 && (
                <div className="clinic-ops__kpi clinic-ops__kpi--noshow">
                  <span className="clinic-ops__kpi-value">{progress.noShow}</span>
                  <span className="clinic-ops__kpi-label">불참</span>
                </div>
              )}
              <div className="clinic-ops__kpi clinic-ops__kpi--completed">
                <span className="clinic-ops__kpi-value">{progress.completed}</span>
                <span className="clinic-ops__kpi-label">완료</span>
              </div>
            </div>
            {progress.total > 0 && (
              <>
                {/* 출석 현황 바 */}
                <div className="clinic-ops__progress-row">
                  <span className="clinic-ops__progress-label">출석</span>
                  <div className="clinic-ops__progress-bar">
                    {progress.attended > 0 && (
                      <div
                        className="clinic-ops__progress-seg clinic-ops__progress-seg--attended"
                        style={widthPercentStyle((progress.attended / progress.total) * 100)}
                      />
                    )}
                    {progress.noShow > 0 && (
                      <div
                        className="clinic-ops__progress-seg clinic-ops__progress-seg--noshow"
                        style={widthPercentStyle((progress.noShow / progress.total) * 100)}
                      />
                    )}
                    {progress.pending > 0 && (
                      <div
                        className="clinic-ops__progress-seg clinic-ops__progress-seg--pending"
                        style={widthPercentStyle((progress.pending / progress.total) * 100)}
                      />
                    )}
                  </div>
                  <span className="clinic-ops__progress-fraction">{progress.attended}/{progress.total}</span>
                </div>
                {/* 완료 현황 바 (자율학습 포함) */}
                <div className="clinic-ops__progress-row">
                  <span className="clinic-ops__progress-label">완료</span>
                  <div className="clinic-ops__progress-bar">
                    {progress.completed > 0 && (
                      <div
                        className="clinic-ops__progress-seg clinic-ops__progress-seg--completed"
                        style={widthPercentStyle((progress.completed / progress.total) * 100)}
                      />
                    )}
                  </div>
                  <span className="clinic-ops__progress-fraction">{progress.completed}/{progress.total}</span>
                </div>
              </>
            )}
            {progress.total > 0 && progress.pending === 0 && progress.approvalPending === 0 && (
              <p className="clinic-ops__all-done">
                <CheckCircle size={14} aria-hidden />
                모든 학생 확인 완료
              </p>
            )}
          </div>
        )}

        {/* ═══ 알림 트리거 상태 — ON/OFF 인디케이터 ═══ */}
        {!isLoading && !isError && !isAggregate && session && (() => {
          const CLINIC_TRIGGERS = [
            { key: "clinic_reservation_created", label: "예약 완료", desc: "클리닉 예약이 완료되면 학부모에게 예약 안내를 발송합니다." },
            { key: "clinic_check_in", label: "참석", desc: "출석 버튼을 누르면 학부모에게 입실 알림을 발송합니다." },
            { key: "clinic_check_out", label: "하원", desc: "하원 버튼을 누르면 선택한 수신자에게 하원 시각을 안내합니다." },
            { key: "clinic_absent", label: "결석", desc: "불참 버튼을 누르면 학부모에게 결석 알림을 발송합니다." },
            { key: "clinic_self_study_completed", label: "클리닉 완료", desc: "완료 버튼을 누르면 학부모에게 자율학습 완료를 안내합니다." },
            { key: "clinic_cancelled", label: "취소", desc: "클리닉 예약 취소 시 학부모에게 취소 안내를 발송합니다." },
            { key: "clinic_reservation_changed", label: "예약 변경", desc: "클리닉 예약이 변경되면 학부모에게 변경 내용을 안내합니다." },
            { key: "clinic_result_notification", label: "결과 안내", desc: "시험/과제 통과로 클리닉 대상이 해소되면 결과를 안내합니다." },
            { key: "clinic_reminder", label: "리마인더", desc: "클리닉 시작 전 학생에게 예약 일시/장소를 리마인드합니다." },
          ] as const;
          const triggerMap = new Map(autoSendConfigs.map((c) => [c.trigger, c]));
          const enabledCount = CLINIC_TRIGGERS.filter((t) => triggerMap.get(t.key)?.enabled).length;
          const previewCfg = previewTrigger ? triggerMap.get(previewTrigger) : null;
          const previewMeta = previewTrigger ? CLINIC_TRIGGERS.find((t) => t.key === previewTrigger) : null;
          return (
            <div className="clinic-ops__trigger-status">
              <span className="clinic-ops__trigger-status-icon">
                {enabledCount > 0 ? <Bell size={16} /> : <BellOff size={16} />}
              </span>
              <span className="clinic-ops__trigger-status-label">알림 설정</span>
              {CLINIC_TRIGGERS.map((t) => {
                const cfg = triggerMap.get(t.key);
                const on = cfg?.enabled ?? false;
                return (
                  <button
                    key={t.key}
                    type="button"
                    className={`clinic-ops__trigger-badge clinic-ops__trigger-badge--clickable ${on ? "clinic-ops__trigger-badge--on" : "clinic-ops__trigger-badge--off"}`}
                    onClick={() => setPreviewTrigger(t.key)}
                    title={t.desc}
                  >
                    {t.label}
                  </button>
                );
              })}
              {/* 트리거 미리보기 팝업 */}
              {previewTrigger && previewMeta && (
                <div
                  className="clinic-ops__trigger-preview-overlay"
                  onClick={(e) => { if (e.target === e.currentTarget) setPreviewTrigger(null); }}
                >
                  <div className="clinic-ops__trigger-preview-popup">
                    <div className="clinic-ops__trigger-preview-header">
                      <div>
                        <div className="clinic-ops__trigger-preview-title">{previewMeta.label}</div>
                        <div className="clinic-ops__trigger-preview-desc">{previewMeta.desc}</div>
                      </div>
                      <button type="button" onClick={() => setPreviewTrigger(null)} className="clinic-ops__trigger-preview-close" aria-label="닫기">
                        <X size={16} />
                      </button>
                    </div>
                    <div className="clinic-ops__trigger-preview-body">
                      {/* ON/OFF + 발송 방식 */}
                      <div className="clinic-ops__trigger-preview-toggle">
                        <span className="clinic-ops__trigger-preview-toggle-label">자동 발송</span>
                        <button
                          type="button"
                          className={`clinic-ops__trigger-toggle-btn ${previewCfg?.enabled ? "clinic-ops__trigger-toggle-btn--on" : "clinic-ops__trigger-toggle-btn--off"}`}
                          disabled={isToggling}
                          onClick={() => {
                            if (previewCfg) {
                              toggleEnabled({ trigger: previewTrigger, enabled: !previewCfg.enabled });
                            }
                          }}
                        >
                          {previewCfg?.enabled ? "ON" : "OFF"}
                        </button>
                        {previewCfg?.message_mode && (
                          <span className="clinic-ops__trigger-preview-mode">
                            {previewCfg.message_mode === "alimtalk" ? "알림톡" : previewCfg.message_mode === "sms" ? "문자 발송 차단(레거시)" : previewCfg.message_mode}
                          </span>
                        )}
                      </div>
                      {/* 알림톡 본문 미리보기 */}
                      {previewCfg?.template_body ? (
                        <div className="clinic-ops__trigger-preview-template">
                          <div className="clinic-ops__trigger-preview-template-label">알림톡 본문</div>
                          <div className="clinic-ops__trigger-preview-template-body">
                            {previewCfg.template_body}
                          </div>
                        </div>
                      ) : (
                        <div className="clinic-ops__trigger-preview-empty">
                          양식이 아직 설정되지 않았습니다.
                        </div>
                      )}
                      <div className="clinic-ops__trigger-preview-hint">
                        메시지 &gt; 자동발송 페이지에서 양식을 수정할 수 있습니다.
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* ═══ B. 상태 필터 칩 — 미확인 우선 강조 ═══ */}
        {!isLoading && !isError && workspaceMode === "day" && rosterParticipants.length > 0 && (
          <div className="clinic-ops__filters">
            {filters.map((f) => (
              <button
                key={f.key}
                type="button"
                className={`clinic-ops__filter-chip ${
                  statusFilter === f.key ? "clinic-ops__filter-chip--active" : ""
                } ${f.key !== "all" ? `clinic-ops__filter-chip--${f.key}` : ""}`}
                onClick={() => setStatusFilter(f.key)}
              >
                {f.key === "requests" && filterCounts.requests > 0 && (
                  <span className="clinic-ops__filter-dot clinic-ops__filter-dot--approval" aria-hidden />
                )}
                {f.key === "pending" && filterCounts.pending > 0 && (
                  <span className="clinic-ops__filter-dot clinic-ops__filter-dot--pending" aria-hidden />
                )}
                {f.key === "no_show" && filterCounts.no_show > 0 && (
                  <span className="clinic-ops__filter-dot clinic-ops__filter-dot--noshow" aria-hidden />
                )}
                {f.label}
                <span className="clinic-ops__filter-count">
                  {filterCounts[f.key]}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ═══ B-2. 출석/결석 알림 발송 바 — 참가자가 있으면 상시 표시 ═══ */}
      {!isAggregate && !isError && rosterParticipants.length > 0 && (() => {
        const pendingAttend = Array.from(pendingStatuses.entries()).filter(([, s]) => s === "attended");
        const pendingNoShow = Array.from(pendingStatuses.entries()).filter(([, s]) => s === "no_show");
        const isSending = Array.from(pendingStatuses.keys()).some((id) => mutatingIds.has(id));
        const hasPendingChanges = pendingStatuses.size > 0;
        return (
          <div className="clinic-ops__confirm-bar">
            {/* 현재 상태 요약 */}
            <div className="clinic-ops__confirm-bar-info">
              {progress.attended > 0 && (
                <span className="clinic-ops__confirm-bar-badge clinic-ops__confirm-bar-badge--attend">
                  출석 {progress.attended}명
                </span>
              )}
              {progress.noShow > 0 && (
                <span className="clinic-ops__confirm-bar-badge clinic-ops__confirm-bar-badge--noshow">
                  결석 {progress.noShow}명
                </span>
              )}
              {progress.pending > 0 && (
                <span className="clinic-ops__confirm-bar-badge">
                  미확인 {progress.pending}명
                </span>
              )}
              {progress.approvalPending > 0 && (
                <span className="clinic-ops__confirm-bar-badge clinic-ops__confirm-bar-badge--approval">
                  승인 대기 {progress.approvalPending}명
                </span>
              )}
              {progress.attended === 0 && progress.noShow === 0 && progress.pending === 0 && progress.approvalPending === 0 && (
                <span className="clinic-ops__confirm-bar-badge">참가자 없음</span>
              )}
            </div>
            {/* 대기 중인 변경이 있을 때만 발송 액션 표시 */}
            {hasPendingChanges && (
              <div className="clinic-ops__confirm-bar-actions">
                <div className="clinic-ops__confirm-bar-info" style={CONFIRM_BAR_DELTA_STYLE}>
                  {pendingAttend.length > 0 && (
                    <span className="clinic-ops__confirm-bar-badge clinic-ops__confirm-bar-badge--attend clinic-ops__confirm-bar-badge--delta">
                      +출석 {pendingAttend.length}명
                    </span>
                  )}
                  {pendingNoShow.length > 0 && (
                    <span className="clinic-ops__confirm-bar-badge clinic-ops__confirm-bar-badge--noshow clinic-ops__confirm-bar-badge--delta">
                      +결석 {pendingNoShow.length}명
                    </span>
                  )}
                  <span className="clinic-ops__confirm-bar-hint">체크를 취소하려면 버튼을 다시 누르세요</span>
                </div>
                <button
                  type="button"
                  className="clinic-ops__confirm-bar-cancel"
                  onClick={() => setPendingStatuses(new Map())}
                >
                  전체 취소
                </button>
                <button
                  type="button"
                  className="clinic-ops__confirm-bar-send"
                  disabled={isSending}
                  onClick={handleBulkConfirmStatuses}
                >
                  <Send size={14} aria-hidden />
                  {isSending ? "요청 중…" : `알림톡 요청 (${pendingStatuses.size}명)`}
                </button>
              </div>
            )}
          </div>
        );
      })()}

      {!isLoading && !isError && rosterParticipants.length > 0 && clinicTargetsLoading && (
        <div className="clinic-workbench__targets-state" role="status">
          미완료 과제·시험을 불러오는 중입니다.
        </div>
      )}
      {!isLoading && !isError && rosterParticipants.length > 0 && clinicTargetsError && (
        <div className="clinic-workbench__targets-state clinic-workbench__targets-state--error" role="alert">
          <span>미완료 과제·시험을 불러오지 못했습니다. 학생에게 할 일이 없는 것으로 표시하지 않았습니다.</span>
          <button type="button" onClick={() => void clinicTargetsQuery.refetch()}>다시 시도</button>
        </div>
      )}

      {/* ═══ C. 학생 처리 큐 ═══ */}
      {isLoading ? (
        <div className="clinic-ops__loading">
          <div className="clinic-ops__skeleton" />
          <div className="clinic-ops__skeleton" />
          <div className="clinic-ops__skeleton" />
        </div>
      ) : isError ? (
        <div className="clinic-console__empty-session clinic-console__empty-session--error" role="alert">
          <p className="clinic-console__empty-session-text">
            {workspaceMode === "onsite"
              ? "현재 등원중인 학생을 불러오지 못했습니다."
              : "클리닉 학생 목록을 불러오지 못했습니다."}
          </p>
          <button
            type="button"
            className="clinic-console__empty-cta"
            onClick={onRetry}
          >
            다시 시도
          </button>
        </div>
      ) : rosterParticipants.length === 0 ? (
        <div className="clinic-console__empty-session">
          <p className="clinic-console__empty-session-text">
            {workspaceMode === "onsite"
              ? "현재 등원중인 학생이 없습니다."
              : "선택한 범위에 등록된 학생이 없습니다."}
          </p>
          {!isAggregate && session && (
            <button
              type="button"
              className="clinic-console__empty-cta"
              onClick={() => setAddStudentModalOpen(true)}
            >
              <UserPlus size={14} aria-hidden />
              <span>학생 추가하기</span>
            </button>
          )}
        </div>
      ) : filteredParticipantGroups.length === 0 ? (
        <div className="clinic-ops__empty-filter">
          <p className="clinic-ops__empty-filter-text">
            {statusFilter === "requests" && "승인 대기 신청이 없습니다."}
            {statusFilter === "pending" && "미확인 학생이 없습니다."}
            {statusFilter === "attended" && "출석 처리된 학생이 없습니다."}
            {statusFilter === "no_show" && "불참 처리된 학생이 없습니다."}
          </p>
        </div>
      ) : (
        <div className="clinic-ops__queue">
          {filteredParticipantGroups.map((group) => {
            const operableParticipants = group.participants.filter((participant) =>
              supportsClinicOperations(participant.status)
            );
            const hasSingleOperableParticipant = operableParticipants.length === 1;
            const p = operableParticipants[0] ?? group.participants[0];
            let actionGuidance: string | null = null;
            if (operableParticipants.length > 1) {
              actionGuidance = "처리할 시간대를 선택하세요.";
            } else if (operableParticipants.length === 0) {
              if (group.participants.every((participant) => participant.status === "cancelled")) {
                actionGuidance = "취소된 일정이라 출결 처리할 수 없습니다.";
              } else if (group.participants.every((participant) => participant.status === "rejected")) {
                actionGuidance = "거절된 일정이라 출결 처리할 수 없습니다.";
              } else {
                actionGuidance = "취소·거절된 일정이라 출결 처리할 수 없습니다.";
              }
            }
            const targets = getTargetsForParticipant(p);
            const unresolvedTargets = targets.filter((target) => !target.resolved_at);
            const visibleTargets = unresolvedTargets.slice(0, 4);
            const hiddenTargetCount = unresolvedTargets.length - visibleTargets.length;
            const plannedIds = new Set(
              group.participants.flatMap((participant) => participant.planned_clinic_link_ids ?? []),
            );
            const plannedCount = unresolvedTargets.filter((target) =>
              isPositiveClinicIdentifier(target.clinic_link_id) && plannedIds.has(target.clinic_link_id)
            ).length;
            // pending 체크 상태 우선, 없으면 서버 상태
            const isApprovalRequest = isApprovalPending(p.status);
            const pendingStatus = isApprovalRequest ? undefined : pendingStatuses.get(p.id);
            const effectiveStatus = pendingStatus ?? p.status;
            const isAttended = effectiveStatus === "attended";
            const isNoShow = effectiveStatus === "no_show";
            const hasPending = pendingStatus != null;
            const isMutating = mutatingIds.has(p.id);

            return (
              <div
                key={group.key}
                className={`clinic-ops__card clinic-ops__student-row clinic-ops__card--clickable ${
                  isAttended
                    ? "clinic-ops__card--attended"
                    : isNoShow
                    ? "clinic-ops__card--noshow"
                    : isApprovalRequest
                    ? "clinic-ops__card--approval"
                    : "clinic-ops__card--pending"
                }`}
                onClick={(event) => {
                  if ((event.target as HTMLElement).closest("button, a, input, select, textarea")) return;
                  openDrawer(
                    p.id,
                    unresolvedTargets[0] ? clinicTargetKey(unresolvedTargets[0]) : null,
                    event.currentTarget,
                    hasSingleOperableParticipant,
                  );
                }}
                role="group"
                aria-label={`${p.student_name} 클리닉 운영 행`}
                data-testid="clinic-participant-row"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && event.target === event.currentTarget) {
                    openDrawer(
                      p.id,
                      unresolvedTargets[0] ? clinicTargetKey(unresolvedTargets[0]) : null,
                      event.currentTarget,
                      hasSingleOperableParticipant,
                    );
                  }
                }}
              >
                {/* Status indicator bar (left) */}
                <div
                  className={`clinic-ops__card-indicator ${
                    isAttended
                      ? "clinic-ops__card-indicator--attended"
                      : isNoShow
                      ? "clinic-ops__card-indicator--noshow"
                      : isApprovalRequest
                      ? "clinic-ops__card-indicator--approval"
                      : "clinic-ops__card-indicator--pending"
                  }`}
                />

                <div className="clinic-ops__card-body">
                  {/* Row 1: Name + status badge + actions */}
                  <div className="clinic-ops__card-main">
                    <div className="clinic-ops__card-identity">
                      <button
                        type="button"
                        className="clinic-ops__card-name"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (p.student) setStudentOverlayId(p.student);
                        }}
                        title="학생 정보 보기"
                      >
                        <StudentNameWithLectureChip
                          name={p.student_name}
                          lectures={p.lecture_title ? [{ lectureName: p.lecture_title, color: p.lecture_color, chipLabel: p.lecture_chip_label }] : undefined}
                          avatarSize={24}
                          profilePhotoUrl={p.profile_photo_url}
                          clinicHighlight={p.name_highlight_clinic_target}
                        />
                      </button>
                      <span
                        className={`clinic-ops__status-badge ${
                          isAttended
                            ? "clinic-ops__status-badge--attended"
                            : isNoShow
                            ? "clinic-ops__status-badge--noshow"
                            : isApprovalRequest
                            ? "clinic-ops__status-badge--approval"
                            : "clinic-ops__status-badge--pending"
                        }`}
                      >
                        {hasPending ? (
                        <span className="clinic-ops__status-badge-pending-indicator">
                          {pendingStatus === "attended" ? "출석 예정" : "결석 예정"}
                        </span>
                      ) : getParticipantStatusLabel(p)}
                      </span>
                      {isAggregate && (
                        <div
                          className="clinic-ops__session-context-rail"
                          role="group"
                          aria-label={`${p.student_name} 일정 문맥`}
                        >
                          {group.participants.map((participant) => {
                            const contextLabel = `${hhmmText(participant.session_start_time, "시간 미정")} · ${participant.session_location || "장소 미정"}`;
                            return (
                              <button
                                key={participant.id}
                                type="button"
                                className="clinic-ops__session-context"
                                aria-label={`${contextLabel} · ${getStatusLabel(participant.status)} 문맥`}
                                onClick={(event) => openDrawer(
                                  participant.id,
                                  unresolvedTargets[0] ? clinicTargetKey(unresolvedTargets[0]) : null,
                                  event.currentTarget,
                                  true,
                                )}
                              >
                                <Clock size={12} aria-hidden />
                                {contextLabel}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {!isApprovalRequest && hasSingleOperableParticipant && (
                      <div
                        className={`clinic-ops__flow-rail ${p.is_late ? "clinic-ops__flow-rail--late" : ""}`}
                        aria-label="클리닉 진행 상태"
                      >
                        {(["미등원", "등원", "하원"] as const).map((label, index) => {
                          const phase = p.checked_out_at ? 2 : p.status === "attended" ? 1 : 0;
                          return (
                            <span
                              key={label}
                              className={index < phase
                                ? "clinic-ops__flow-step clinic-ops__flow-step--done"
                                : index === phase
                                ? "clinic-ops__flow-step clinic-ops__flow-step--current"
                                : "clinic-ops__flow-step"}
                              aria-current={index === phase ? "step" : undefined}
                            >
                              {index === 1 && p.is_late ? "지각 등원" : label}
                            </span>
                          );
                        })}
                      </div>
                    )}

                    {hasSingleOperableParticipant && <div className="clinic-ops__card-actions" onClick={(e) => e.stopPropagation()}>
                      {p.checked_out_at ? (
                        <button
                          type="button"
                          className="clinic-ops__att-btn clinic-ops__att-btn--checkout"
                          disabled
                          aria-label={getParticipantStatusLabel(p)}
                        >
                          {getParticipantStatusLabel(p)}
                        </button>
                      ) : isApprovalRequest ? (
                        <>
                          <button
                            type="button"
                            className="clinic-ops__att-btn clinic-ops__att-btn--approve"
                            onClick={() => handleBookingDecision(p, "booked")}
                            disabled={isMutating}
                            aria-label="예약 승인"
                          >
                            <CheckCircle size={14} aria-hidden />
                            승인
                          </button>
                          <button
                            type="button"
                            className="clinic-ops__att-btn clinic-ops__att-btn--reject"
                            onClick={() => handleBookingDecision(p, "rejected")}
                            disabled={isMutating}
                            aria-label="예약 거절"
                          >
                            <XCircle size={14} aria-hidden />
                            거절
                          </button>
                        </>
                      ) : p.status === "booked" ? (
                        <>
                          <button type="button" className="clinic-ops__att-btn clinic-ops__att-btn--attend" onClick={() => setActionDialog({ participant: p, action: "arrive" })} disabled={isMutating} aria-label="등원">
                            <CheckCircle size={14} aria-hidden /> 등원 처리
                          </button>
                          <button type="button" className="clinic-ops__att-btn clinic-ops__att-btn--remind" onClick={() => setActionDialog({ participant: p, action: "remind" })} disabled={isMutating} aria-label="재촉">
                            <BellRing size={14} aria-hidden /> 재촉
                          </button>
                          <button type="button" className="clinic-ops__att-btn clinic-ops__att-btn--noshow" onClick={() => setActionDialog({ participant: p, action: "absent" })} disabled={isMutating} aria-label="결석">
                            <XCircle size={14} aria-hidden /> 결석
                          </button>
                          <button
                            type="button"
                            className="clinic-ops__att-btn clinic-ops__att-btn--checkout"
                            disabled={isMutating}
                            aria-label="미등원 하원"
                            title="등원 기록을 만들지 않고 하원 시각만 남깁니다."
                            onClick={() => setActionDialog({ participant: p, action: "checkout" })}
                          >
                            미등원 하원
                          </button>
                          <button type="button" className="clinic-ops__att-btn clinic-ops__att-btn--reschedule" onClick={() => openRescheduleDialog(p, "booking")} disabled={isMutating} aria-label="일정 변경">
                            <CalendarClock size={14} aria-hidden /> 일정 변경
                          </button>
                          <button type="button" className="clinic-ops__att-btn clinic-ops__att-btn--cancel" onClick={() => handleCancelBooking(p)} disabled={isMutating} aria-label="명단에서 빼기">
                            <UserMinus size={14} aria-hidden /> 명단에서 빼기
                          </button>
                        </>
                      ) : p.status === "no_show" ? (
                        <>
                          <button type="button" className="clinic-ops__att-btn clinic-ops__att-btn--attend" onClick={() => setActionDialog({ participant: p, action: "arrive" })} disabled={isMutating} aria-label="등원">
                            <CheckCircle size={14} aria-hidden /> 등원 처리
                          </button>
                          <button type="button" className="clinic-ops__att-btn clinic-ops__att-btn--late" onClick={() => setActionDialog({ participant: p, action: "late" })} disabled={isMutating} aria-label="지각 등원">
                            <Clock size={14} aria-hidden /> 지각 등원
                          </button>
                        </>
                      ) : p.status === "attended" ? (
                        <button
                          type="button"
                          className="clinic-ops__att-btn clinic-ops__att-btn--checkout"
                          onClick={() => !p.checked_out_at && setActionDialog({ participant: p, action: "checkout" })}
                          disabled={isMutating || !!p.checked_out_at}
                          aria-label={p.checked_out_at ? "하원 완료" : "하원"}
                        >
                          {p.checked_out_at ? "하원 완료" : "하원 처리"}
                        </button>
                      ) : null}
                    </div>}
                    {actionGuidance && (
                      <p className="clinic-ops__action-guidance" role="note">
                        {actionGuidance}
                      </p>
                    )}
                  </div>

                  {/* Row 2: Reason + cycle + resolution + detail link */}
                  <div className="clinic-ops__card-detail-row">
                    {!clinicTargetsLoading && !clinicTargetsError && (
                      <span className="clinic-ops__plan-count">
                        오늘 {plannedCount} / 미완료 {unresolvedTargets.length}
                      </span>
                    )}
                    <div className="clinic-ops__card-reasons" role="list" aria-label={`${p.student_name} 미완료 항목`}>
                      {clinicTargetsLoading ? (
                        <span className="clinic-ops__reason-tag clinic-ops__reason-tag--self" role="status">
                          과제 확인 중
                        </span>
                      ) : clinicTargetsError ? (
                        <span className="clinic-ops__reason-tag clinic-ops__reason-tag--self" role="alert">
                          과제 조회 실패
                        </span>
                      ) : unresolvedTargets.length > 0 ? (
                        visibleTargets.map((t) => {
                          const targetParticipant = participantForTarget(group.participants, t);
                          const targetIsPlanned = isPositiveClinicIdentifier(t.clinic_link_id) && plannedIds.has(t.clinic_link_id);
                          return (
                          <button
                            type="button"
                            key={clinicTargetKey(t)}
                            className={`clinic-ops__reason-tag clinic-ops__task-chip ${
                              t.clinic_reason === "homework"
                                ? "clinic-ops__reason-tag--homework"
                                : t.clinic_reason === "both"
                                ? "clinic-ops__reason-tag--both"
                                : "clinic-ops__reason-tag--exam"
                            } ${targetIsPlanned ? "clinic-ops__task-chip--planned" : ""}`}
                            aria-pressed={targetIsPlanned}
                            aria-label={`${p.student_name} ${t.clinic_reason === "homework" ? "과제" : "시험"} ${getTargetDisplayTitle(t)} ${getTargetContext(t)} ${formatScoreDetail(t)}`}
                            onClick={(event) => openDrawer(
                              targetParticipant?.id ?? p.id,
                              clinicTargetKey(t),
                              event.currentTarget,
                              targetParticipant != null,
                            )}
                          >
                            {t.clinic_reason === "homework" ? (
                              <BookOpen size={14} aria-hidden />
                            ) : (
                              <FileQuestion size={14} aria-hidden />
                            )}
                            <span className="clinic-ops__task-kind">
                              {t.clinic_reason === "homework" ? "과제" : t.clinic_reason === "both" ? "시험·과제" : "시험"}
                            </span>
                            {getCycleLabel(t.cycle_no) && (
                              <span className="clinic-ops__cycle-badge-inline">
                                {getCycleLabel(t.cycle_no)}
                              </span>
                            )}
                            {t.source_title || t.session_title ? (
                              <>
                                <span className="clinic-ops__reason-title">{t.source_title || t.session_title}</span>
                                <span className="clinic-ops__reason-detail">{formatScoreDetail(t)}</span>
                              </>
                            ) : (
                              formatScoreDetail(t)
                            )}
                          </button>
                          );
                        })
                      ) : (
                        <span className="clinic-ops__reason-tag clinic-ops__reason-tag--self">
                          자율 학습 참여
                        </span>
                      )}
                      {hiddenTargetCount > 0 && (
                        <button
                          type="button"
                          className="clinic-ops__task-overflow"
                          aria-label={`${p.student_name} 미완료 항목 ${hiddenTargetCount}개 더 보기`}
                          onClick={(event) => {
                            const target = unresolvedTargets[visibleTargets.length];
                            const targetParticipant = target ? participantForTarget(group.participants, target) : undefined;
                            openDrawer(
                              targetParticipant?.id ?? p.id,
                              target ? clinicTargetKey(target) : null,
                              event.currentTarget,
                              targetParticipant != null,
                            );
                          }}
                        >
                          <strong>+{hiddenTargetCount}</strong>
                          <span>전체 보기</span>
                          <ArrowRightCircle size={15} aria-hidden />
                        </button>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    className="clinic-ops__mobile-open"
                    aria-label={`${p.student_name} 학생 작업대 열기`}
                    onClick={(event) => {
                      event.stopPropagation();
                      openDrawer(
                        p.id,
                        unresolvedTargets[0] ? clinicTargetKey(unresolvedTargets[0]) : null,
                        event.currentTarget,
                        hasSingleOperableParticipant,
                      );
                    }}
                  >
                    학생 작업대 열기
                    <ArrowRightCircle size={16} aria-hidden />
                  </button>

                  {/* Optional: student/parent request */}
                  {(preferredTimeText(p) || p.student_request_memo) && (
                    <div className="clinic-ops__card-memo">
                      학생 요청: {[preferredTimeText(p) ? `희망 ${preferredTimeText(p)}` : null, p.student_request_memo].filter(Boolean).join(" · ")}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ═══ D. 상세/처리 드로어 ═══ */}
      {drawerParticipant && (
        <>
          <div
            className="clinic-ops__drawer-backdrop"
            onClick={closeDrawer}
            aria-hidden
          />
          <div
            ref={drawerRef}
            className="clinic-ops__drawer clinic-workbench"
            role="dialog"
            aria-modal="true"
            aria-label={`${drawerParticipant.student_name} 클리닉 워크벤치`}
          >
            <div className="clinic-ops__drawer-header">
              <div>
                <span className="clinic-workbench__eyebrow">
                  {drawerContextRequired
                    ? "처리할 시간대를 먼저 선택하세요"
                    : `${hhmmText(drawerParticipant.session_start_time, "시간 미정")} · ${drawerParticipant.session_location || "장소 미정"}`}
                </span>
                <h2 ref={drawerHeadingRef} tabIndex={-1} className="clinic-ops__drawer-title">
                  {drawerParticipant.student_name} 작업대
                </h2>
              </div>
              <button
                type="button"
                className="clinic-ops__drawer-close"
                onClick={closeDrawer}
                aria-label="닫기"
              >
                <X size={18} />
              </button>
            </div>

            {drawerParticipantGroup.length > 1 && (
              <div className="clinic-workbench__session-switcher" role="group" aria-label="학생 클리닉 일정 선택">
                {drawerParticipantGroup.map((participant) => {
                  const contextLabel = `${hhmmText(participant.session_start_time, "시간 미정")} · ${participant.session_location || "장소 미정"}`;
                  return (
                    <button
                      key={participant.id}
                      type="button"
                      className={participant.id === drawerParticipant.id ? "clinic-workbench__session-button clinic-workbench__session-button--active" : "clinic-workbench__session-button"}
                      aria-pressed={participant.id === drawerParticipant.id}
                      onClick={() => {
                        setDrawerParticipantId(participant.id);
                        setDrawerParticipantContextConfirmed(true);
                      }}
                    >
                      <span>{contextLabel}</span>
                      <em>{getParticipantStatusLabel(participant)}</em>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Attendance and checkout are a session rail, separate from learning work. */}
            {drawerContextRequired ? (
              <div className="clinic-workbench__context-required" role="status">
                출결·하원·오늘 할 일은 위 시간대를 선택한 뒤 처리할 수 있습니다.
              </div>
            ) : <div className="clinic-ops__drawer-status-section clinic-workbench__lifecycle">
              <div className="clinic-ops__drawer-status-current">
                <span className="clinic-ops__drawer-status-label">등원 · 하원</span>
                <span className={`clinic-ops__status-badge clinic-ops__status-badge--lg ${
                  drawerParticipant.status === "attended"
                    ? "clinic-ops__status-badge--attended"
                    : drawerParticipant.status === "no_show"
                    ? "clinic-ops__status-badge--noshow"
                    : isApprovalPending(drawerParticipant.status)
                    ? "clinic-ops__status-badge--approval"
                    : "clinic-ops__status-badge--pending"
                }`}>
                  {getParticipantStatusLabel(drawerParticipant)}
                </span>
              </div>
              {!isApprovalPending(drawerParticipant.status) && (
                <div className="clinic-ops__flow-rail" aria-label="클리닉 등하원 상태">
                  {(["미등원", "등원", "하원"] as const).map((label, index) => {
                    const phase = drawerParticipant.checked_out_at ? 2 : drawerParticipant.status === "attended" ? 1 : 0;
                    return (
                      <span key={label} className={index <= phase ? "clinic-ops__flow-step clinic-ops__flow-step--done" : "clinic-ops__flow-step"} aria-current={index === phase ? "step" : undefined}>
                        {index === 1 && drawerParticipant.is_late ? "지각 등원" : label}
                      </span>
                    );
                  })}
                </div>
              )}
              <div className="clinic-ops__drawer-status-actions">
                {drawerParticipant.checked_out_at ? (
                  <button type="button" className="clinic-ops__drawer-status-btn" disabled>
                    {getParticipantStatusLabel(drawerParticipant)}
                  </button>
                ) : isApprovalPending(drawerParticipant.status) ? (
                  <>
                    <button type="button" className="clinic-ops__drawer-status-btn clinic-ops__drawer-status-btn--approve" disabled={mutatingIds.has(drawerParticipant.id)} onClick={() => handleBookingDecision(drawerParticipant, "booked")}>
                      <CheckCircle size={16} aria-hidden /> 예약 승인
                    </button>
                    <button type="button" className="clinic-ops__drawer-status-btn clinic-ops__drawer-status-btn--reject" disabled={mutatingIds.has(drawerParticipant.id)} onClick={() => handleBookingDecision(drawerParticipant, "rejected")}>
                      <XCircle size={16} aria-hidden /> 예약 거절
                    </button>
                  </>
                ) : drawerParticipant.status === "booked" ? (
                  <>
                    <button type="button" className="clinic-ops__drawer-status-btn" disabled={mutatingIds.has(drawerParticipant.id)} onClick={() => setActionDialog({ participant: drawerParticipant, action: "arrive" })}>등원</button>
                    <button type="button" className="clinic-ops__drawer-status-btn" disabled={mutatingIds.has(drawerParticipant.id)} onClick={() => setActionDialog({ participant: drawerParticipant, action: "remind" })}>재촉</button>
                    <button type="button" className="clinic-ops__drawer-status-btn clinic-ops__drawer-status-btn--reject" disabled={mutatingIds.has(drawerParticipant.id)} onClick={() => setActionDialog({ participant: drawerParticipant, action: "absent" })}>결석</button>
                    <button type="button" className="clinic-ops__drawer-status-btn" disabled={mutatingIds.has(drawerParticipant.id)} onClick={() => setActionDialog({ participant: drawerParticipant, action: "checkout" })}>미등원 하원</button>
                    <button type="button" className="clinic-ops__drawer-status-btn clinic-ops__drawer-status-btn--manage" disabled={mutatingIds.has(drawerParticipant.id)} onClick={() => openRescheduleDialog(drawerParticipant, "booking")}>
                      <CalendarClock size={15} aria-hidden /> 일정 변경
                    </button>
                    <button type="button" className="clinic-ops__drawer-status-btn clinic-ops__drawer-status-btn--cancel" disabled={mutatingIds.has(drawerParticipant.id)} onClick={() => handleCancelBooking(drawerParticipant)}>
                      <UserMinus size={15} aria-hidden /> 명단에서 빼기
                    </button>
                  </>
                ) : drawerParticipant.status === "no_show" ? (
                  <>
                    <button type="button" className="clinic-ops__drawer-status-btn" disabled={mutatingIds.has(drawerParticipant.id)} onClick={() => setActionDialog({ participant: drawerParticipant, action: "arrive" })}>등원</button>
                    <button type="button" className="clinic-ops__drawer-status-btn" disabled={mutatingIds.has(drawerParticipant.id)} onClick={() => setActionDialog({ participant: drawerParticipant, action: "late" })}>지각 등원</button>
                  </>
                ) : drawerParticipant.status === "attended" ? (
                  <button type="button" className="clinic-ops__drawer-status-btn" disabled={mutatingIds.has(drawerParticipant.id) || !!drawerParticipant.checked_out_at} onClick={() => setActionDialog({ participant: drawerParticipant, action: "checkout" })}>
                    {drawerParticipant.checked_out_at ? "하원 완료" : "하원 처리"}
                  </button>
                ) : null}
              </div>
            </div>}

            <div className="clinic-ops__drawer-body">
              {/* Student info */}
              <div className="clinic-ops__drawer-section">
                <h4 className="clinic-ops__drawer-section-title">학생 정보</h4>
                <div className="clinic-ops__drawer-field">
                  <span className="clinic-ops__drawer-label">이름</span>
                  <span className="clinic-ops__drawer-value">
                    <button
                      type="button"
                      className="clinic-ops__drawer-student-link"
                      onClick={() => {
                        if (drawerParticipant.student) {
                          setStudentOverlayId(drawerParticipant.student);
                        }
                      }}
                    >
                      <StudentNameWithLectureChip
                        name={drawerParticipant.student_name}
                        lectures={drawerParticipant.lecture_title ? [{ lectureName: drawerParticipant.lecture_title, color: drawerParticipant.lecture_color, chipLabel: drawerParticipant.lecture_chip_label }] : undefined}
                        avatarSize={24}
                        profilePhotoUrl={drawerParticipant.profile_photo_url}
                        clinicHighlight={drawerParticipant.name_highlight_clinic_target}
                      />
                    </button>
                  </span>
                </div>
              </div>

              {!clinicTargetsLoading && !clinicTargetsError && !drawerContextRequired && (
                <div className="clinic-workbench__plan-summary">
                  <div>
                    <span className="clinic-workbench__summary-label">오늘 할 범위</span>
                    <strong>
                      오늘 할 일 {drawerUnresolvedTargets.filter((target) =>
                        isPositiveClinicIdentifier(target.clinic_link_id) &&
                        (drawerParticipant.planned_clinic_link_ids ?? []).includes(target.clinic_link_id)
                      ).length}
                      {" / "}전체 미완료 {drawerUnresolvedTargets.length}
                    </strong>
                  </div>
                  <span className="clinic-workbench__summary-help">선택은 이 클리닉 일정에만 저장됩니다.</span>
                </div>
              )}

              {!clinicTargetsLoading && !clinicTargetsError && drawerUnresolvedTargets.length > 0 && (
                <div className="clinic-workbench__item-switcher" role="tablist" aria-label="미완료 항목 전환">
                  {drawerUnresolvedTargets.map((target, index) => {
                    const targetKey = clinicTargetKey(target);
                    const planned = !drawerContextRequired &&
                      isPositiveClinicIdentifier(target.clinic_link_id) &&
                      (drawerParticipant.planned_clinic_link_ids ?? []).includes(target.clinic_link_id);
                    return (
                      <button
                        key={targetKey}
                        type="button"
                        role="tab"
                        aria-selected={activeDrawerTarget != null && clinicTargetKey(activeDrawerTarget) === targetKey}
                        className={`clinic-workbench__item-tab ${activeDrawerTarget != null && clinicTargetKey(activeDrawerTarget) === targetKey ? "clinic-workbench__item-tab--active" : ""}`}
                        onClick={() => {
                          setDrawerActiveTargetKey(targetKey);
                        }}
                      >
                        <span>{index + 1}</span>
                        <strong>{target.source_title || target.session_title || formatReasonLabel(target.clinic_reason)}</strong>
                        {planned && <em>오늘</em>}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Clinic reasons + remediation status */}
              <div className="clinic-ops__drawer-section">
                <h4 className="clinic-ops__drawer-section-title">선택 항목 처리</h4>
                {clinicTargetsLoading ? (
                  <div className="clinic-ops__target-query-state" role="status" aria-live="polite">
                    클리닉 과제 정보를 불러오는 중입니다.
                  </div>
                ) : clinicTargetsError ? (
                  <div
                    className="clinic-ops__target-query-state clinic-ops__target-query-state--error"
                    role="alert"
                  >
                    <span>클리닉 과제 정보를 불러오지 못했습니다.</span>
                    <button
                      type="button"
                      className="clinic-ops__target-query-retry"
                      onClick={() => clinicTargetsQuery.refetch()}
                      disabled={clinicTargetsQuery.isFetching}
                    >
                      {clinicTargetsQuery.isFetching ? "다시 불러오는 중…" : "다시 시도"}
                    </button>
                  </div>
                ) : drawerUnresolvedTargets.length === 0 ? (
                  <div className="clinic-ops__drawer-self-study">
                    <p className="clinic-ops__drawer-empty">자율 학습 참여</p>
                  </div>
                ) : (
                  <div className="clinic-ops__drawer-reasons">
                    {activeDrawerTarget && [activeDrawerTarget].map((t) => {
                      const clinicLinkId = isPositiveClinicIdentifier(t.clinic_link_id)
                        ? t.clinic_link_id
                        : null;
                      return (
                      <div
                        key={clinicTargetKey(t)}
                        className="clinic-ops__drawer-reason-card clinic-workbench__active-panel"
                      >
                        <div className="clinic-ops__drawer-reason-header">
                          <span
                            className={`clinic-ops__reason-icon ${
                              t.clinic_reason === "homework"
                                ? "clinic-ops__reason-icon--homework"
                                : "clinic-ops__reason-icon--exam"
                            }`}
                          >
                            {t.clinic_reason === "homework" ? (
                              <BookOpen size={14} aria-hidden />
                            ) : (
                              <FileQuestion size={14} aria-hidden />
                            )}
                          </span>
                          <div className="clinic-ops__drawer-reason-info">
                            <strong className="clinic-workbench__target-title">
                              {getTargetDisplayTitle(t)}
                            </strong>
                            {getTargetContext(t) && (
                              <span className="clinic-ops__drawer-reason-session">{getTargetContext(t)}</span>
                            )}
                            <span className="clinic-ops__drawer-reason-type">
                              {getTargetReasonLabel(t)}
                              {getCycleLabel(t.cycle_no) && (
                                <span className="clinic-ops__cycle-badge">
                                  {getCycleLabel(t.cycle_no)}
                                </span>
                              )}
                            </span>
                          </div>
                        </div>

                        {/* Resolution status */}
                        {t.resolved_at ? (
                          <div className="clinic-ops__drawer-resolved">
                            <ShieldCheck size={14} aria-hidden />
                            <span>
                              {getResolutionLabel(t.resolution_type)} 통과
                              {t.resolved_at && (
                                <span className="clinic-ops__resolved-date">
                                  {" "}({dayjs(t.resolved_at).format("M/D HH:mm")})
                                </span>
                              )}
                            </span>
                          </div>
                        ) : (
                          <div className="clinic-ops__drawer-unresolved">
                            <span className="clinic-ops__unresolved-badge">진행중</span>
                          </div>
                        )}

                        {clinicLinkId != null ? (
                          <button
                            ref={planToggleRef}
                            type="button"
                            className={`clinic-workbench__plan-toggle ${activeDrawerTargetIsPlanned ? "clinic-workbench__plan-toggle--selected" : ""}`}
                            aria-pressed={activeDrawerTargetIsPlanned}
                            aria-label={drawerContextRequired
                              ? "시간대 선택 필요"
                              : activeDrawerTargetIsPlanned
                                ? "오늘 할 일에서 빼기"
                                : "오늘 할 일에 추가"}
                            disabled={drawerContextRequired || planningParticipantIds.has(drawerParticipant.id)}
                            onClick={() => handleToggleTodayPlan(drawerParticipant, clinicLinkId)}
                          >
                            <CheckCheck size={16} aria-hidden />
                            {activeDrawerTargetIsPlanned ? "오늘 할 일로 선택됨" : "오늘은 이 항목 처리"}
                          </button>
                        ) : (
                          <span className="clinic-ops__drawer-empty">면제 전에는 오늘 할 일로 지정할 수 없습니다.</span>
                        )}

                        {/* Exam score */}
                        {(t.source_type === "exam" ||
                          (t.source_type == null &&
                            (t.clinic_reason === "exam" ||
                              t.clinic_reason === "both"))) &&
                          t.exam_score != null &&
                          t.cutline_score != null && (
                            <div className="clinic-ops__drawer-score">
                              <div className="clinic-ops__drawer-score-row">
                                <span>시험 점수</span>
                                <span className="clinic-ops__drawer-score-val clinic-ops__drawer-score-val--fail">
                                  {t.exam_score}점
                                </span>
                              </div>
                              <div className="clinic-ops__drawer-score-row">
                                <span>통과 기준</span>
                                <span className="clinic-ops__drawer-score-val">
                                  {t.cutline_score}점
                                </span>
                              </div>
                              <div className="clinic-ops__drawer-score-bar-wrap">
                                <div
                                  className="clinic-ops__drawer-score-fill clinic-ops__drawer-score-fill--fail"
                                  style={scoreWidthStyle(t.exam_score, t.cutline_score)}
                                />
                                <div
                                  className="clinic-ops__drawer-score-cutline"
                                  style={CUTLINE_MARKER_STYLE}
                                  aria-label={`통과 기준: ${t.cutline_score}점`}
                                />
                              </div>
                            </div>
                          )}

                        {/* Homework score */}
                        {(t.clinic_reason === "homework" ||
                          t.clinic_reason === "both") &&
                          t.homework_score != null &&
                          t.homework_cutline != null && (
                            <div className="clinic-ops__drawer-score">
                              <div className="clinic-ops__drawer-score-row">
                                <span>과제 점수</span>
                                <span className="clinic-ops__drawer-score-val clinic-ops__drawer-score-val--fail">
                                  {t.homework_score}점
                                </span>
                              </div>
                              <div className="clinic-ops__drawer-score-row">
                                <span>통과 기준</span>
                                <span className="clinic-ops__drawer-score-val">
                                  {getCutlineLabel(t)}
                                </span>
                              </div>
                              <div className="clinic-ops__drawer-score-bar-wrap">
                                <div
                                  className="clinic-ops__drawer-score-fill clinic-ops__drawer-score-fill--fail"
                                  style={scoreWidthStyle(t.homework_score, t.homework_cutline)}
                                />
                                <div
                                  className="clinic-ops__drawer-score-cutline"
                                  style={CUTLINE_MARKER_STYLE}
                                />
                              </div>
                            </div>
                          )}

                        {!t.resolved_at && clinicLinkId != null && !isMissingExamTarget(t) && (
                          <div className="clinic-workbench__score-entry">
                            <label htmlFor={`clinic-workbench-score-${clinicLinkId}`}>
                              {t.source_type === "homework" ? "과제" : "시험"} 점수
                            </label>
                            <input
                              id={`clinic-workbench-score-${clinicLinkId}`}
                              type="number"
                              inputMode="decimal"
                              min={0}
                              max={t.max_score ?? undefined}
                              placeholder="점수"
                              value={retakeScores.get(clinicLinkId) ?? ""}
                              onChange={(event) => {
                                setRetakeScores((current) => {
                                  const next = new Map(current);
                                  next.set(clinicLinkId, event.target.value);
                                  return next;
                                });
                              }}
                              onKeyDown={(event) => {
                                if (event.key === "Enter") handleRetakeSubmit(clinicLinkId, t.max_score);
                              }}
                              disabled={retakingIds.has(clinicLinkId)}
                            />
                            <button
                              type="button"
                              onClick={() => handleRetakeSubmit(clinicLinkId, t.max_score)}
                              disabled={retakingIds.has(clinicLinkId) || !(retakeScores.get(clinicLinkId) ?? "").trim()}
                            >
                              {retakingIds.has(clinicLinkId) ? "저장 중…" : "점수 저장"}
                            </button>
                          </div>
                        )}

                        {/* ✅ Remediation actions — 진행중 case에만 표시 */}
                        {!t.resolved_at && (clinicLinkId != null || canWaiveMissingExamWithoutLink(t)) && (
                          <div className="clinic-ops__drawer-remediation-actions">
                            {/* 재시험 허용 + 시험 페이지 이동 */}
                            {(t.clinic_reason === "exam" || t.clinic_reason === "both") &&
                              t.exam_id &&
                              !isMissingExamTarget(t) &&
                              clinicLinkId != null && (
                              <button
                                type="button"
                                className="clinic-ops__remediation-btn clinic-ops__remediation-btn--retake"
                                disabled={remediatingLinkIds.has(clinicLinkId)}
                                onClick={async () => {
                                  const linkId = clinicLinkId;
                                  setRemediatingLinkIds((prev) => new Set(prev).add(linkId));
                                  try {
                                    const latestExam = await fetchAdminExam(t.exam_id!);
                                    await updateAdminExam(t.exam_id!, {
                                      allow_retake: true,
                                      max_attempts: 99,
                                    }, latestExam.updated_at);
                                    feedback.success("재시험이 허용되었습니다. 학생이 다시 응시할 수 있습니다.");
                                    qc.invalidateQueries({ queryKey: clinicQueryKeys.targets });
                                  } catch {
                                    feedback.error("재시험 허용에 실패했습니다.");
                                  } finally {
                                    setRemediatingLinkIds((prev) => { const next = new Set(prev); next.delete(linkId); return next; });
                                  }
                                }}
                              >
                                <RotateCcw size={16} aria-hidden />
                                재시험 허용
                              </button>
                            )}

                            {requiresManualHomeworkCompletion(t) ? (
                              canCompleteManualHomework(t) ? (
                                <button
                                  type="button"
                                  className="clinic-ops__remediation-btn clinic-ops__remediation-btn--resolve"
                                  disabled={clinicLinkId == null || remediatingLinkIds.has(clinicLinkId)}
                                  onClick={() => setCompleteTarget(t)}
                                >
                                  <BookOpen size={16} aria-hidden />
                                  제출 확인·완료
                                </button>
                              ) : null
                            ) : !isMissingExamTarget(t) && clinicLinkId != null ? (
                              <button
                                type="button"
                                className="clinic-ops__remediation-btn clinic-ops__remediation-btn--resolve"
                                disabled={remediatingLinkIds.has(clinicLinkId)}
                                onClick={async () => {
                                  const linkId = clinicLinkId;
                                  setRemediatingLinkIds((prev) => new Set(prev).add(linkId));
                                  try {
                                    await resolveClinicLink(linkId, "수동 통과");
                                    feedback.success("통과 처리되었습니다.");
                                    await Promise.all([
                                      qc.invalidateQueries({ queryKey: clinicQueryKeys.targets }),
                                      qc.invalidateQueries({ queryKey: clinicQueryKeys.participants }),
                                    ]);
                                  } catch {
                                    feedback.error("통과 처리에 실패했습니다.");
                                  } finally {
                                    setRemediatingLinkIds((prev) => { const next = new Set(prev); next.delete(linkId); return next; });
                                  }
                                }}
                              >
                                <ShieldCheck size={16} aria-hidden />
                                수동 통과
                              </button>
                            ) : null}
                            {isMissingExamTarget(t) ? (
                              <button
                                type="button"
                                className="clinic-ops__remediation-btn clinic-ops__remediation-btn--waive"
                                disabled={waivingTargetKey === clinicTargetKey(t)}
                                onClick={() => setWaiveTarget(t)}
                              >
                                <Ban size={16} aria-hidden />
                                면제
                              </button>
                            ) : clinicLinkId != null ? (
                              <button
                                type="button"
                                className="clinic-ops__remediation-btn clinic-ops__remediation-btn--waive"
                                disabled={remediatingLinkIds.has(clinicLinkId)}
                                onClick={async () => {
                                  const linkId = clinicLinkId;
                                  setRemediatingLinkIds((prev) => new Set(prev).add(linkId));
                                  try {
                                    await waiveClinicLink(linkId, "면제");
                                    feedback.success("면제 처리되었습니다.");
                                    qc.invalidateQueries({ queryKey: clinicQueryKeys.targets });
                                    qc.invalidateQueries({ queryKey: clinicQueryKeys.participants });
                                  } catch {
                                    feedback.error("면제 처리에 실패했습니다.");
                                  } finally {
                                    setRemediatingLinkIds((prev) => { const next = new Set(prev); next.delete(linkId); return next; });
                                  }
                                }}
                              >
                                <Ban size={16} aria-hidden />
                                면제
                              </button>
                            ) : null}
                            {!isMissingExamTarget(t) && clinicLinkId != null && (
                              <button
                                type="button"
                                className="clinic-ops__remediation-btn clinic-ops__remediation-btn--carryover"
                                disabled={remediatingLinkIds.has(clinicLinkId)}
                                onClick={async () => {
                                  const linkId = clinicLinkId;
                                  setRemediatingLinkIds((prev) => new Set(prev).add(linkId));
                                  try {
                                    await carryOverClinicLink(linkId);
                                    feedback.success("다음 차수로 이월되었습니다.");
                                    qc.invalidateQueries({ queryKey: clinicQueryKeys.targets });
                                    qc.invalidateQueries({ queryKey: clinicQueryKeys.participants });
                                  } catch {
                                    feedback.error("이월 처리에 실패했습니다.");
                                  } finally {
                                    setRemediatingLinkIds((prev) => { const next = new Set(prev); next.delete(linkId); return next; });
                                  }
                                }}
                              >
                                <ArrowRightCircle size={16} aria-hidden />
                                다음 차수 이월
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );})}
                  </div>
                )}
              </div>

              <div className="clinic-ops__drawer-section clinic-workbench__completion">
                <h4 className="clinic-ops__drawer-section-title">세션 처리 완료</h4>
                <p>학습 항목 해결이나 하원과 별개로, 오늘 상담·확인을 마쳤을 때만 처리합니다.</p>
                {drawerParticipant.completed_at ? (
                  <button
                    type="button"
                    className="clinic-ops__remediation-btn clinic-ops__remediation-btn--waive"
                    onClick={() => handleUncomplete(drawerParticipant)}
                    disabled={completingIds.has(drawerParticipant.id)}
                  >
                    <Undo2 size={16} aria-hidden />
                    완료 취소 · {dayjs(drawerParticipant.completed_at).format("HH:mm")}
                  </button>
                ) : drawerParticipant.status === "attended" ? (
                  <button
                    type="button"
                    className="clinic-ops__remediation-btn clinic-ops__remediation-btn--resolve"
                    onClick={() => handleComplete(drawerParticipant)}
                    disabled={completingIds.has(drawerParticipant.id)}
                  >
                    <CircleCheckBig size={16} aria-hidden />
                    {completingIds.has(drawerParticipant.id) ? "처리 중…" : "세션 처리 완료"}
                  </button>
                ) : (
                  <span className="clinic-ops__drawer-empty">등원 후 처리 완료할 수 있습니다.</span>
                )}
              </div>

              {/* Requests and internal handoff */}
              <div className="clinic-ops__drawer-section">
                <h4 className="clinic-ops__drawer-section-title">학생·학부모 요청</h4>
                <p className="clinic-ops__drawer-memo-text">
                  {[preferredTimeText(drawerParticipant) ? `희망 ${preferredTimeText(drawerParticipant)}` : null, drawerParticipant.student_request_memo]
                    .filter(Boolean)
                    .join(" · ") || "요청 없음"}
                </p>
              </div>
              <div className="clinic-ops__drawer-section">
                <h4 className="clinic-ops__drawer-section-title">교직원 인수인계</h4>
                <label className="clinic-ops__staff-memo">
                  <span className="sr-only">교직원 인수인계 메모</span>
                  <textarea
                    value={staffMemoDraft}
                    onChange={(event) => setStaffMemoDraft(event.target.value)}
                    rows={3}
                    maxLength={2000}
                    placeholder="예: 오늘 영상 시청 여부를 꼭 확인해주세요."
                  />
                </label>
                <button
                  type="button"
                  className="clinic-ops__staff-memo-save"
                  onClick={() => void saveStaffMemo()}
                  disabled={staffMemoSaving || staffMemoDraft.trim() === (drawerParticipant.staff_memo ?? "").trim()}
                >
                  {staffMemoSaving ? "저장 중…" : "인수인계 메모 저장"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ═══ 알림톡 요청 완료 팝업 ═══ */}
      {sendResult && createPortal(
        <div
          className="clinic-send-result__overlay"
          onClick={(e) => { if (e.target === e.currentTarget) { setSendResult(null); setSendResultPreviewOpen(false); } }}
        >
          <div className="clinic-send-result__popup">
            {/* Header */}
            <div className="clinic-send-result__header">
              <div className="clinic-send-result__header-icon">
                <CheckCircle size={22} />
              </div>
              <div className="clinic-send-result__header-text">
                <h3 className="clinic-send-result__title">
                  {sendResult.type === "attended" ? "출석 알림" : "결석 알림"} 알림톡 요청 완료
                </h3>
                <span className="clinic-send-result__mode-badge">알림톡</span>
              </div>
              <button
                type="button"
                className="clinic-send-result__close"
                onClick={() => { setSendResult(null); setSendResultPreviewOpen(false); }}
                aria-label="닫기"
              >
                <X size={16} />
              </button>
            </div>

            {/* 수신자 목록 */}
            <div className="clinic-send-result__body">
              <div className="clinic-send-result__section-label">수신 학생</div>
              <div className="clinic-send-result__students">
                {sendResult.students.map((s) => (
                  <span key={s.id} className="clinic-send-result__student-chip">
                    {s.name}
                  </span>
                ))}
              </div>

              {/* 미리보기 토글 */}
              {sendResult.messageBody && (
                <>
                  <button
                    type="button"
                    className="clinic-send-result__preview-btn"
                    onClick={() => setSendResultPreviewOpen((v) => !v)}
                  >
                    <MessageCircle size={14} />
                    {sendResultPreviewOpen ? "미리보기 닫기" : "미리보기"}
                  </button>

                  {sendResultPreviewOpen && (
                    <div className="clinic-send-result__kakao-wrap">
                      <div className="clinic-send-result__kakao-header">
                        <span className="clinic-send-result__kakao-logo">K</span>
                        <span className="clinic-send-result__kakao-title">알림톡</span>
                      </div>
                      <div className="clinic-send-result__kakao-bubble">
                        <div className="clinic-send-result__kakao-body">
                          {(() => {
                            let body = sendResult.messageBody;
                            const studentName = sendResult.students[0]?.name ?? "";
                            body = body.replace(/#{학생이름3}/g, studentName.length > 3 ? studentName.slice(0, 3) : studentName);
                            body = body.replace(/#{학생이름2}/g, studentName.length >= 2 ? studentName.slice(-2) : studentName);
                            body = body.replace(/#{학생이름}/g, studentName);
                            body = body.replace(/#{클리닉명}/g, session?.title || "");
                            body = body.replace(/#{클리닉날짜}/g, session?.date || selectedDate || "");
                            body = body.replace(/#{클리닉시간}/g, hhmmText(session?.start_time, "—"));
                            body = body.replace(/#{클리닉장소}/g, session?.location || "");
                            body = body.replace(/#{장소}/g, session?.location || "");
                            // 남은 미치환 변수 제거
                            body = body.replace(/#\{[^}]+\}/g, "");
                            return body;
                          })()}
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Footer */}
            <div className="clinic-send-result__footer">
              <button
                type="button"
                className="clinic-send-result__confirm-btn"
                onClick={() => { setSendResult(null); setSendResultPreviewOpen(false); }}
              >
                확인
              </button>
              <span className="clinic-send-result__hint">Enter 또는 ESC로 닫기</span>
            </div>
          </div>
        </div>,
        document.body
      )}

      {actionDialog && (
        <ClinicParticipantActionDialog
          action={actionDialog.action}
          participantName={actionDialog.participant.student_name}
          selectedDate={selectedDate}
          withoutArrival={!actionDialog.participant.checked_in_at}
          busy={mutatingIds.has(actionDialog.participant.id)}
          onClose={() => setActionDialog(null)}
          onConfirm={handleClinicAction}
        />
      )}

      {rescheduleParticipant && createPortal(
        <div className="clinic-reschedule__backdrop" onMouseDown={(event) => event.target === event.currentTarget && closeRescheduleDialog()}>
          <section className="clinic-reschedule__dialog" role="dialog" aria-modal="true" aria-label={rescheduleMode === "booking" ? "클리닉 일정 변경" : "보충 일정 정하기"}>
            <header>
              <div>
                <span>{rescheduleMode === "booking" ? "예약 관리" : "결석 후 다음 단계"}</span>
                <h2>{rescheduleMode === "booking" ? "일정 변경" : "보충 일정 정하기"}</h2>
                <p>
                  <strong>{rescheduleParticipant.student_name}</strong>의 기존 {rescheduleMode === "booking" ? "예약" : "결석"} 기록은 보존됩니다.
                </p>
              </div>
              <button type="button" onClick={closeRescheduleDialog} aria-label="닫기"><X size={18} aria-hidden /></button>
            </header>
            <label className="clinic-reschedule__select">
              이동할 일정
              <select
                value={replacementSessionId}
                onChange={(event) => setReplacementSessionId(event.target.value)}
                disabled={replacementSessionsLoading || replacementSessionsError}
              >
                <option value="">
                  {replacementSessionsLoading
                    ? "일정을 불러오는 중입니다"
                    : replacementSessionsError
                      ? "일정을 불러오지 못했습니다"
                      : replacementSessions.length === 0
                        ? "이동 가능한 일정이 없습니다"
                        : "일정을 선택하세요"}
                </option>
                {replacementSessions.map((row) => (
                  <option key={row.id} value={row.id}>
                    {dayjs(row.date).format("M/D")} {hhmmText(row.start_time, "—")} · {row.title || row.location}
                  </option>
                ))}
              </select>
            </label>
            <div className="clinic-reschedule__choices">
              <a href={`/workspace/clinic/schedule?create=1&date=${selectedDate}`}>새 클리닉 만들기</a>
              <button type="button" onClick={handleReschedule} disabled={!replacementSessionId || mutatingIds.has(rescheduleParticipant.id)}>
                {rescheduleMode === "booking" ? "일정 변경" : "일정 이동"}
              </button>
            </div>
          </section>
        </div>,
        document.body,
      )}

      <NotificationPreviewModal
        open={changeNoticeOpen}
        onClose={() => setChangeNoticeOpen(false)}
        mode="manual"
        trigger="clinic_reservation_changed"
        contextSource={changeNoticeContextSource}
        label="클리닉 변경 알림"
        sendTo="parent"
        onConfirmed={onChangeNoticeConsumed}
      />

      {/* Student detail overlay — portal to body for proper z-index layering */}
      {studentOverlayId != null &&
        createPortal(
          <Suspense fallback={null}>
            <StudentsDetailOverlay
              studentId={studentOverlayId}
              onClose={() => setStudentOverlayId(null)}
            />
          </Suspense>,
          document.body
        )}

      {/* 학생 추가 모달 */}
      <ClinicTargetSelectModal
        open={addStudentModalOpen}
        onClose={() => setAddStudentModalOpen(false)}
        initialMode="targets"
        onConfirm={async (result: ClinicTargetSelectResult) => {
          setAddStudentModalOpen(false);
          const allIds =
            result.kind === "enrollment"
              ? [...result.enrollmentIds]
              : [...result.studentIds];
          if (!session || allIds.length === 0) return;

          const existingStudentIds = new Set(
            rosterParticipants.map((p) => p.student)
          );
          const existingEnrollmentIds = new Set(
            rosterParticipants
              .filter((p) => p.enrollment_id)
              .map((p) => p.enrollment_id!)
          );
          const ids = allIds.filter((selectedId) =>
            result.kind === "student"
              ? !existingStudentIds.has(selectedId)
              : !existingEnrollmentIds.has(selectedId)
          );
          const skipped = allIds.length - ids.length;

          if (ids.length === 0) {
            feedback.info(
              `선택한 ${allIds.length}명은 이미 등록되어 있습니다.`
            );
            return;
          }

          const results = await Promise.allSettled(
            ids.map((selectedId) => {
              const reason =
                result.kind === "enrollment"
                  ? clinicTargets?.find(
                      (t) => t.enrollment_id === selectedId
                    )?.clinic_reason
                  : undefined;
              return createClinicParticipant(
                buildParticipantPayload(session.id, selectedId, result, reason)
              );
            })
          );
          const failed = results.filter(
            (r) => r.status === "rejected"
          ).length;
          qc.invalidateQueries({ queryKey: clinicQueryKeys.participants });
          qc.invalidateQueries({ queryKey: clinicQueryKeys.sessionsTree });
          const added = ids.length - failed;
          if (skipped > 0 && failed > 0) {
            feedback.warning(
              `${added}명 추가 (${skipped}명 이미 등록, ${failed}명 실패)`
            );
          } else if (skipped > 0) {
            feedback.success(
              `${added}명 추가 (${skipped}명은 이미 등록되어 건너뜀)`
            );
          } else if (failed > 0) {
            feedback.warning(`${added}명 추가, ${failed}명 실패`);
          } else {
            feedback.success(`${ids.length}명이 추가되었습니다.`);
          }
        }}
      />
      <ClinicManualHomeworkCompleteDialog
        target={completeTarget}
        pending={
          completeTarget?.clinic_link_id != null &&
          remediatingLinkIds.has(completeTarget.clinic_link_id)
        }
        onClose={() => setCompleteTarget(null)}
        onConfirm={(memo) => {
          if (completeTarget) void handleManualHomeworkComplete(completeTarget, memo);
        }}
      />
      <ClinicManualHomeworkCompleteDialog
        target={waiveTarget}
        mode="exam-waive"
        pending={waiveTarget != null && waivingTargetKey === clinicTargetKey(waiveTarget)}
        onClose={() => setWaiveTarget(null)}
        onConfirm={(memo) => {
          if (waiveTarget) void handleMissingExamWaive(waiveTarget, memo);
        }}
      />
    </>
  );
}
