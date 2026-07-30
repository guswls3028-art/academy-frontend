// PATH: src/app_admin/domains/lectures/pages/scores/SessionScoresEntryPage.tsx
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, no-restricted-syntax */
/**
 * SessionScoresEntryPage — 성적 탭 (엑셀형 작업 플레이스)
 * - 완전히 빈 성적표는 바로 입력, 기존 데이터가 있으면 잠금 상태에서 수정 시작
 * - 수정 중 자동 저장·Excel형 단축키, 완료 시 저장 후 다시 잠금
 * - 학생 체크박스 선택 시 수업결과 알림톡 발송·성적일괄변경·엑셀 다운로드 (students 도메인 참고)
 *
 * 2026-05-12: 범용 발송 버튼 제거 — 학원장 임근혁 보고. 단일 알림톡 경로로 통일.
 */

import { lazy, Suspense, useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, ChevronDown, ClipboardCheck, ClipboardList, FileText, HeartPulse, LayoutGrid, LockKeyhole, Pencil, Plus, Printer, Trophy, UserRound, Users } from "lucide-react";
import { useConfirm } from "@/shared/ui/confirm";

import SessionScoresPanel, { type SessionScoresPanelHandle } from "@admin/domains/scores/panels/SessionScoresPanel";
import { useScoreEditDraft } from "@admin/domains/scores/hooks/useScoreEditDraft";
import {
  fetchSessionScores,
  type SessionScoreRow,
  type SessionScoresResponse,
} from "@/shared/api/contracts/sessionScores";
import { scoresQueryKeys } from "@/shared/api/queryKeys/scores";
import { Button, EmptyState, ICON_FOR_BUTTON } from "@/shared/ui/ds";
import { DomainListToolbar } from "@/shared/ui/domain";
import { AdminModal, ModalHeader, ModalBody, ModalFooter } from "@/shared/ui/modal";
import { useSendMessageModal } from "@admin/domains/messages/context/SendMessageModalContext";
import { fetchMessageTemplates } from "@admin/domains/messages/api/messages.api";
import { substituteScoreVars, buildScoreVars, buildScoreDetail, buildGenericScoreTemplate } from "@/shared/scoring/scoreReport";
import { DEFAULT_GRADES_PRESET_ID } from "@/shared/messaging/gradeTemplatePreset";
import { feedback } from "@/shared/ui/feedback/feedback";
import { fetchSessionEnrollments } from "@/shared/api/contracts/sessionEnrollments";
import { updateExamEnrollmentRows } from "@admin/domains/exams/api/examEnrollments";
import { putHomeworkAssignments } from "@admin/domains/homework/api/homeworkAssignments";
import { adminLectureQueryKeys } from "../../queryKeys";
import api from "@/shared/api/axios";
import { fetchAttendance } from "@admin/domains/lectures/api/attendance";
import { formatSessionBlockLabel } from "@/shared/ui/session-block";
import { useIsMobile } from "@/shared/hooks/useIsMobile";
import { useProgram } from "@/shared/program";
import SessionOmrUploadAction from "./SessionOmrUploadAction";
import { sessionAssessmentQueryKeys } from "@admin/domains/sessions/api/sessionAssessmentQueries";
import "./SessionScoresEntryPage.css";

type SessionScoresEntryPageProps = {
  onOpenCreateExam?: () => void;
  onOpenCreateHomework?: () => void;
};

function isCompletelyBlankScoreSheet(data: SessionScoresResponse | undefined): boolean {
  if (!data || data.rows.some((row) => row.progress_completed || row.progress_status === "completed")) {
    return false;
  }

  const entries = data.rows.flatMap((row) => [...row.exams, ...row.homeworks]);
  if (entries.length === 0) return false;

  return entries.every((entry) => {
    const { block } = entry;
    return (
      (entry.attempt_count ?? 0) === 0 &&
      block.score == null &&
      block.objective_score == null &&
      block.subjective_score == null &&
      block.is_locked !== true &&
      (block.meta == null || Object.keys(block.meta).length === 0)
    );
  });
}

const ScorePrintPreviewModal = lazy(() => import("@admin/domains/scores/components/ScorePrintPreviewModal"));
const StudentScoreReportModal = lazy(() => import("@admin/domains/scores/components/StudentScoreReportModal"));
const ClinicPrintPreviewModal = lazy(() => import("@admin/domains/scores/components/ClinicPrintPreviewModal"));
const AnonymousBillboardPreviewModal = lazy(() => import("@admin/domains/scores/components/AnonymousBillboardPreviewModal"));
const ManualExamGradingGrid = lazy(() => import("@admin/domains/results/components/ManualExamGradingGrid"));

