/**
 * PATH: src/features/clinic/pages/OperationsConsolePage/ClinicConsoleWorkspace.tsx
 * 선택한 클리닉 수업의 대상자 관리 — 운영 헤더 + 상태 필터 + 처리 큐 + 상세 드로어
 * 재설계: 단순 카드 나열 → 운영/처리 워크스페이스
 */

import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
} from "lucide-react";
import type { ClinicSessionTreeNode } from "../../api/clinicSessions.api";
import type { ClinicParticipant } from "../../api/clinicParticipants.api";
import {
  patchClinicParticipantStatus,
  createClinicParticipant,
  completeClinicParticipant,
  uncompleteClinicParticipant,
} from "../../api/clinicParticipants.api";
import type { ClinicTarget } from "../../api/clinicTargets";
import { useClinicTargets } from "../../hooks/useClinicTargets";
import {
  resolveClinicLink,
  waiveClinicLink,
  carryOverClinicLink,
  submitClinicRetake,
} from "../../api/clinicLinks.api";
import { updateAdminExam } from "@/features/exams/api/adminExam";
import { feedback } from "@/shared/ui/feedback/feedback";
import { useAutoSendConfig } from "@/features/messages/hooks/useAutoSendConfig";
import { useSendMessageModal } from "@/features/messages/context/SendMessageModalContext";
import { Bell, BellOff, Send } from "lucide-react";
import AutoSendPreviewPopup from "@/features/messages/components/AutoSendPreviewPopup";
import ClinicTargetSelectModal from "../../components/ClinicTargetSelectModal";
import type { ClinicTargetSelectResult } from "../../components/ClinicTargetSelectModal";
import { buildParticipantPayload } from "../../utils/buildParticipantPayload";
import StudentNameWithLectureChip from "@/shared/ui/chips/StudentNameWithLectureChip";

dayjs.locale("ko");

const StudentsDetailOverlay = lazy(
  () => import("@/features/students/overlays/StudentsDetailOverlay")
);

/* ── helpers ── */

function formatTime(s: string | undefined) {
  if (!s) return "—";
  return s.slice(0, 5) || "—";
}

function formatReasonLabel(reason: string | undefined): string {
  if (reason === "exam") return "시험 미통과";
  if (reason === "homework") return "과제 미통과";
  if (reason === "both") return "시험·과제 미통과";
  return "클리닉 대상";
}

function formatScoreDetail(target: ClinicTarget): string {
  const parts: string[] = [];

  if (
    target.clinic_reason === "exam" ||
    target.clinic_reason === "both" ||
    target.reason === "score"
  ) {
    if (target.exam_score != null && target.cutline_score != null) {
      parts.push(`시험 ${target.exam_score}/${target.cutline_score}점`);
    } else {
      parts.push("시험 미통과");
    }
  }

  if (target.clinic_reason === "homework" || target.clinic_reason === "both") {
    if (target.homework_score != null && target.homework_cutline != null) {
      parts.push(`과제 ${target.homework_score}/${target.homework_cutline}점`);
    } else {
      parts.push("과제 미통과");
    }
  }

  if (parts.length === 0) {
    parts.push(formatReasonLabel(target.clinic_reason));
  }

  return parts.join(" · ");
}