export default function SessionScoresEntryPage({
  onOpenCreateExam,
  onOpenCreateHomework,
}: SessionScoresEntryPageProps = {}) {
  const { sessionId: sessionIdParam, lectureId: lectureIdParam } = useParams<{ lectureId: string; sessionId: string }>();
  const numericSessionId = Number(sessionIdParam);
  const numericLectureId = Number(lectureIdParam);
  const qc = useQueryClient();
  const confirm = useConfirm();
  const isMobile = useIsMobile();
  const { program } = useProgram();
  const isAnonymousBillboardMode = program?.feature_flags?.score_output_mode === "anonymous_billboard";
  const [searchInput, setSearchInput] = useState("");
  const [selectedEnrollmentIds, setSelectedEnrollmentIds] = useState<number[]>([]);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  /** 편집 시 어떤 셀을 쓰기 모드로 할지 */
  const [examEditTotal, setExamEditTotal] = useState(true);
  const [examEditSubjective, setExamEditSubjective] = useState(false);
  const [homeworkEdit, setHomeworkEdit] = useState(true);
  /** 읽기 모드에서 시험 점수 표시: 합산(한 칸) | 객관식+주관식(두 칸) */
  const [scoreDisplayMode, setScoreDisplayMode] = useState<"total" | "breakdown">("total");
  /** 뷰 필터: 시험만/과제만/전체 */
  const [viewFilter, setViewFilter] = useState<"all" | "exam" | "homework">("all");
  /** 점수 표시 형식: raw(원점수만) | fraction(50/100) */
  const [scoreFormat, setScoreFormat] = useState<"raw" | "fraction">("fraction");
  /** 읽기 모드 표시 옵션 펼침 — 첫 사용자에게 압도감 없도록 default collapsed.
      비-default 값일 때는 자동 펼침 (학원장이 자기 설정을 즉시 인식). */
  const [viewOptionsExpanded, setViewOptionsExpanded] = useState(false);
  const hasNonDefaultViewOptions =
    viewFilter !== "all" || scoreDisplayMode !== "total" || scoreFormat !== "fraction";
  const { openSendMessageModal } = useSendMessageModal();
  const panelRef = useRef<SessionScoresPanelHandle>(null);
  const [showBulkScoreModal, setShowBulkScoreModal] = useState(false);
  const [bulkScoreValue, setBulkScoreValue] = useState("");
  const [bulkScoreTarget, setBulkScoreTarget] = useState<"exam" | "homework">("exam");

  const [enrollingAll, setEnrollingAll] = useState(false);
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [showStudentReport, setShowStudentReport] = useState(false);
  const [showClinicPreview, setShowClinicPreview] = useState(false);
  const [showBillboardPreview, setShowBillboardPreview] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [gradingExam, setGradingExam] = useState<{ examId: number; title: string } | null>(null);
  const [manualGradingDirty, setManualGradingDirty] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const recoveryRestoreButtonRef = useRef<HTMLButtonElement>(null);
  const recoveryDialogRef = useRef<HTMLDivElement>(null);
  const recoveryPreviousFocusRef = useRef<HTMLElement | null>(null);
  const isEditModeRef = useRef(false);
  const autoEditAttemptedSessionsRef = useRef(new Set<number>());
  isEditModeRef.current = isEditMode;
  const shouldLoadPrintData = showPrintPreview || showStudentReport || showClinicPreview || showBillboardPreview;

  /** 강의 정보 (PDF 제목용) */
  const { data: lectureData } = useQuery({
    queryKey: adminLectureQueryKeys.lecture(numericLectureId),
    queryFn: async () => (await api.get(`/lectures/lectures/${numericLectureId}/`)).data,
    enabled: shouldLoadPrintData && Number.isFinite(numericLectureId),
  });
  /** 세션 정보 (PDF 제목용) */
  const { data: sessionData } = useQuery({
    queryKey: adminLectureQueryKeys.sessionDetail(numericSessionId),
    queryFn: async () => (await api.get(`/lectures/sessions/${numericSessionId}/`)).data,
    enabled: shouldLoadPrintData && Number.isFinite(numericSessionId),
  });
  /** 출결 (PDF 출결 열 + 클리닉 현황용) */
  const { data: attendanceForPdf } = useQuery({
    queryKey: adminLectureQueryKeys.attendanceForPdf(numericSessionId),
    queryFn: () => fetchAttendance(numericSessionId, { page_size: 500 }),
    enabled: shouldLoadPrintData && Number.isFinite(numericSessionId),
  });

  const attendanceMapForPdf = useMemo(() => {
    const raw = attendanceForPdf;
    const list = raw?.data ?? [];
    const map: Record<number, string> = {};
    for (const a of list) {
      const eid = (a as any)?.enrollment_id ?? (a as any)?.enrollment;
      if (eid != null && (a as any)?.status) map[Number(eid)] = String((a as any).status);
    }
    return map;
  }, [attendanceForPdf]);

  const sessionTitle = sessionData
    ? formatSessionBlockLabel(sessionData)
    : `차시 #${numericSessionId}`;
  const lectureTitle = lectureData?.title || "강의";

  // 더보기 메뉴 외부 클릭 닫기
  useEffect(() => {
    if (!showMoreMenu) return;
    const handler = (e: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) setShowMoreMenu(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showMoreMenu]);

  const invalidateScores = () => {
    void qc.invalidateQueries({ queryKey: scoresQueryKeys.sessionScores(numericSessionId) });
    void qc.invalidateQueries({ queryKey: sessionAssessmentQueryKeys.exams(numericSessionId) });
    void qc.invalidateQueries({ queryKey: sessionAssessmentQueryKeys.homeworks(numericSessionId) });
  };
  const closeManualGrading = async () => {
    if (manualGradingDirty) {
      const shouldClose = await confirm({
        title: "채점표를 닫을까요?",
        message: "아직 성적을 확정하지 않은 변경사항이 있습니다. 닫으면 이 화면에서 입력한 내용이 사라집니다.",
        confirmText: "저장하지 않고 닫기",
        danger: false,
      });
      if (!shouldClose) return;
    }
    setManualGradingDirty(false);
    setGradingExam(null);
  };
  const openCreateExam = () => onOpenCreateExam?.();
  const openCreateHomework = () => onOpenCreateHomework?.();

  /** 대상자 전체 등록 — 세션 수강생을 모든 시험/과제에 일괄 등록 */
  const handleEnrollAll = async () => {
    if (!Number.isFinite(numericSessionId)) return;
    const meta = data?.meta;
    if (!meta || ((meta.exams?.length ?? 0) === 0 && (meta.homeworks?.length ?? 0) === 0)) {
      feedback.error("등록된 시험 또는 과제가 없습니다. 먼저 시험/과제를 추가하세요.");
      return;
    }
    setEnrollingAll(true);
    try {
      const enrollments = await fetchSessionEnrollments(numericSessionId);
      const enrollmentIds = enrollments.map((e) => e.enrollment);
      if (enrollmentIds.length === 0) {
        feedback.error("세션에 등록된 수강생이 없습니다.");
        return;
      }
      const promises: Promise<any>[] = [];
      for (const exam of meta.exams ?? []) {
        promises.push(
          updateExamEnrollmentRows({
            examId: exam.exam_id,
            sessionId: numericSessionId,
            enrollment_ids: enrollmentIds,
          })
        );
      }
      for (const hw of meta.homeworks ?? []) {
        promises.push(
          putHomeworkAssignments({
            homeworkId: hw.homework_id,
            enrollment_ids: enrollmentIds,
          })
        );
      }
      await Promise.all(promises);
      invalidateScores();
      feedback.success(`수강생 ${enrollmentIds.length}명이 모든 시험/과제에 등록되었습니다.`);
    } catch (e: any) {
      feedback.error("대상자 등록에 실패했습니다. 수강생 등록 상태를 확인해 주세요.");
    } finally {
      setEnrollingAll(false);
    }
  };

  const sessionIdForDraft = Number.isFinite(numericSessionId) ? numericSessionId : 0;
  const draft = useScoreEditDraft({
    sessionId: sessionIdForDraft,
    panelRef,
    isActive: isEditMode && sessionIdForDraft > 0,
    checkForRecovery: sessionIdForDraft > 0,
  });
  const {
    beginEditing: beginScoreEditing,
    saveNow: saveScoreDraftNow,
    releaseEditLease: releaseScoreEditLease,
  } = draft;
  const setPanelHandle = useCallback((handle: SessionScoresPanelHandle | null) => {
    if (handle == null && isEditModeRef.current) {
      panelRef.current?.commitActiveCell?.();
      // SPA 탭/차시 이동은 React unmount를 기다리지 않는다. ref를 해제하기 전에
      // 최종 스냅샷을 캡처해 저장을 시작하고, 패널의 보존 handle로 PATCH를 완료한다.
      void saveScoreDraftNow()
        .then(() => releaseScoreEditLease())
        .catch(() => undefined);
    }
    panelRef.current = handle;
  }, [releaseScoreEditLease, saveScoreDraftNow]);
  const [, setTick] = useState(0);
  useEffect(() => {
    if (draft.draftStatus !== "saved") return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [draft.draftStatus]);

  const saveScoresNow = useCallback(async (announce = false): Promise<boolean> => {
    if (panelRef.current?.commitActiveCell?.() === false) return false;
    await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
    setIsSaving(true);
    try {
      const savedCount = await saveScoreDraftNow();
      if (announce) {
        feedback.success(savedCount > 0 ? `${savedCount}건의 점수를 저장했습니다.` : "모든 점수가 저장되어 있습니다.");
      }
      return true;
    } catch (err) {
      feedback.error((err as Error).message || "저장에 실패했습니다. 입력값은 유지됩니다.");
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [saveScoreDraftNow]);

  useEffect(() => {
    if (!draft.hasDraftToRestore) return;
    recoveryPreviousFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    recoveryRestoreButtonRef.current?.focus();

    const keepFocusInsideDialog = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        feedback.info("임시저장을 복원하거나 버리기를 선택해 주세요.");
        return;
      }
      if (event.key !== "Tab") return;
      const dialog = recoveryDialogRef.current;
      if (!dialog) return;
      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (focusable.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", keepFocusInsideDialog);
    return () => {
      document.removeEventListener("keydown", keepFocusInsideDialog);
      const previous = recoveryPreviousFocusRef.current;
      if (previous?.isConnected) previous.focus();
    };
  }, [draft.hasDraftToRestore]);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (!isEditMode) return;
      if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
      const key = event.key.toLowerCase();
      if (key === "s") {
        event.preventDefault();
        void saveScoresNow(true);
        return;
      }
      if (key !== "z" && key !== "y") return;
      const activeElement = document.activeElement;
      const isScoreCell =
        activeElement instanceof HTMLElement &&
        activeElement.classList.contains("ds-scores-cell-editable");
      const isTextEditingElement =
        activeElement instanceof HTMLInputElement ||
        activeElement instanceof HTMLTextAreaElement ||
        (activeElement instanceof HTMLElement && activeElement.isContentEditable);

      if (isTextEditingElement && !isScoreCell) return;
      if (panelRef.current?.hasUncommittedActiveCell?.()) return;
      if (isScoreCell) event.preventDefault();

      const redo = key === "y" || (key === "z" && event.shiftKey);
      const changed = redo
        ? panelRef.current?.redoLastChange?.()
        : panelRef.current?.undoLastChange?.();
      if (changed) event.preventDefault();
    };
    document.addEventListener("keydown", handleShortcut);
    return () => document.removeEventListener("keydown", handleShortcut);
  }, [isEditMode, saveScoresNow]);

  useEffect(() => {
    if (!isEditMode) return;
    const commitBeforePointerAction = (event: PointerEvent) => {
      const active = document.activeElement;
      if (!(active instanceof HTMLElement) || !active.classList.contains("ds-scores-cell-editable")) return;
      if (event.target instanceof Node && active.contains(event.target)) return;
      active.blur();
    };
    document.addEventListener("pointerdown", commitBeforePointerAction, true);
    return () => document.removeEventListener("pointerdown", commitBeforePointerAction, true);
  }, [isEditMode]);

  const { data, isLoading, isFetching, isError, refetch } = useQuery({
    queryKey: scoresQueryKeys.sessionScores(numericSessionId),
    queryFn: () => fetchSessionScores(numericSessionId),
    enabled: Number.isFinite(numericSessionId) && numericSessionId > 0,
  });
  const isBlankScoreSheet = useMemo(() => isCompletelyBlankScoreSheet(data), [data]);

  const hasSubjectiveExam = useMemo(
    () => (data?.meta?.exams ?? []).some((exam) => Number(exam.subjective_max_score ?? 0) > 0),
    [data?.meta?.exams],
  );

  // P1-5: setPresetTotalHw / setPresetSubjectiveHw preset 함수 제거 — 5버튼 segment 단순화로 불필요.

  const handleSelectTotal = async () => {
    if (examEditTotal) {
      setExamEditTotal(false);
      return;
    }
    if (examEditSubjective) {
      const ok = await confirm({ title: "입력 방식 변경", message: "주관식만 입력이 해제됩니다. 합산으로 입력하시겠습니까?", confirmText: "합산 입력" });
      if (!ok) return;
      setExamEditSubjective(false);
    }
    setExamEditTotal(true);
    setScoreDisplayMode("total");
  };
  const handleSelectSubjective = async () => {
    if (!hasSubjectiveExam) {
      feedback.info("이 차시의 시험에는 채점 대상 단답형 문항이 없습니다. OMR 단답형 공간은 점수 입력 대상이 아닙니다.");
      return;
    }
    if (examEditSubjective) {
      setExamEditSubjective(false);
      return;
    }
    if (examEditTotal) {
      const ok = await confirm({ title: "입력 방식 변경", message: "합산 입력이 해제됩니다. 주관식만으로 입력하시겠습니까?", confirmText: "주관식 입력" });
      if (!ok) return;
      setExamEditTotal(false);
    }
    setExamEditSubjective(true);
    setScoreDisplayMode("breakdown");
  };
  const handleSelectHomework = () => setHomeworkEdit((v) => !v);

  /** 시험 또는 과제 둘 중 하나라도 등록된 수강생만 테이블에 표시 → 툴바 인원도 동일 기준 */
  const displayCount = useMemo(() => {
    const raw = data?.rows ?? [];
    return raw.filter((r) => (r.exams?.length ?? 0) > 0 || (r.homeworks?.length ?? 0) > 0).length;
  }, [data?.rows]);

  /** 성적 일괄 변경 — Enter / 적용 버튼 단일 진입점.
      2026-05-13 3차: 동일 로직 40+줄이 onEnterConfirm + onClick 양쪽에 중복돼 있던 drift 위험을 한 곳으로. */
  const applyBulkScore = () => {
    const score = Number(bulkScoreValue);
    if (Number.isNaN(score) || score < 0) {
      feedback.error("유효한 점수를 입력해주세요.");
      return;
    }
    const meta = data?.meta;
    const changes: import("@admin/domains/scores/api/scoreDraft").PendingChange[] = [];
    for (const enrollmentId of selectedEnrollmentIds) {
      if (bulkScoreTarget === "exam") {
        for (const exam of meta?.exams ?? []) {
          const maxScore = exam.max_score ?? 100;
          if (score > maxScore) {
            feedback.error(`${exam.title}의 최대 점수(${maxScore})를 초과합니다.`);
            return;
          }
          changes.push({ type: "examTotal", examId: exam.exam_id, enrollmentId, score, maxScore });
        }
      } else {
        for (const hw of meta?.homeworks ?? []) {
          const maxScore = hw.max_score ?? 100;
          if (score > maxScore) {
            feedback.error(`${hw.title}의 최대 점수(${maxScore})를 초과합니다.`);
            return;
          }
          changes.push({ type: "homework", homeworkId: hw.homework_id, enrollmentId, score });
        }
      }
    }
    if (changes.length === 0) {
      feedback.error("변경할 대상이 없습니다. 시험 또는 과제가 등록되어 있는지 확인하세요.");
      return;
    }
    panelRef.current?.applyDraftPatch(changes);
    feedback.success(
      `${bulkScoreTarget === "exam" ? "시험" : "과제"} 성적을 변경했습니다. (${selectedEnrollmentIds.length}명, ${score}점) 자동 저장됩니다.`
    );
    setShowBulkScoreModal(false);
    setBulkScoreValue("");
  };

  const hasSelection = selectedEnrollmentIds.length > 0;
  const showSelectionActions = hasSelection || !isMobile;
  const dimSelectionBar = !hasSelection && !isMobile;
  const recoveryBlocked =
    draft.isRecoveryCheckPending ||
    draft.recoveryCheckFailed ||
    draft.editLockConflict ||
    draft.hasDraftToRestore;
  const scoreAlimtalkDisabled = selectedEnrollmentIds.length === 0 || isEditMode || isSaving || recoveryBlocked;
  const scoreAlimtalkTitle = selectedEnrollmentIds.length === 0
    ? "학생을 선택하세요."
    : recoveryBlocked
      ? "이전 입력 복구 여부를 먼저 확인해 주세요."
    : isEditMode
      ? "점수를 저장하고 잠근 뒤 알림톡을 발송할 수 있습니다."
      : "선택한 학생에게 저장된 성적 기준으로 알림톡을 발송합니다.";
  /* 2026-05-13 회귀 fix: hasExamsOrHomeworks 가 selectionBar 안에서 참조되는데
     이전엔 line 581 (selectionBar 아래) 에서 선언 → TDZ ReferenceError 발생, 페이지 crash.
     selectionBar 보다 위로 이동. */
  const hasExamsOrHomeworks = (data?.meta?.exams?.length ?? 0) > 0 || (data?.meta?.homeworks?.length ?? 0) > 0;
  const examOptions = data?.meta?.exams ?? [];

  useEffect(() => {
    if (
      !isBlankScoreSheet ||
      isLoading ||
      isFetching ||
      isError ||
      isEditMode ||
      recoveryBlocked ||
      autoEditAttemptedSessionsRef.current.has(sessionIdForDraft)
    ) {
      return;
    }

    autoEditAttemptedSessionsRef.current.add(sessionIdForDraft);
    let cancelled = false;
    void beginScoreEditing().then(async (started) => {
      if (!started) return;
      if (cancelled) {
        await releaseScoreEditLease();
        return;
      }
      setIsEditMode(true);
    });
    return () => {
      cancelled = true;
    };
  }, [
    beginScoreEditing,
    isBlankScoreSheet,
    isEditMode,
    isError,
    isFetching,
    isLoading,
    recoveryBlocked,
    releaseScoreEditLease,
    sessionIdForDraft,
  ]);

  // 2026-05-13 학원장 호소: "1명 선택됨이 평소에도 0명 선택됨으로 있었으면", "선택 해제 동떨어짐".
  // selectionBar 를 항상 노출(평상시 0명 + 액션 disabled). "선택 해제"는 액션 그룹 직후 자연 위치.
  const selectionBar = (
    <div className="scores-selection-bar">
      <div
        className="scores-selection-bar__row"
        style={{ opacity: dimSelectionBar ? 0.62 : 1, transition: "opacity 0.15s" }}
      >
        {showSelectionActions && (
          <span
            className="text-[13px] font-semibold whitespace-nowrap"
            style={{ color: hasSelection ? "var(--color-brand-primary)" : "var(--color-text-muted)" }}
          >
            {`${selectedEnrollmentIds.length}명 선택됨`}
          </span>
        )}

        {/* ── 그룹 1: primary 액션 ── */}
        {/*
          범용 발송 버튼 제거 (2026-05-12) — 학원장 임근혁 보고:
          "메세지 발송기능 프로그램에서 그냥 지워". 알림톡 발송은 "수업결과 알림톡 발송" 단일 경로.
        */}
        {showSelectionActions && (
          <Button
            intent="primary"
            size="sm"
            title={scoreAlimtalkTitle}
            onClick={async () => {
              if (recoveryBlocked) {
                feedback.info("이전 입력 복구 여부를 먼저 확인해 주세요.");
                return;
              }
              if (isEditMode) {
                feedback.info("점수를 저장하고 잠근 뒤 알림톡을 발송해 주세요.");
                return;
              }
              if (!await saveScoresNow()) return;
              const freshData = (await refetch()).data ?? data;
              const rows = freshData?.rows ?? [];
              const selectedRows = rows.filter((r) => selectedEnrollmentIds.includes(r.enrollment_id));
              const meta = freshData?.meta ?? null;
              const activeStudentIds = selectedRows
                .map((row) => row.student_id)
                .filter((id): id is number => id != null && Number.isFinite(id));
              // SSOT (2026-05-13): backend 응답 meta가 진짜 진리. 캐시 fallback은 호환.
              const lecture = qc.getQueryData<{ title?: string; name?: string }>(
                adminLectureQueryKeys.lecture(numericLectureId),
              );
              const session = qc.getQueryData<{ title?: string }>(
                adminLectureQueryKeys.sessionDetail(numericSessionId),
              );
              const lectureName = meta?.lecture_title ?? lecture?.title ?? lecture?.name ?? "";
              const sessionTitle = meta?.session_title ?? session?.title ?? "";
              const reportOptions = { lectureName, sessionTitle };

              let initialBody: string | undefined;
              let initialTemplateId: number | null = null;
              let initialLetterPresetId: string | null = null;
              let scoreDetail = "";

              try {
                const templates = await fetchMessageTemplates("grades");
                const hasScoreVars = (body: string) => /#{(시험\d|과제\d|시험성적|시험이력|시험목록|시험총점|학생이름)}/.test(body);
                const userDefault = templates.find((t: any) => t.is_user_default && !t.is_system);
                const userWithScoreVars = templates.find((t: any) => !t.is_system && hasScoreVars(t.body));
                const chosenTpl = userDefault ?? userWithScoreVars;

                // 학원장 임근혁 보고(2026-05-12 23:50):
                // 일괄 발송 양식이 첫 학생으로 치환되어 나와 "특정 대상 한 명으로 하드코딩됐다"는 오해.
                // → 양식 본문은 변수 그대로 (#{학생이름}/#{시험1명}/...) 노출.
                initialBody = chosenTpl
                  ? chosenTpl.body
                  : buildGenericScoreTemplate(reportOptions);
                initialTemplateId = chosenTpl?.id ?? null;
                initialLetterPresetId = chosenTpl ? null : DEFAULT_GRADES_PRESET_ID;
                scoreDetail = buildScoreDetail(selectedRows[0], meta);
              } catch {
                // 템플릿 조회 실패 시 — 범용 양식 fallback (변수 그대로)
                initialBody = buildGenericScoreTemplate(reportOptions);
                initialTemplateId = null;
                initialLetterPresetId = DEFAULT_GRADES_PRESET_ID;
                scoreDetail = buildScoreDetail(selectedRows[0], meta);
              }

              // SSOT (2026-05-14): 학생별 변수 재계산 callback.
              // 학원장이 modal textarea에서 본문 수정 시 modal이 currentBody 기반으로 이 callback 호출 →
              // 각 학생별 substituteScoreVars 결과 (_body_subst) 가 학원장 수정본 반영.
              // 직전 결함: 모달 열기 전 사전 계산된 _body_subst 만 보내면 학원장 수정이 silently discard.
              const recomputePerStudentVars = (currentBody: string): Record<number, Record<string, string>> => {
                const result: Record<number, Record<string, string>> = {};
                for (const sRow of selectedRows) {
                  if (sRow.student_id == null) continue;
                  const scoreVars = buildScoreVars(sRow, meta, reportOptions);
                  result[sRow.student_id] = {
                    ...scoreVars,
                    _body_subst: substituteScoreVars(currentBody, sRow, meta, reportOptions),
                  };
                }
                return result;
              };
              const firstScoreVars = selectedRows[0]
                ? buildScoreVars(selectedRows[0], meta, reportOptions)
                : {};

              openSendMessageModal({
                studentIds: activeStudentIds,
                recipientLabel: `수업결과 발송 — 선택한 수강생 ${selectedEnrollmentIds.length}명`,
                blockCategory: "grades",
                initialBody,
                initialTemplateId,
                initialLetterPresetId,
                alimtalkExtraVars: { 강의명: lectureName, 차시명: sessionTitle, 시험성적: scoreDetail, ...firstScoreVars },
                recomputePerStudentVars,
              });
            }}
            disabled={scoreAlimtalkDisabled}
          >
            수업결과 알림톡 발송
          </Button>
        )}

        {/* ── 디바이더 ── */}
        {showSelectionActions && <span className="h-5 w-px bg-[var(--color-border-divider)] scores-action-divider" aria-hidden="true" />}

        {/* ── 그룹 2: secondary 액션 ── */}
        {showSelectionActions && (
          <>
            <Button
              intent="secondary"
              size="sm"
              onClick={() => setShowBulkScoreModal(true)}
              disabled={selectedEnrollmentIds.length === 0 || !isEditMode}
              title={!isEditMode ? "수정을 누른 뒤 사용할 수 있습니다." : selectedEnrollmentIds.length === 0 ? "학생을 선택하세요." : "선택한 학생의 시험·과제 점수를 한번에 변경합니다."}
            >
              성적 일괄 변경
            </Button>
            <Button
              intent="secondary"
              size="sm"
              onClick={async () => {
                if (!await saveScoresNow()) return;
                const freshData = (await refetch()).data ?? data;
                const rows = freshData?.rows ?? [];
                const selected = rows.filter((r) => selectedEnrollmentIds.includes(r.enrollment_id));
                if (selected.length === 0) {
                  feedback.info("선택한 학생이 없습니다.");
                  return;
                }
                const metaExams = freshData?.meta?.exams ?? [];
                const metaHomeworks = freshData?.meta?.homeworks ?? [];
                const headers = ["이름"];
                metaExams.forEach((e) => headers.push(`${e.title ?? "시험"} (점수)`));
                metaHomeworks.forEach((h) => headers.push(`${h.title ?? "과제"} (점수)`));

                const csvRows = [headers.map((h) => `"${h.replace(/"/g, '""')}"`).join(",")];
                for (const row of selected) {
                  const cells: string[] = [row.student_name ?? ""];
                  // Match by exam_id/homework_id to ensure column alignment with headers
                  for (const metaExam of metaExams) {
                    const entry = (row.exams ?? []).find((e) => e.exam_id === metaExam.exam_id);
                    cells.push(entry?.block.score != null ? String(entry.block.score) : "");
                  }
                  for (const metaHw of metaHomeworks) {
                    const entry = (row.homeworks ?? []).find((h) => h.homework_id === metaHw.homework_id);
                    cells.push(entry?.block.score != null ? String(entry.block.score) : "");
                  }
                  csvRows.push(cells.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","));
                }

                const bom = "\uFEFF";
                const blob = new Blob([bom + csvRows.join("\n")], { type: "text/csv;charset=utf-8" });
                const { downloadBlob } = await import("@/shared/utils/safeDownload");
                downloadBlob(blob, `성적_${selected.length}명.csv`);
                feedback.success(`엑셀 다운로드됨 (${selected.length}명)`);
              }}
              disabled={selectedEnrollmentIds.length === 0 || recoveryBlocked}
              title={recoveryBlocked ? "이전 입력 복구 여부를 먼저 확인해 주세요." : undefined}
            >
              엑셀 다운로드
            </Button>
          </>
        )}

        {/* 2026-05-13: 선택 해제는 액션 그룹 바로 옆에. 우측 끝 flex spacer 폐기.
            평상시 0명일 때도 노출되며 disabled. */}
        {showSelectionActions && (
          <Button
            intent="ghost"
            size="sm"
            onClick={() => setSelectedEnrollmentIds([])}
            disabled={!hasSelection}
          >
            선택 해제
          </Button>
        )}

        {/* 우측 컨텍스트 옵션 — 표시 방식과 입력 대상을 한 줄에서 조정 */}
        {hasExamsOrHomeworks && (
          <>
            {showSelectionActions && <span className="h-5 w-px bg-[var(--color-border-divider)] scores-action-divider" aria-hidden="true" />}
            <button
              type="button"
              onClick={() => setViewOptionsExpanded((v) => !v)}
              className="inline-flex items-center gap-1 text-xs font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] px-2 py-1 rounded hover:bg-[var(--color-bg-surface-hover)]"
              aria-expanded={viewOptionsExpanded || hasNonDefaultViewOptions}
            >
              <ChevronDown
                size={ICON_FOR_BUTTON.sm}
                style={{ transform: (viewOptionsExpanded || hasNonDefaultViewOptions) ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.15s" }}
              />
              표시 옵션
              {hasNonDefaultViewOptions && (
                <span className="ml-1 inline-flex items-center justify-center min-w-[6px] h-[6px] rounded-full bg-[var(--color-brand-primary)]" aria-label="설정 변경됨" />
              )}
            </button>
          </>
        )}
        {isEditMode && (
          <>
            {showSelectionActions && <span className="h-5 w-px bg-[var(--color-border-divider)] scores-action-divider" aria-hidden="true" />}
            <div className="scores-view-filter-section">
              <span className="scores-view-filter-label">시험</span>
              <div className="scores-display-segment" role="group" aria-label="시험 점수 입력 방식">
                <button type="button" onClick={handleSelectTotal} className="scores-display-segment__btn" aria-pressed={examEditTotal} title="시험 합산 점수만 한 칸으로 입력">합산</button>
                <button
                  type="button"
                  onClick={handleSelectSubjective}
                  className="scores-display-segment__btn"
                  aria-pressed={examEditSubjective}
                  disabled={!hasSubjectiveExam}
                  title={hasSubjectiveExam ? "서술형 점수만 입력 (객관식은 OMR 자동 채점)" : "채점 대상 서술형 문항 없음"}
                >
                  주관식
                </button>
              </div>
            </div>
            <div className="scores-view-filter-section">
              <span className="scores-view-filter-label">과제</span>
              <div className="scores-display-segment" role="group" aria-label="과제 점수 입력 켜짐/꺼짐">
                <button type="button" onClick={() => { if (!homeworkEdit) handleSelectHomework(); }} className="scores-display-segment__btn" aria-pressed={homeworkEdit} title="과제 점수 입력 가능 상태">켜짐</button>
                <button type="button" onClick={() => { if (homeworkEdit) handleSelectHomework(); }} className="scores-display-segment__btn" aria-pressed={!homeworkEdit} title="과제 점수 입력 차단 상태">꺼짐</button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* 표시 옵션 펼침 — selectionBar 다음 줄로 inline expand. */}
      {hasExamsOrHomeworks && (viewOptionsExpanded || hasNonDefaultViewOptions) && (
        <div className="scores-selection-bar__options">
          <div className="scores-view-filter-section">
            <span className="scores-view-filter-label">보기</span>
            <div className="scores-display-segment" role="group" aria-label="컬럼 필터">
              <button type="button" onClick={() => setViewFilter("all")} className="scores-display-segment__btn" aria-pressed={viewFilter === "all"}>전체</button>
              <button type="button" onClick={() => setViewFilter("exam")} className="scores-display-segment__btn" aria-pressed={viewFilter === "exam"}>시험만</button>
              <button type="button" onClick={() => setViewFilter("homework")} className="scores-display-segment__btn" aria-pressed={viewFilter === "homework"}>과제만</button>
            </div>
          </div>
          {viewFilter !== "homework" && (
            <div className="scores-view-filter-section">
              <span className="scores-view-filter-label">시험 점수</span>
              <div className="scores-display-segment" role="group" aria-label="시험 점수 표시 방식">
                <button type="button" onClick={() => setScoreDisplayMode("total")} className="scores-display-segment__btn" aria-pressed={scoreDisplayMode === "total"}>합산</button>
                <button type="button" onClick={() => setScoreDisplayMode("breakdown")} className="scores-display-segment__btn" aria-pressed={scoreDisplayMode === "breakdown"}>객관식 + 주관식</button>
              </div>
            </div>
          )}
          <div className="scores-view-filter-section">
            <span className="scores-view-filter-label">점수 표시</span>
            <div className="scores-display-segment" role="group" aria-label="점수 표시 형식">
              <button type="button" onClick={() => setScoreFormat("raw")} className="scores-display-segment__btn" aria-pressed={scoreFormat === "raw"}>원점수</button>
              <button type="button" onClick={() => setScoreFormat("fraction")} className="scores-display-segment__btn" aria-pressed={scoreFormat === "fraction"}>만점 표기</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  if (!Number.isFinite(numericSessionId)) {
    return (
      <div className="p-6 text-sm" style={{ color: "var(--color-error)" }}>
        차시 정보를 찾을 수 없습니다.
      </div>
    );
  }

  const primaryAction = (
    <div className="scores-primary-actions">
      {/* ── 그룹 1: OMR 주 동선 ──
          SSOT: 차시 성적 화면에서 OMR 스캔 등록을 가장 먼저 보여준다.
          시험 상세/제출관리는 등록이 아니라 조회/재처리 보조 동선으로 둔다. */}
      <SessionOmrUploadAction
        exams={examOptions}
        onRefresh={invalidateScores}
        disabled={
          recoveryBlocked ||
          isEditMode ||
          isSaving ||
          draft.hasPendingChanges ||
          draft.draftStatus === "saving" ||
          draft.draftStatus === "error"
        }
      />

      {/* ── 그룹 2: 안전한 수정 시작 / 저장 완료 ── */}
      <Button
        type="button"
        intent={isEditMode ? "primary" : "secondary"}
        size="sm"
        className="scores-edit-action"
        disabled={isSaving || draft.isStartingEdit || isLoading || isError || recoveryBlocked}
        leftIcon={isEditMode
          ? <LockKeyhole size={ICON_FOR_BUTTON.sm} />
          : <Pencil size={ICON_FOR_BUTTON.sm} />}
        onClick={async () => {
          if (!isEditMode) {
            if (!await beginScoreEditing()) {
              feedback.error("다른 화면의 수정을 마친 뒤 다시 시도해 주세요.");
              return;
            }
            setIsEditMode(true);
            return;
          }
          if (!await saveScoresNow()) return;
          setIsSaving(true);
          const released = await draft.releaseEditLease();
          setIsSaving(false);
          if (!released) return;
          setIsEditMode(false);
          feedback.success("점수를 저장하고 입력을 잠갔습니다.");
        }}
        title={isEditMode
          ? "입력 중인 점수를 저장하고 실수 방지를 위해 잠급니다"
          : "점수 입력을 시작합니다"}
      >
        {isSaving || draft.isStartingEdit ? "저장 중…" : isEditMode ? "저장하고 잠금" : "수정"}
      </Button>

      {/* 구성·출력·클리닉을 한곳에 모아 상단의 선택 부담을 줄인다. */}
      <div ref={moreMenuRef} className="relative">
        <Button
          type="button"
          intent="secondary"
          size="sm"
          className="scores-tools-trigger"
          leftIcon={<LayoutGrid size={ICON_FOR_BUTTON.sm} />}
          rightIcon={(
            <ChevronDown
              size={ICON_FOR_BUTTON.sm}
              className="scores-tools-trigger__chevron"
              data-open={showMoreMenu ? "true" : "false"}
            />
          )}
          onClick={() => setShowMoreMenu((v) => !v)}
          aria-label="성적 도구"
          aria-expanded={showMoreMenu}
          title="시험·과제 추가, 성적표 출력, 클리닉 관리"
        >
          성적 도구
        </Button>
        {showMoreMenu && (
          <div className="scores-more-menu scores-tools-menu" role="menu" aria-label="성적 도구">
            <div className="scores-tools-menu__header">
              <strong>성적 도구</strong>
              <span>평가 준비부터 출력·클리닉까지</span>
            </div>
            <div className="scores-tools-menu__section">
              <span className="scores-tools-menu__label">평가 구성</span>
              <div className="scores-tools-menu__grid">
                <button
                  type="button"
                  role="menuitem"
                  className="scores-tool-card"
                  onClick={() => {
                    openCreateExam();
                    setShowMoreMenu(false);
                  }}
                >
                  <span className="scores-tool-card__icon"><Plus size={ICON_FOR_BUTTON.sm} /></span>
                  <span><strong>시험 추가</strong><small>새 시험 만들기</small></span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="scores-tool-card"
                  onClick={() => {
                    openCreateHomework();
                    setShowMoreMenu(false);
                  }}
                >
                  <span className="scores-tool-card__icon"><ClipboardList size={ICON_FOR_BUTTON.sm} /></span>
                  <span><strong>과제 추가</strong><small>새 과제 만들기</small></span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="scores-tool-card"
                  onClick={() => { void handleEnrollAll(); setShowMoreMenu(false); }}
                  disabled={enrollingAll || !hasExamsOrHomeworks}
                >
                  <span className="scores-tool-card__icon"><Users size={ICON_FOR_BUTTON.sm} /></span>
                  <span><strong>{enrollingAll ? "배정 중…" : "수강생 일괄배정"}</strong><small>누락 대상 보강</small></span>
                </button>
              </div>
            </div>
            <div className="scores-tools-menu__section">
              <span className="scores-tools-menu__label">출력 · 후속관리</span>
              <div className="scores-tools-menu__grid">
                <button type="button" role="menuitem" className="scores-tool-card" disabled={recoveryBlocked} onClick={async () => {
                  if (!await saveScoresNow()) return;
                  await refetch();
                  setShowPrintPreview(true);
                  setShowMoreMenu(false);
                }}>
                  <span className="scores-tool-card__icon" data-tone="print"><Printer size={ICON_FOR_BUTTON.sm} /></span>
                  <span><strong>성적표 출력</strong><small>교사용 전체 현황</small></span>
                </button>
                <button type="button" role="menuitem" className="scores-tool-card" disabled={recoveryBlocked} onClick={async () => {
                  if (!await saveScoresNow()) return;
                  await refetch();
                  setShowStudentReport(true);
                  setShowMoreMenu(false);
                }}>
                  <span className="scores-tool-card__icon" data-tone="student"><UserRound size={ICON_FOR_BUTTON.sm} /></span>
                  <span><strong>개인 성적표</strong><small>여러 학생 PDF</small></span>
                </button>
                {isAnonymousBillboardMode ? (
                  <button type="button" role="menuitem" className="scores-tool-card" disabled={recoveryBlocked} onClick={async () => {
                    if (!await saveScoresNow()) return;
                    await refetch();
                    setShowBillboardPreview(true);
                    setShowMoreMenu(false);
                  }}>
                    <span className="scores-tool-card__icon" data-tone="clinic"><Trophy size={ICON_FOR_BUTTON.sm} /></span>
                    <span><strong>익명 순위표</strong><small>게시용 출력</small></span>
                  </button>
                ) : (
                  <button type="button" role="menuitem" className="scores-tool-card" disabled={recoveryBlocked} onClick={async () => {
                    if (!await saveScoresNow()) return;
                    await refetch();
                    setShowClinicPreview(true);
                    setShowMoreMenu(false);
                  }}>
                    <span className="scores-tool-card__icon" data-tone="clinic"><HeartPulse size={ICON_FOR_BUTTON.sm} /></span>
                    <span><strong>클리닉 대상</strong><small>대상자 확인·출력</small></span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="scores-entry-page flex flex-col gap-3">
      <DomainListToolbar
        totalLabel={isLoading ? "…" : `총 ${displayCount}명`}
        searchSlot={
          <input
            type="search"
            className="ds-input"
            placeholder="이름 검색 (초성 검색 가능)"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            style={{ maxWidth: isMobile ? "none" : 360, width: "100%" }}
            aria-label="학생 이름 검색"
          />
        }
        filterSlot={null}
        primaryAction={
          <div className="scores-toolbar-actions">
            {primaryAction}
            <span className="scores-draft-status text-xs text-[var(--color-text-muted)]" role="status" aria-live="polite">
              {!isEditMode ? (
                draft.editLockConflict ? (
                  <>
                    <span className="text-[var(--color-error)]">다른 화면에서 수정 중</span>
                    {" "}
                    <button type="button" className="underline text-[var(--color-brand-primary)]" onClick={draft.retryRecoveryCheck}>
                      다시 확인
                    </button>
                  </>
                ) : draft.recoveryCheckFailed ? (
                  <>
                    <span className="text-[var(--color-error)]">이전 입력 확인 실패</span>
                    {" "}
                    <button type="button" className="underline text-[var(--color-brand-primary)]" onClick={draft.retryRecoveryCheck}>
                      다시 시도
                    </button>
                  </>
                ) : draft.isRecoveryCheckPending ? (
                  <span>이전 입력 확인 중…</span>
                ) : (
                  <span className="scores-lock-status">
                    <LockKeyhole size={13} aria-hidden />
                    입력 잠금됨
                  </span>
                )
              ) : (
                <>
                  {draft.draftStatus === "dirty" && "저장 대기 중…"}
                  {draft.draftStatus === "saving" && "자동 저장 중…"}
                  {draft.draftStatus === "saved" && draft.lastSavedAt != null &&
                    `저장됨 · ${Math.max(0, Math.floor((Date.now() - draft.lastSavedAt) / 1000))}초 전`}
                  {draft.draftStatus === "error" && (
                    <>
                      <span className="text-[var(--color-error)]">자동 저장 실패</span>
                      {" "}
                      <button
                        type="button"
                        className="underline text-[var(--color-brand-primary)]"
                        onClick={() => {
                          if (!draft.leaseReleaseFailed) {
                            void saveScoresNow();
                            return;
                          }
                          void (async () => {
                            setIsSaving(true);
                            const released = await releaseScoreEditLease();
                            setIsSaving(false);
                            if (released) {
                              setIsEditMode(false);
                              feedback.success("입력을 다시 잠갔습니다.");
                            }
                          })();
                        }}
                      >
                        {draft.leaseReleaseFailed ? "잠금 다시 시도" : "다시 시도"}
                      </button>
                    </>
                  )}
                  {draft.draftStatus === "idle" && <span className="text-[var(--color-text-muted)]">수정 중 · 자동 저장 준비</span>}
                  <span className="scores-shortcut-hint" aria-label="단축키: 컨트롤 S 저장, 컨트롤 Z 실행 취소">
                    Ctrl+S 저장 · Ctrl+Z 실행 취소
                  </span>
                </>
              )}
            </span>
          </div>
        }
        belowSlot={selectionBar}
      />

      {draft.hasDraftToRestore && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          role="dialog"
          aria-modal="true"
          aria-labelledby="draft-restore-title-entry"
          aria-describedby="draft-restore-description-entry"
        >
          <div
            ref={recoveryDialogRef}
            tabIndex={-1}
            className="bg-[var(--color-bg-surface)] rounded-lg shadow-lg p-6 max-w-md mx-4 border border-[var(--color-border-divider)]"
          >
            <h2 id="draft-restore-title-entry" className="text-base font-semibold text-[var(--color-text-primary)] mb-2">
              {draft.restoreChangeCount > 0
                ? `임시저장된 변경 ${draft.restoreChangeCount}건이 있습니다. 복원할까요?`
                : "이전에 임시저장된 편집 내용이 있습니다. 복원할까요?"}
            </h2>
            <p id="draft-restore-description-entry" className="text-sm text-[var(--color-text-muted)] mb-4">
              복원하면 이전 편집 내용이 테이블에 다시 적용됩니다. 버리면 현재 서버 데이터만 표시됩니다.
              <br />
              <span className="text-[11px]">※ 1시간 이상 방치된 임시저장은 다음 진입 시 자동으로 폐기됩니다.</span>
            </p>
            {draft.draftError && (
              <p className="text-sm text-[var(--color-error)] mb-3" role="alert">
                {draft.draftError}
              </p>
            )}
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                disabled={draft.isDiscardingDraft || draft.isStartingEdit}
                onClick={async () => {
                  const discarded = await draft.discardDraft();
                  if (!discarded) feedback.error("임시저장을 버리지 못했습니다. 다시 시도해 주세요.");
                }}
                className="h-9 px-4 rounded text-sm font-medium border border-[var(--color-border-divider)] bg-transparent text-[var(--color-text-muted)] hover:bg-[var(--color-bg-surface-soft)]"
              >
                {draft.isDiscardingDraft ? "버리는 중…" : "버리기"}
              </button>
              <button
                type="button"
                ref={recoveryRestoreButtonRef}
                disabled={isLoading || isError || draft.isDiscardingDraft || draft.isStartingEdit}
                onClick={async () => {
                  if (!await draft.restoreDraft()) {
                    feedback.info("성적표를 불러온 뒤 다시 복원해 주세요.");
                    return;
                  }
                  setIsEditMode(true);
                }}
                className="h-9 px-4 rounded text-sm font-medium bg-[var(--color-brand-primary)] text-white hover:opacity-90"
              >
                {draft.isStartingEdit
                  ? "복원 준비 중…"
                  : isLoading
                    ? "성적표 불러오는 중…"
                    : "복원 후 수정"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 입력 옵션 토글은 selectionBar 우측에 통합됨. */}

      {isLoading && (
        <EmptyState scope="panel" tone="loading" title="성적 불러오는 중…" />
      )}

      {!isLoading && isError && (
        <EmptyState
          scope="panel"
          tone="error"
          title="성적을 불러오지 못했습니다"
          description="네트워크 연결을 확인하고 다시 시도해 주세요."
          actions={
            <Button intent="secondary" size="sm" onClick={() => void refetch()}>
              다시 시도
            </Button>
          }
        />
      )}

      {/* ── 워크플로우 안내: 시험/과제가 없을 때 ──
          P2 (2026-05-13): 자동 등록 사실을 1단계에 흡수, 가이드와 모달 동작 정합.
          기존 2단계 "수강생 일괄배정"은 자동 등록 실패 시 보조 경로로 강등. */}
      {!isLoading && !isError && !hasExamsOrHomeworks && (
        <div className="scores-start-panel">
          <div className="scores-start-panel__head">
            <span className="scores-start-panel__kicker">Assessment</span>
            <h3 className="scores-start-panel__title">평가 항목 없음</h3>
            <p className="scores-start-panel__copy">
              이 차시에 연결된 시험이나 과제가 없습니다.
            </p>
          </div>
          <div className="scores-start-panel__actions">
            <Button
              type="button"
              intent="primary"
              size="md"
              leftIcon={<Plus size={ICON_FOR_BUTTON.md} />}
              onClick={openCreateExam}
            >
              시험 추가
            </Button>
            <Button
              type="button"
              intent="secondary"
              size="md"
              leftIcon={<Plus size={ICON_FOR_BUTTON.md} />}
              onClick={openCreateHomework}
            >
              과제 추가
            </Button>
          </div>
          <div className="scores-start-panel__cards" aria-label="성적 항목 상태">
            <div className="scores-start-panel__card">
              <ClipboardList size={18} aria-hidden />
              <span>시험</span>
              <strong>0</strong>
            </div>
            <div className="scores-start-panel__card">
              <FileText size={18} aria-hidden />
              <span>과제</span>
              <strong>0</strong>
            </div>
          </div>
        </div>
      )}

      {/* ── 안내 배너: 시험/과제는 있지만 대상자가 없을 때 ── */}
      {!isLoading && !isError && hasExamsOrHomeworks && displayCount === 0 && (
        <div className="scores-roster-warning">
          <AlertCircle size={18} aria-hidden />
          <div className="min-w-0">
            <div className="scores-roster-warning__title">
              응시·제출 대상으로 등록된 수강생이 없습니다
            </div>
            <div className="scores-roster-warning__copy">
              차시 수강생 등록 상태를 확인한 뒤 성적 도구의 수강생 일괄배정으로 보강하세요.
            </div>
          </div>
        </div>
      )}

      {!isLoading && !isError && (
        <SessionScoresPanel
          ref={setPanelHandle}
          sessionId={numericSessionId}
          lectureId={numericLectureId}
          search={searchInput}
          isEditMode={isEditMode}
          hasUnsavedChanges={isEditMode || recoveryBlocked || draft.hasPendingChanges || draft.draftStatus === "saving" || draft.draftStatus === "error"}
          onPendingChange={draft.requestAutosave}
          examEditTotal={examEditTotal}
          examEditObjective={false}
          examEditSubjective={examEditSubjective}
          homeworkEdit={homeworkEdit}
          scoreDisplayMode={scoreDisplayMode}
          scoreFormat={scoreFormat}
          viewFilter={viewFilter}
          selectedEnrollmentIds={selectedEnrollmentIds}
          onSelectionChange={setSelectedEnrollmentIds}
          onOpenExamGrading={(examId, title) => { void (async () => {
            if (recoveryBlocked) {
              feedback.info("이전 입력 복구 여부를 먼저 확인해 주세요.");
              return;
            }
            if (isEditMode) {
              if (!await saveScoresNow()) return;
              setIsSaving(true);
              const released = await draft.releaseEditLease();
              setIsSaving(false);
              if (!released) return;
              setIsEditMode(false);
            }
            setManualGradingDirty(false);
            setGradingExam({ examId, title });
          })(); }}
        />
      )}

      {/* 성적 일괄 변경 모달.
          2026-05-13 3차: onEnterConfirm + 적용 버튼 onClick 40+줄 중복 → applyBulkScore 단일화. */}
      <AdminModal
        open={showBulkScoreModal}
        onClose={() => {
          setShowBulkScoreModal(false);
          setBulkScoreValue("");
        }}
        type="action"
        width={420}
        onEnterConfirm={() => {
          if (!bulkScoreValue.trim()) return;
          applyBulkScore();
        }}
      >
        <ModalHeader title="성적 일괄 변경" />
        <ModalBody>
          <div className="flex flex-col gap-4">
            <p className="text-sm text-[var(--color-text-muted)]">
              선택한 {selectedEnrollmentIds.length}명의 성적을 일괄 변경합니다.
            </p>
            <div>
              <label className="text-sm font-medium text-[var(--color-text-primary)] mb-1 block">대상</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  className={`h-9 px-4 rounded text-sm font-medium border ${
                    bulkScoreTarget === "exam"
                      ? "bg-[var(--color-brand-primary)] text-white border-[var(--color-brand-primary)]"
                      : "bg-transparent text-[var(--color-text-secondary)] border-[var(--color-border-divider)]"
                  }`}
                  onClick={() => setBulkScoreTarget("exam")}
                >
                  시험
                </button>
                <button
                  type="button"
                  className={`h-9 px-4 rounded text-sm font-medium border ${
                    bulkScoreTarget === "homework"
                      ? "bg-[var(--color-brand-primary)] text-white border-[var(--color-brand-primary)]"
                      : "bg-transparent text-[var(--color-text-secondary)] border-[var(--color-border-divider)]"
                  }`}
                  onClick={() => setBulkScoreTarget("homework")}
                >
                  과제
                </button>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-[var(--color-text-primary)] mb-1 block" htmlFor="bulk-score-input">
                점수
              </label>
              <input
                id="bulk-score-input"
                type="number"
                min={0}
                className="ds-input"
                placeholder="점수를 입력하세요"
                value={bulkScoreValue}
                onChange={(e) => setBulkScoreValue(e.target.value)}
                style={{ maxWidth: 200 }}
                autoFocus
              />
            </div>
          </div>
        </ModalBody>
        <ModalFooter
          right={
            <>
              <Button
                intent="secondary"
                size="sm"
                onClick={() => {
                  setShowBulkScoreModal(false);
                  setBulkScoreValue("");
                }}
              >
                취소
              </Button>
              <Button
                intent="primary"
                size="sm"
                disabled={!bulkScoreValue.trim()}
                onClick={applyBulkScore}
              >
                적용
              </Button>
            </>
          }
        />
      </AdminModal>

      {/* 시험명에서 바로 여는 학생별 문항 채점표 */}
      {gradingExam && (
        <AdminModal
          open
          onClose={() => { void closeManualGrading(); }}
          type="inspect"
          width="min(1480px, calc(100vw - 32px))"
          className="scores-manual-grading-modal"
          noMinimize
        >
          <ModalHeader
            type="inspect"
            title={(
              <span className="scores-manual-grading-modal__title">
                <ClipboardCheck size={20} aria-hidden />
                {gradingExam.title} 문항별 채점
              </span>
            )}
            description="학생별 정오·부분점수를 입력합니다. 오답은 오답노트에 자동 포함되고, 맞은 문항도 복습 대상으로 표시할 수 있습니다."
            noIcon
          />
          <ModalBody>
            <div className="scores-manual-grading-modal__body">
              <Suspense
                fallback={<EmptyState scope="panel" tone="loading" title="문항별 채점표를 여는 중…" />}
              >
                <ManualExamGradingGrid
                  key={gradingExam.examId}
                  examId={gradingExam.examId}
                  showUnavailableState
                  onDirtyChange={setManualGradingDirty}
                  onApplied={() => {
                    setManualGradingDirty(false);
                    invalidateScores();
                  }}
                />
              </Suspense>
            </div>
          </ModalBody>
          <ModalFooter
            left={(
              <span className="text-xs text-[var(--color-text-muted)]">
                {manualGradingDirty ? "확정하지 않은 변경사항이 있습니다." : "현재 저장된 성적 기준"}
              </span>
            )}
            right={(
              <Button intent="secondary" size="sm" onClick={() => { void closeManualGrading(); }}>
                닫기
              </Button>
            )}
          />
        </AdminModal>
      )}

      {/* 성적표 인쇄 미리보기 */}
      {showPrintPreview && data?.meta && (
        <Suspense fallback={null}>
          <ScorePrintPreviewModal
            open={showPrintPreview}
            onClose={() => setShowPrintPreview(false)}
            rows={data.rows.filter((r) => (r.exams?.length ?? 0) > 0 || (r.homeworks?.length ?? 0) > 0)}
            meta={data.meta}
            sessionTitle={sessionTitle}
            lectureTitle={lectureTitle}
            attendanceMap={attendanceMapForPdf}
          />
        </Suspense>
      )}

      {/* 학생 개인 성적표 미리보기 */}
      {showStudentReport && data?.meta && (
        <Suspense fallback={null}>
          <StudentScoreReportModal
            open={showStudentReport}
            onClose={() => setShowStudentReport(false)}
            rows={data.rows}
            meta={data.meta}
            sessionTitle={sessionTitle}
            lectureTitle={lectureTitle}
            attendanceMap={attendanceMapForPdf}
            initialEnrollmentId={selectedEnrollmentIds.length === 1 ? selectedEnrollmentIds[0] : null}
            initialEnrollmentIds={selectedEnrollmentIds}
          />
        </Suspense>
      )}

      {/* 클리닉 대상자 미리보기 */}
      {showClinicPreview && data?.meta && (
        <Suspense fallback={null}>
          <ClinicPrintPreviewModal
            open={showClinicPreview}
            onClose={() => setShowClinicPreview(false)}
            rows={data.rows}
            meta={data.meta}
            sessionTitle={sessionTitle}
            lectureTitle={lectureTitle}
            attendanceMap={attendanceMapForPdf}
          />
        </Suspense>
      )}

      {/* 익명 성적 순위표 미리보기 */}
      {showBillboardPreview && data?.meta && (
        <Suspense fallback={null}>
          <AnonymousBillboardPreviewModal
            open={showBillboardPreview}
            onClose={() => setShowBillboardPreview(false)}
            rows={data.rows}
            meta={data.meta}
            sessionTitle={sessionTitle}
            lectureTitle={lectureTitle}
            attendanceMap={attendanceMapForPdf}
          />
        </Suspense>
      )}
    </div>
  );
}