function getStatusLabel(status: string): string {
  if (status === "attended") return "출석";
  if (status === "no_show") return "불참";
  return "미확인";
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

type StatusFilter = "all" | "pending" | "attended" | "no_show";

type Props = {
  selectedDate: string;
  session: ClinicSessionTreeNode | null;
  participants: ClinicParticipant[];
  isLoading: boolean;
  onEditSession?: (sessionId: number) => void;
  onDeleteSession?: (sessionId: number, label: string) => void;
};

export default function ClinicConsoleWorkspace({
  selectedDate,
  session,
  participants,
  isLoading,
  onEditSession,
  onDeleteSession,
}: Props) {
  const qc = useQueryClient();
  // Drawer stores participant ID only — derive live data from participants prop
  const [drawerParticipantId, setDrawerParticipantId] = useState<number | null>(null);
  const [studentOverlayId, setStudentOverlayId] = useState<number | null>(null);
  const [addStudentModalOpen, setAddStudentModalOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  // Per-participant pending tracking for rapid processing
  const [mutatingIds, setMutatingIds] = useState<Set<number>>(new Set());

  // Inline retake score input: clinic_link_id → score string
  const [retakeScores, setRetakeScores] = useState<Map<number, string>>(new Map());
  const [retakingIds, setRetakingIds] = useState<Set<number>>(new Set());
  const [completingIds, setCompletingIds] = useState<Set<number>>(new Set());
  // Prevent double-click on remediation actions (resolve/waive/carryover/retake)
  const [remediatingLinkIds, setRemediatingLinkIds] = useState<Set<number>>(new Set());

  const { configs: autoSendConfigs, toggleEnabled, isToggling } = useAutoSendConfig();
  const { data: clinicTargets } = useClinicTargets();
  const { openSendMessageModal } = useSendMessageModal();

  // 알림 설정 미리보기 팝업
  const [previewTrigger, setPreviewTrigger] = useState<string | null>(null);

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

  const invalidateAll = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["clinic-participants"] });
    qc.invalidateQueries({ queryKey: ["clinic-sessions-tree"] });
    qc.invalidateQueries({ queryKey: ["admin", "notification-counts"] });
  }, [qc]);

  const bulkAttendMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      const results = await Promise.allSettled(
        ids.map((participantId) =>
          patchClinicParticipantStatus(participantId, { status: "attended" })
        )
      );
      const failed = results.filter((r) => r.status === "rejected");
      if (failed.length > 0) {
        throw new Error(
          `${ids.length - failed.length}명 처리 완료, ${failed.length}명 실패`
        );
      }
    },
    onSuccess: invalidateAll,
    onError: (err: Error) => {
      invalidateAll();
      feedback.error(err.message || "일부 학생의 출석 처리에 실패했습니다.");
    },
  });

  const timeLabel = session ? formatTime(session.start_time) : "—";
  const dateLabel = dayjs(selectedDate).format("M월 D일 (dd)");

  /* ── progress ── */
  const progress = useMemo(() => {
    const attended = participants.filter((p) => p.status === "attended").length;
    const noShow = participants.filter((p) => p.status === "no_show").length;
    const completed = participants.filter((p) => !!p.completed_at).length;
    const pending = participants.filter(
      (p) =>
        p.status !== "attended" &&
        p.status !== "no_show" &&
        p.status !== "cancelled" &&
        p.status !== "rejected"
    ).length;
    const total = attended + noShow + pending;
    return { attended, noShow, pending, completed, total };
  }, [participants]);

  const pendingIds = useMemo(
    () =>
      participants
        .filter(
          (p) =>
            p.status !== "attended" &&
            p.status !== "no_show" &&
            p.status !== "cancelled" &&
            p.status !== "rejected"
        )
        .map((p) => p.id),
    [participants]
  );

  /* ── filtered list — 미확인 우선, 불참 다음, 출석 마지막 ── */
  const filteredParticipants = useMemo(() => {
    let list: ClinicParticipant[];
    if (statusFilter === "all") list = [...participants];
    else if (statusFilter === "attended")
      list = participants.filter((p) => p.status === "attended");
    else if (statusFilter === "no_show")
      list = participants.filter((p) => p.status === "no_show");
    else
      list = participants.filter(
        (p) =>
          p.status !== "attended" &&
          p.status !== "no_show" &&
          p.status !== "cancelled" &&
          p.status !== "rejected"
      );
    // Sort: pending(0) → no_show(1) → booked(2) → attended(3)
    const ORDER: Record<string, number> = { pending: 0, booked: 0, no_show: 1, attended: 2 };
    list.sort((a, b) => (ORDER[a.status] ?? 0) - (ORDER[b.status] ?? 0));
    return list;
  }, [participants, statusFilter]);

  /* ── Drawer: derive from live participants ── */
  const drawerParticipant = useMemo(
    () => (drawerParticipantId != null ? participants.find((p) => p.id === drawerParticipantId) ?? null : null),
    [drawerParticipantId, participants]
  );

  // Close drawer if participant was removed from list
  useEffect(() => {
    if (drawerParticipantId != null && !drawerParticipant) {
      setDrawerParticipantId(null);
    }
  }, [drawerParticipantId, drawerParticipant]);

  // Escape key to close drawer
  useEffect(() => {
    if (drawerParticipantId == null) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setDrawerParticipantId(null);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [drawerParticipantId]);

  if (!session) return null;

  /* ── per-participant status toggle ── */
  function handleToggleStatus(
    p: ClinicParticipant,
    target: "attended" | "no_show"
  ) {
    if (mutatingIds.has(p.id)) return;
    const newStatus = p.status === target ? "booked" as const : target;

    setMutatingIds((prev) => new Set(prev).add(p.id));
    patchClinicParticipantStatus(p.id, { status: newStatus })
      .then(() => invalidateAll())
      .catch(() => {
        invalidateAll();
        feedback.error("처리에 실패했습니다. 다시 시도해 주세요.");
      })
      .finally(() => {
        setMutatingIds((prev) => {
          const next = new Set(prev);
          next.delete(p.id);
          return next;
        });
      });
  }

  /* ── 클리닉 완료/취소 ── */
  function handleComplete(p: ClinicParticipant) {
    if (completingIds.has(p.id)) return;
    setCompletingIds((prev) => new Set(prev).add(p.id));
    completeClinicParticipant(p.id)
      .then(() => {
        invalidateAll();
        feedback.success(`${p.student_name} 클리닉 완료`);
      })
      .catch(() => feedback.error("완료 처리에 실패했습니다."))
      .finally(() => {
        setCompletingIds((prev) => {
          const next = new Set(prev);
          next.delete(p.id);
          return next;
        });
      });
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
        qc.invalidateQueries({ queryKey: ["clinic-targets"] });
        qc.invalidateQueries({ queryKey: ["clinic-participants"] });
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
    let targets = p.enrollment_id
      ? targetsByEnrollment.get(p.enrollment_id) ?? []
      : [];
    if (targets.length === 0 && p.clinic_reason) {
      targets = [
        {
          enrollment_id: p.enrollment_id ?? 0,
          student_name: p.student_name,
          session_title: "",
          clinic_reason: p.clinic_reason,
          created_at: "",
        },
      ];
    }
    return targets;
  }

  const drawerTargets = drawerParticipant ? getTargetsForParticipant(drawerParticipant) : [];

  const filterCounts = {
    all: participants.length,
    pending: progress.pending,
    attended: progress.attended,
    no_show: progress.noShow,
  };

  const filters: { key: StatusFilter; label: string }[] = [
    { key: "all", label: "전체" },
    { key: "pending", label: "미확인" },
    { key: "attended", label: "출석" },
    { key: "no_show", label: "불참" },
  ];

  return (
    <>
      {/* ═══ A. 운영 헤더 — 처리 워크스페이스 밴드 ═══ */}
      <div className="clinic-ops__header">
        {/* 핵심 식별 + 액션 */}
        <div className="clinic-ops__header-top">
          <div className="clinic-ops__header-info">
            <div className="clinic-ops__header-title-row">
              <h3 className="clinic-ops__header-date">{dateLabel}</h3>
              {session.title && (
                <span className="clinic-ops__header-session-name">{session.title}</span>
              )}
            </div>
            <div className="clinic-ops__header-meta">
              <span className="clinic-ops__header-meta-item">
                <Clock size={13} aria-hidden />
                {timeLabel}
              </span>
              {session.location && (
                <span className="clinic-ops__header-meta-item">
                  <MapPin size={13} aria-hidden />
                  {session.location}
                </span>
              )}
              <span className="clinic-ops__header-meta-item clinic-ops__header-meta-item--count">
                <Users size={13} aria-hidden />
                예약 <strong>{participants.length}</strong>명
              </span>
            </div>
          </div>

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
                  const label = `${formatTime(session.start_time)} ${session.location || ""}`.trim();
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
            {participants.length > 0 && (
              <button
                type="button"
                className="clinic-ops__action-btn clinic-ops__action-btn--secondary"
                onClick={() => {
                  const studentIds = [...new Set(participants.map((p) => p.student))].filter(Boolean);
                  if (studentIds.length === 0) return;
                  openSendMessageModal({
                    studentIds,
                    recipientLabel: `클리닉 참가 ${studentIds.length}명`,
                    blockCategory: "clinic",
                    alimtalkExtraVars: {
                      클리닉장소: session.location || "",
                      클리닉날짜: session.date || selectedDate,
                      클리닉시간: formatTime(session.start_time),
                    },
                  });
                }}
              >
                <MessageCircle size={14} aria-hidden />
                메시지 발송
              </button>
            )}
            {!isLoading && pendingIds.length > 0 && (
              <button
                type="button"
                className="clinic-ops__action-btn clinic-ops__action-btn--primary"
                disabled={bulkAttendMutation.isPending}
                onClick={() => bulkAttendMutation.mutate(pendingIds)}
              >
                <CheckCheck size={14} aria-hidden />
                {bulkAttendMutation.isPending
                  ? `처리 중… (${pendingIds.length}명)`
                  : `전체 출석 (${pendingIds.length}명)`}
              </button>
            )}
          </div>
        </div>

        {/* KPI 밴드 — 운영 현황 한 줄 요약 */}
        {!isLoading && participants.length > 0 && (
          <div className="clinic-ops__kpi-row">
            <div className="clinic-ops__kpi-counters">
              {progress.pending > 0 && (
                <div className="clinic-ops__kpi clinic-ops__kpi--pending clinic-ops__kpi--highlight">
                  <span className="clinic-ops__kpi-value">{progress.pending}</span>
                  <span className="clinic-ops__kpi-label">미확인</span>
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
                        style={{ width: `${(progress.attended / progress.total) * 100}%` }}
                      />
                    )}
                    {progress.noShow > 0 && (
                      <div
                        className="clinic-ops__progress-seg clinic-ops__progress-seg--noshow"
                        style={{ width: `${(progress.noShow / progress.total) * 100}%` }}
                      />
                    )}
                    {progress.pending > 0 && (
                      <div
                        className="clinic-ops__progress-seg clinic-ops__progress-seg--pending"
                        style={{ width: `${(progress.pending / progress.total) * 100}%` }}
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
                        style={{ width: `${(progress.completed / progress.total) * 100}%` }}
                      />
                    )}
                  </div>
                  <span className="clinic-ops__progress-fraction">{progress.completed}/{progress.total}</span>
                </div>
              </>
            )}
            {progress.total > 0 && progress.pending === 0 && (
              <p className="clinic-ops__all-done">
                <CheckCircle size={14} aria-hidden />
                모든 학생 확인 완료
              </p>
            )}
          </div>
        )}

        {/* ═══ 알림 트리거 상태 — ON/OFF 인디케이터 ═══ */}
        {!isLoading && session && (() => {
          const CLINIC_TRIGGERS = [
            { key: "clinic_reservation_created", label: "예약 완료", desc: "클리닉 예약이 완료되면 학부모에게 예약 안내를 발송합니다." },
            { key: "clinic_check_in", label: "참석", desc: "출석 버튼을 누르면 학부모에게 입실 알림을 발송합니다." },
            { key: "clinic_absent", label: "결석", desc: "불참 버튼을 누르면 학부모에게 결석 알림을 발송합니다." },
            { key: "clinic_self_study_completed", label: "클리닉 완료", desc: "완료 버튼을 누르면 학부모에게 하원 안내를 발송합니다." },
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
                {enabledCount > 0 ? <Bell size={13} /> : <BellOff size={13} />}
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
                            {previewCfg.message_mode === "alimtalk" ? "알림톡" : previewCfg.message_mode === "sms" ? "SMS" : previewCfg.message_mode}
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
        {!isLoading && participants.length > 0 && (
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

      {/* ═══ C. 학생 처리 큐 ═══ */}
      {isLoading ? (
        <div className="clinic-ops__loading">
          <div className="clinic-ops__skeleton" />
          <div className="clinic-ops__skeleton" />
          <div className="clinic-ops__skeleton" />
        </div>
      ) : participants.length === 0 ? (
        <div className="clinic-console__empty-session">
          <p className="clinic-console__empty-session-text">
            아직 예약된 학생이 없습니다.
          </p>
          <button
            type="button"
            className="clinic-console__empty-cta"
            onClick={() => setAddStudentModalOpen(true)}
          >
            <UserPlus size={14} aria-hidden style={{ marginRight: 4 }} />
            학생 추가하기
          </button>
        </div>
      ) : filteredParticipants.length === 0 ? (
        <div className="clinic-ops__empty-filter">
          <p className="clinic-ops__empty-filter-text">
            {statusFilter === "pending" && "미확인 학생이 없습니다."}
            {statusFilter === "attended" && "출석 처리된 학생이 없습니다."}
            {statusFilter === "no_show" && "불참 처리된 학생이 없습니다."}
          </p>
        </div>
      ) : (
        <div className="clinic-ops__queue">
          {filteredParticipants.map((p) => {
            const targets = getTargetsForParticipant(p);
            const isAttended = p.status === "attended";
            const isNoShow = p.status === "no_show";
            const isMutating = mutatingIds.has(p.id);

            return (
              <div
                key={p.id}
                className={`clinic-ops__card clinic-ops__card--clickable ${
                  isAttended
                    ? "clinic-ops__card--attended"
                    : isNoShow
                    ? "clinic-ops__card--noshow"
                    : "clinic-ops__card--pending"
                }`}
                onClick={() => setDrawerParticipantId(p.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === "Enter") setDrawerParticipantId(p.id); }}
              >
                {/* Status indicator bar (left) */}
                <div
                  className={`clinic-ops__card-indicator ${
                    isAttended
                      ? "clinic-ops__card-indicator--attended"
                      : isNoShow
                      ? "clinic-ops__card-indicator--noshow"
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
                            : "clinic-ops__status-badge--pending"
                        }`}
                      >
                        {getStatusLabel(p.status)}
                      </span>
                    </div>

                    <div className="clinic-ops__card-actions" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        className={`clinic-ops__att-btn clinic-ops__att-btn--attend ${
                          isAttended ? "clinic-ops__att-btn--active" : ""
                        }`}
                        onClick={() => handleToggleStatus(p, "attended")}
                        disabled={isMutating}
                        aria-label="출석"
                      >
                        <CheckCircle size={14} aria-hidden />
                        출석
                      </button>
                      <button
                        type="button"
                        className={`clinic-ops__att-btn clinic-ops__att-btn--noshow ${
                          isNoShow ? "clinic-ops__att-btn--active" : ""
                        }`}
                        onClick={() => handleToggleStatus(p, "no_show")}
                        disabled={isMutating}
                        aria-label="불참"
                      >
                        <XCircle size={14} aria-hidden />
                        불참
                      </button>
                    </div>
                  </div>

                  {/* Row 2: Reason + cycle + resolution + detail link */}
                  <div className="clinic-ops__card-detail-row">
                    <div className="clinic-ops__card-reasons">
                      {targets.length > 0 ? (
                        targets.map((t, idx) => (
                          <span
                            key={`${t.enrollment_id}-${t.session_title}-${idx}`}
                            className={`clinic-ops__reason-tag ${
                              t.resolved_at
                                ? "clinic-ops__reason-tag--resolved"
                                : t.clinic_reason === "homework"
                                ? "clinic-ops__reason-tag--homework"
                                : t.clinic_reason === "both"
                                ? "clinic-ops__reason-tag--both"
                                : "clinic-ops__reason-tag--exam"
                            }`}
                          >
                            {t.resolved_at ? (
                              <ShieldCheck size={11} aria-hidden />
                            ) : t.clinic_reason === "homework" ? (
                              <BookOpen size={11} aria-hidden />
                            ) : (
                              <FileQuestion size={11} aria-hidden />
                            )}
                            {getCycleLabel(t.cycle_no) && (
                              <span className="clinic-ops__cycle-badge-inline">
                                {getCycleLabel(t.cycle_no)}
                              </span>
                            )}
                            {t.resolved_at
                              ? getResolutionLabel(t.resolution_type) + " 통과"
                              : t.session_title
                              ? `${t.session_title} · ${formatScoreDetail(t)}`
                              : formatScoreDetail(t)}
                          </span>
                        ))
                      ) : (
                        <span className="clinic-ops__reason-tag clinic-ops__reason-tag--self">
                          자율 학습 참여
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Row 3: Inline actions — 클리닉 완료 / 진행중 점수입력 */}
                  {(() => {
                    const isSelfStudy = targets.length === 0;
                    const unresolvedTargets = targets.filter((t) => !t.resolved_at && t.clinic_link_id);
                    const isCompleted = !!p.completed_at;
                    // 결석 상태 → 결석 알림 발송 버튼
                    if (p.status === "no_show") {
                      return (
                        <div className="clinic-ops__card-inline-actions" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            className="clinic-ops__inline-btn clinic-ops__inline-btn--absent-notify"
                            onClick={() => {
                              if (!p.student) return;
                              openSendMessageModal({
                                studentIds: [p.student],
                                recipientLabel: `${p.student_name} 결석 알림`,
                                blockCategory: "clinic",
                                alimtalkExtraVars: {
                                  학생이름: p.student_name,
                                  클리닉장소: session?.location || "",
                                  클리닉날짜: session?.date || selectedDate,
                                  클리닉시간: formatTime(session?.start_time),
                                },
                              });
                            }}
                          >
                            <Send size={14} aria-hidden />
                            결석 알림 발송
                          </button>
                        </div>
                      );
                    }
                    // 취소/거절 상태에서는 완료 버튼 숨김
                    if (p.status === "cancelled" || p.status === "rejected") return null;

                    if (isSelfStudy) {
                      // 자율학습: 완료 토글 버튼
                      return (
                        <div className="clinic-ops__card-inline-actions" onClick={(e) => e.stopPropagation()}>
                          {isCompleted ? (
                            <button
                              type="button"
                              className="clinic-ops__inline-btn clinic-ops__inline-btn--completed"
                              onClick={() => handleUncomplete(p)}
                              disabled={completingIds.has(p.id)}
                            >
                              <CircleCheckBig size={14} aria-hidden />
                              클리닉 완료
                              <span className="clinic-ops__inline-btn-sub">
                                {dayjs(p.completed_at).format("HH:mm")}
                              </span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="clinic-ops__inline-btn clinic-ops__inline-btn--complete"
                              onClick={() => handleComplete(p)}
                              disabled={completingIds.has(p.id)}
                            >
                              <CircleCheckBig size={14} aria-hidden />
                              {completingIds.has(p.id) ? "처리 중…" : "클리닉 완료"}
                            </button>
                          )}
                        </div>
                      );
                    }

                    if (unresolvedTargets.length > 0) {
                      // 진행중: 인라인 점수 입력
                      return (
                        <div className="clinic-ops__card-inline-actions" onClick={(e) => e.stopPropagation()}>
                          {unresolvedTargets.map((t) => (
                            <div
                              key={t.clinic_link_id}
                              className="clinic-ops__inline-retake"
                            >
                              <span className="clinic-ops__inline-retake-label">
                                {t.source_type === "homework" ? "과제" : "시험"} 점수
                              </span>
                              <input
                                type="number"
                                className="clinic-ops__inline-retake-input"
                                placeholder="점수"
                                min={0}
                                value={retakeScores.get(t.clinic_link_id!) ?? ""}
                                onChange={(e) => {
                                  setRetakeScores((prev) => {
                                    const next = new Map(prev);
                                    next.set(t.clinic_link_id!, e.target.value);
                                    return next;
                                  });
                                }}
                                max={t.max_score ?? undefined}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") handleRetakeSubmit(t.clinic_link_id!, t.max_score);
                                }}
                                disabled={retakingIds.has(t.clinic_link_id!)}
                              />
                              <button
                                type="button"
                                className="clinic-ops__inline-retake-submit"
                                onClick={() => handleRetakeSubmit(t.clinic_link_id!, t.max_score)}
                                disabled={retakingIds.has(t.clinic_link_id!) || !(retakeScores.get(t.clinic_link_id!) ?? "").trim()}
                              >
                                {retakingIds.has(t.clinic_link_id!) ? "…" : "제출"}
                              </button>
                            </div>
                          ))}
                        </div>
                      );
                    }

                    return null;
                  })()}

                  {/* Optional: memo */}
                  {p.memo && (
                    <div className="clinic-ops__card-memo">메모: {p.memo}</div>
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
            onClick={() => setDrawerParticipantId(null)}
            aria-hidden
          />
          <div
            className="clinic-ops__drawer"
            role="dialog"
            aria-modal="true"
            aria-label="클리닉 상세"
          >
            <div className="clinic-ops__drawer-header">
              <h2 className="clinic-ops__drawer-title">클리닉 상세</h2>
              <button
                type="button"
                className="clinic-ops__drawer-close"
                onClick={() => setDrawerParticipantId(null)}
                aria-label="닫기"
              >
                <X size={18} />
              </button>
            </div>

            {/* Status action — 최상단에 배치하여 처리 공간화 */}
            <div className="clinic-ops__drawer-status-section">
              <div className="clinic-ops__drawer-status-current">
                <span className="clinic-ops__drawer-status-label">
                  현재 상태
                </span>
                <span
                  className={`clinic-ops__status-badge clinic-ops__status-badge--lg ${
                    drawerParticipant.status === "attended"
                      ? "clinic-ops__status-badge--attended"
                      : drawerParticipant.status === "no_show"
                      ? "clinic-ops__status-badge--noshow"
                      : "clinic-ops__status-badge--pending"
                  }`}
                >
                  {getStatusLabel(drawerParticipant.status)}
                </span>
              </div>
              <div className="clinic-ops__drawer-status-actions">
                <button
                  type="button"
                  className={`clinic-ops__drawer-status-btn clinic-ops__drawer-status-btn--attend ${
                    drawerParticipant.status === "attended"
                      ? "clinic-ops__drawer-status-btn--active"
                      : ""
                  }`}
                  disabled={mutatingIds.has(drawerParticipant.id)}
                  onClick={() =>
                    handleToggleStatus(drawerParticipant, "attended")
                  }
                >
                  <CheckCircle size={16} aria-hidden />
                  출석
                </button>
                <button
                  type="button"
                  className={`clinic-ops__drawer-status-btn clinic-ops__drawer-status-btn--noshow ${
                    drawerParticipant.status === "no_show"
                      ? "clinic-ops__drawer-status-btn--active"
                      : ""
                  }`}
                  disabled={mutatingIds.has(drawerParticipant.id)}
                  onClick={() =>
                    handleToggleStatus(drawerParticipant, "no_show")
                  }
                >
                  <XCircle size={16} aria-hidden />
                  불참
                </button>
              </div>
            </div>

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

              {/* Clinic reasons + remediation status */}
              <div className="clinic-ops__drawer-section">
                <h4 className="clinic-ops__drawer-section-title">대상 사유 · 통과 상태</h4>
                {drawerTargets.length === 0 ? (
                  <div className="clinic-ops__drawer-self-study">
                    <p className="clinic-ops__drawer-empty">자율 학습 참여</p>
                    {drawerParticipant.completed_at ? (
                      <div className="clinic-ops__drawer-completed">
                        <CircleCheckBig size={14} aria-hidden />
                        <span>완료 ({dayjs(drawerParticipant.completed_at).format("M/D HH:mm")})</span>
                        <button
                          type="button"
                          className="clinic-ops__remediation-btn clinic-ops__remediation-btn--waive"
                          onClick={() => handleUncomplete(drawerParticipant)}
                          disabled={completingIds.has(drawerParticipant.id)}
                        >
                          <Undo2 size={13} aria-hidden />
                          완료 취소
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="clinic-ops__remediation-btn clinic-ops__remediation-btn--resolve"
                        onClick={() => handleComplete(drawerParticipant)}
                        disabled={completingIds.has(drawerParticipant.id)}
                      >
                        <CircleCheckBig size={13} aria-hidden />
                        클리닉 완료
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="clinic-ops__drawer-reasons">
                    {drawerTargets.map((t, idx) => (
                      <div
                        key={`${t.enrollment_id}-${t.session_title}-${idx}`}
                        className="clinic-ops__drawer-reason-card"
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
                            {t.session_title && (
                              <span className="clinic-ops__drawer-reason-session">
                                {t.session_title}
                              </span>
                            )}
                            <span className="clinic-ops__drawer-reason-type">
                              {formatReasonLabel(t.clinic_reason)}
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

                        {/* Exam score */}
                        {(t.clinic_reason === "exam" ||
                          t.clinic_reason === "both" ||
                          t.reason === "score") &&
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
                                  style={{
                                    width: `${Math.min(
                                      100,
                                      (t.exam_score / t.cutline_score) * 100
                                    )}%`,
                                  }}
                                />
                                <div
                                  className="clinic-ops__drawer-score-cutline"
                                  style={{ left: "100%" }}
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
                                  {t.homework_cutline}점
                                </span>
                              </div>
                              <div className="clinic-ops__drawer-score-bar-wrap">
                                <div
                                  className="clinic-ops__drawer-score-fill clinic-ops__drawer-score-fill--fail"
                                  style={{
                                    width: `${Math.min(
                                      100,
                                      (t.homework_score / t.homework_cutline) *
                                        100
                                    )}%`,
                                  }}
                                />
                                <div
                                  className="clinic-ops__drawer-score-cutline"
                                  style={{ left: "100%" }}
                                />
                              </div>
                            </div>
                          )}

                        {/* ✅ Remediation actions — 진행중 case에만 표시 */}
                        {!t.resolved_at && t.clinic_link_id && (
                          <div className="clinic-ops__drawer-remediation-actions">
                            {/* 재시험 허용 + 시험 페이지 이동 */}
                            {(t.clinic_reason === "exam" || t.clinic_reason === "both") && t.exam_id && (
                              <button
                                type="button"
                                className="clinic-ops__remediation-btn clinic-ops__remediation-btn--retake"
                                disabled={remediatingLinkIds.has(t.clinic_link_id!)}
                                onClick={async () => {
                                  const linkId = t.clinic_link_id!;
                                  setRemediatingLinkIds((prev) => new Set(prev).add(linkId));
                                  try {
                                    await updateAdminExam(t.exam_id!, {
                                      allow_retake: true,
                                      max_attempts: 99,
                                    });
                                    feedback.success("재시험이 허용되었습니다. 학생이 다시 응시할 수 있습니다.");
                                    qc.invalidateQueries({ queryKey: ["clinic-targets"] });
                                  } catch {
                                    feedback.error("재시험 허용에 실패했습니다.");
                                  } finally {
                                    setRemediatingLinkIds((prev) => { const next = new Set(prev); next.delete(linkId); return next; });
                                  }
                                }}
                              >
                                <RotateCcw size={13} aria-hidden />
                                재시험 허용
                              </button>
                            )}

                            <button
                              type="button"
                              className="clinic-ops__remediation-btn clinic-ops__remediation-btn--resolve"
                              disabled={remediatingLinkIds.has(t.clinic_link_id!)}
                              onClick={async () => {
                                const linkId = t.clinic_link_id!;
                                setRemediatingLinkIds((prev) => new Set(prev).add(linkId));
                                try {
                                  await resolveClinicLink(linkId, "수동 통과");
                                  feedback.success("통과 처리되었습니다.");
                                  qc.invalidateQueries({ queryKey: ["clinic-targets"] });
                                  qc.invalidateQueries({ queryKey: ["clinic-participants"] });
                                } catch {
                                  feedback.error("통과 처리에 실패했습니다.");
                                } finally {
                                  setRemediatingLinkIds((prev) => { const next = new Set(prev); next.delete(linkId); return next; });
                                }
                              }}
                            >
                              <ShieldCheck size={13} aria-hidden />
                              수동 통과
                            </button>
                            <button
                              type="button"
                              className="clinic-ops__remediation-btn clinic-ops__remediation-btn--waive"
                              disabled={remediatingLinkIds.has(t.clinic_link_id!)}
                              onClick={async () => {
                                const linkId = t.clinic_link_id!;
                                setRemediatingLinkIds((prev) => new Set(prev).add(linkId));
                                try {
                                  await waiveClinicLink(linkId, "면제");
                                  feedback.success("면제 처리되었습니다.");
                                  qc.invalidateQueries({ queryKey: ["clinic-targets"] });
                                  qc.invalidateQueries({ queryKey: ["clinic-participants"] });
                                } catch {
                                  feedback.error("면제 처리에 실패했습니다.");
                                } finally {
                                  setRemediatingLinkIds((prev) => { const next = new Set(prev); next.delete(linkId); return next; });
                                }
                              }}
                            >
                              <Ban size={13} aria-hidden />
                              면제
                            </button>
                            <button
                              type="button"
                              className="clinic-ops__remediation-btn clinic-ops__remediation-btn--carryover"
                              disabled={remediatingLinkIds.has(t.clinic_link_id!)}
                              onClick={async () => {
                                const linkId = t.clinic_link_id!;
                                setRemediatingLinkIds((prev) => new Set(prev).add(linkId));
                                try {
                                  await carryOverClinicLink(linkId);
                                  feedback.success("다음 차수로 이월되었습니다.");
                                  qc.invalidateQueries({ queryKey: ["clinic-targets"] });
                                  qc.invalidateQueries({ queryKey: ["clinic-participants"] });
                                } catch {
                                  feedback.error("이월 처리에 실패했습니다.");
                                } finally {
                                  setRemediatingLinkIds((prev) => { const next = new Set(prev); next.delete(linkId); return next; });
                                }
                              }}
                            >
                              <ArrowRightCircle size={13} aria-hidden />
                              다음 차수 이월
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Memo */}
              <div className="clinic-ops__drawer-section">
                <h4 className="clinic-ops__drawer-section-title">메모</h4>
                <p className="clinic-ops__drawer-memo-text">
                  {drawerParticipant.memo || "메모 없음"}
                </p>
              </div>
            </div>
          </div>
        </>
      )}

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
            participants.map((p) => p.student)
          );
          const existingEnrollmentIds = new Set(
            participants
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
          qc.invalidateQueries({ queryKey: ["clinic-participants"] });
          qc.invalidateQueries({ queryKey: ["clinic-sessions-tree"] });
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
    </>
  );
}
