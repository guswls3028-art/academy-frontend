// PATH: src/app_admin/domains/submissions/pages/SubmissionsInboxPage.tsx
/**
 * Submissions Inbox (제출함)
 * - 학생이 제출한 시험/과제를 한 곳에서 확인하고 1-click 으로 처리
 * - 필터 탭: 대기 중 | 완료 | 실패 | 전체
 * - 5초 자동 새로고침
 *
 * 행 액션 매트릭스 (status × target_resolved):
 *   needs_identification + target_resolved        → 학생 지정 (in-place picker, exam/homework 양쪽)
 *   needs_identification + !target_resolved       → 폐기만 가능 (원본 결손)
 *   failed                                        → 재처리 / 폐기
 *   submitted/dispatched/extracting/grading       → 처리 중 (액션 없음)
 *   answers_ready / done + target_resolved         → 결과 보기 (세션 페이지 이동)
 *   answers_ready / done + !target_resolved        → 결과 진입 불가 표시
 *   superseded                                     → 대체됨 (terminal, action 없음)
 *
 * 일괄 처리:
 *   row 별 체크박스 + 상단 일괄 폐기 (사유 picker 모달).
 *
 * 직접 navigate 시 lecture/session 결손 가드 → SessionLayout "잘못된 세션 접근" 회피.
 */

import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileSearch } from "lucide-react";
import { Button, EmptyState, Tabs, Badge, ICON_FOR_BUTTON } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";
import { useConfirm } from "@/shared/ui/confirm";
import { submissionsQueryKeys } from "@/shared/api/queryKeys/submissions";
import { invalidateSubmissionResultCaches } from "@admin/domains/results/public/omrReview";
import StudentNameWithLectureChip from "@/shared/ui/chips/StudentNameWithLectureChip";
import StudentPickerModal from "@admin/domains/results/components/omr-review/StudentPickerModal";
import { confirmAbsenceResume, isResumableAbsenceConflict } from "@admin/domains/results/components/omr-review/absenceResume";
import {
  fetchExamCandidates,
  fetchHomeworkCandidates,
  type CandidateRow,
} from "@admin/domains/results/components/omr-review/omrReviewApi";
import {
  manualEditSubmissionApi,
  retrySubmissionApi,
  discardSubmissionApi,
  discardSubmissionsBatchApi,
  type DiscardReason,
} from "@admin/domains/materials/sheets/components/submissions/submissions.api";
import {
  SUBMISSION_STATUS_LABEL,
  SUBMISSION_STATUS_TONE,
  formatSubmissionDate,
} from "@admin/domains/submissions/statusMaps";
import {
  fetchPendingSubmissionPage,
  type PendingSubmissionRow,
} from "@/shared/api/contracts/submissions";
import SubmissionInboxPager from "@/shared/ui/submissions/SubmissionInboxPager";
import DiscardReasonModal from "../components/DiscardReasonModal";
import SubmissionPreviewModal, {
  submissionFileKind,
  submissionFileName,
  submissionFileSize,
} from "../components/SubmissionPreviewModal";
import type { SubmissionStatus } from "../types";

const OmrReviewWorkspace = lazy(
  () => import("@admin/domains/results/public/OmrReviewWorkspace"),
);

/* ─── Filter tabs ─── */

type FilterKey = "pending" | "done" | "failed" | "all";

/** "실패" 탭 안의 sub filter — 폐기/실제실패 분리 */
type FailedSubFilter = "all" | "real_failed" | "discarded";

const FILTER_TABS: { key: FilterKey; label: string }[] = [
  { key: "pending", label: "대기 중" },
  { key: "done", label: "완료" },
  { key: "failed", label: "실패/폐기" },
  { key: "all", label: "전체" },
];

const PENDING_STATUSES: Set<SubmissionStatus> = new Set([
  "submitted",
  "dispatched",
  "extracting",
  "needs_identification",
  "answers_ready",
  "grading",
]);

const PROCESSING_STATUSES: Set<SubmissionStatus> = new Set([
  "submitted",
  "dispatched",
  "extracting",
  "grading",
]);

function clientFilter(
  rows: PendingSubmissionRow[],
  filter: FilterKey,
  failedSub: FailedSubFilter,
): PendingSubmissionRow[] {
  if (filter === "all") return rows;
  if (filter === "done") return rows.filter((r) => r.status === "done" || r.status === "superseded");
  if (filter === "failed") {
    const fails = rows.filter((r) => r.status === "failed");
    if (failedSub === "real_failed") return fails.filter((r) => !r.is_discarded);
    if (failedSub === "discarded") return fails.filter((r) => r.is_discarded);
    return fails;
  }
  return rows.filter((r) => PENDING_STATUSES.has(r.status));
}

/* ─── Helpers ─── */

function isTargetResolved(row: PendingSubmissionRow): boolean {
  return row.target_resolved === true;
}

const CONFIGURATION_MISSING = new Set(["answer_key", "sheet", "grading_configuration"]);
const CONFIGURATION_REASON = "문항·정답 설정을 확인해야 하므로 채점이 대기 중입니다.";

function examSetupPath(row: PendingSubmissionRow, recovery: { action?: string; exam_id?: number } | null | undefined): string | undefined {
  if (row.target_type !== "exam" || !isTargetResolved(row) || !row.lecture_id || !row.session_id
    || recovery?.action !== "configure_exam" || recovery.exam_id !== row.target_id) return undefined;
  return `/workspace/lectures/${row.lecture_id}/sessions/${row.session_id}/exams?exam_id=${row.target_id}&examTab=setup`;
}

const DISCARD_REASON_LABEL: Record<string, string> = {
  scan_quality: "스캔 품질",
  wrong_upload: "오업로드",
  duplicate: "중복",
  target_missing: "원본 없음",
  operator_discarded: "운영자 폐기",
  cascade_exam_deleted: "시험 삭제",
  cascade_homework_deleted: "과제 삭제",
  other: "기타",
};

function discardReasonLabel(reason: string | null | undefined): string {
  if (!reason) return "폐기";
  return DISCARD_REASON_LABEL[reason] ?? reason;
}

function orphanReasonLabel(row: PendingSubmissionRow): string {
  if (row.target_resolved_reason === "session_missing") {
    return row.target_type === "exam"
      ? "원본 시험에 차시가 매칭되지 않습니다."
      : "원본 과제의 차시 정보가 없습니다.";
  }
  // target_missing 또는 미정 — 본체 자체 결손
  return row.target_type === "exam"
    ? "원본 시험을 찾을 수 없습니다 (삭제되었거나 다른 학원 소속)."
    : "원본 과제를 찾을 수 없습니다 (삭제되었거나 다른 학원 소속).";
}

/* ─── Component ─── */

export default function SubmissionsInboxPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [searchParams, setSearchParams] = useSearchParams();
  const rawFilter = searchParams.get("filter");
  const filter: FilterKey = rawFilter === "all" || rawFilter === "done" || rawFilter === "failed" ? rawFilter : "pending";
  const rawFailed = searchParams.get("failed_type");
  const failedSub: FailedSubFilter = rawFailed === "real_failed" || rawFailed === "discarded" ? rawFailed : "all";
  const rawPage = Number(searchParams.get("page") || 1);
  const page = Number.isSafeInteger(rawPage) && rawPage > 0 && rawPage <= 1_000_000 ? rawPage : 1;

  const [pickerRow, setPickerRow] = useState<PendingSubmissionRow | null>(null);
  const [previewRow, setPreviewRow] = useState<PendingSubmissionRow | null>(null);
  const [reviewRow, setReviewRow] = useState<PendingSubmissionRow | null>(null);
  const [identificationNotice, setIdentificationNotice] = useState<{
    row: PendingSubmissionRow;
    message: string;
    canReview: boolean;
    resultPath?: string;
    actionLabel?: string;
  } | null>(null);

  // 일괄 선택 — id Set
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // 폐기 사유 모달 상태
  const [discardModal, setDiscardModal] = useState<
    | { kind: "single"; row: PendingSubmissionRow }
    | { kind: "batch"; ids: number[] }
    | null
  >(null);

  const q = useQuery({
    queryKey: submissionsQueryKeys.adminPendingList(filter, failedSub, page),
    queryFn: () => fetchPendingSubmissionPage(filter, page, failedSub),
    refetchInterval: pickerRow || previewRow || reviewRow || discardModal ? false : 5_000,
  });

  useEffect(() => {
    if (q.isError || !q.data || q.data.page === page) return;
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous);
      next.set("page", String(q.data.page));
      return next;
    }, { replace: true });
  }, [q.data, q.isError, page, setSearchParams]);

  const rows = useMemo(() => {
    const data = q.isError ? [] : q.data?.results ?? [];
    const sorted = [...data].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime() || b.id - a.id,
    );
    return clientFilter(sorted, filter, failedSub);
  }, [q.data, q.isError, filter, failedSub]);

  // failed 탭에서 sub-filter 카운트
  const failedCounts = useMemo(() => {
    const summary = q.isError ? undefined : q.data?.summary;
    return {
      total: summary?.failed ?? 0,
      real: summary?.real_failed ?? 0,
      discarded: summary?.discarded ?? 0,
    };
  }, [q.data, q.isError]);

  const needsIdentificationCount = useMemo(
    () => rows.filter((r) => r.status === "needs_identification").length,
    [rows],
  );

  const orphanCount = useMemo(
    () => rows.filter((r) => !isTargetResolved(r)).length,
    [rows],
  );

  // 일괄 선택 가능한 row 만 토글 가능 (선택은 폐기 가능 row 만 — 이미 폐기된 row 제외)
  const isSelectable = (row: PendingSubmissionRow): boolean => {
    if (row.is_discarded) return false; // 중복 폐기 방지
    const resolved = isTargetResolved(row);
    return row.status === "needs_identification" || row.status === "failed" || !resolved;
  };
  const selectedCurrentIds = rows.filter((row) => selectedIds.has(row.id) && isSelectable(row)).map((row) => row.id);

  // 필터 변경 시 선택 초기화
  function handleFilterChange(key: FilterKey) {
    changePage(1, key, "all");
  }

  function changePage(nextPage: number, nextFilter = filter, nextFailed = failedSub) {
    setSelectedIds(new Set());
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous);
      next.set("page", String(nextPage));
      next.set("filter", nextFilter);
      if (nextFilter === "failed" && nextFailed !== "all") next.set("failed_type", nextFailed);
      else next.delete("failed_type");
      return next;
    });
  }

  function refetchAll() {
    qc.invalidateQueries({ queryKey: submissionsQueryKeys.adminPending });
  }

  function refreshAssignmentResults(row: PendingSubmissionRow) {
    refetchAll();
    qc.invalidateQueries({ queryKey: submissionsQueryKeys.adminSubmissions });
    invalidateSubmissionResultCaches(qc, {
      submissionId: row.id,
      examId: row.target_type === "exam" ? row.target_id : undefined,
    });
  }

  /* ── Mutations ── */

  const retryMut = useMutation({
    mutationFn: (sid: number) => retrySubmissionApi(sid),
    onSuccess: () => {
      feedback.success("재처리를 시작했습니다.");
      refetchAll();
    },
    onError: (e: unknown) => {
      const err = e as { response?: { data?: { detail?: string } }; message?: string };
      feedback.error(err?.response?.data?.detail || err?.message || "재처리에 실패했습니다.");
    },
  });

  const discardMut = useMutation({
    mutationFn: (input: { sid: number; reason: DiscardReason }) =>
      discardSubmissionApi(input.sid, input.reason),
    onSuccess: () => {
      feedback.success("답안지를 폐기했습니다.");
      setDiscardModal(null);
      refetchAll();
    },
    onError: (e: unknown) => {
      const err = e as { response?: { data?: { detail?: string } }; message?: string };
      feedback.error(err?.response?.data?.detail || err?.message || "폐기에 실패했습니다.");
    },
  });

  const discardBatchMut = useMutation({
    mutationFn: (input: { ids: number[]; reason: DiscardReason }) =>
      discardSubmissionsBatchApi({ submissionIds: input.ids, reason: input.reason }),
    onSuccess: (data) => {
      const skipped = data.skipped_count ?? 0;
      const discarded = data.discarded ?? 0;
      if (skipped > 0) {
        feedback.success(`${discarded}건 폐기, ${skipped}건은 처리 불가 상태라 건너뛰었습니다.`);
      } else {
        feedback.success(`${discarded}건 폐기 완료.`);
      }
      setDiscardModal(null);
      setSelectedIds(new Set());
      refetchAll();
    },
    onError: (e: unknown) => {
      const err = e as { response?: { data?: { detail?: string } }; message?: string };
      feedback.error(err?.response?.data?.detail || err?.message || "일괄 폐기에 실패했습니다.");
    },
  });

  const identifyMut = useMutation({
    mutationFn: async (input: { row: PendingSubmissionRow; enrollmentId: number; allowDuplicate?: boolean; resumeAbsence?: boolean }) => {
      return manualEditSubmissionApi({
        submissionId: input.row.id,
        identifier: { enrollment_id: input.enrollmentId },
        answers: [],
        note: input.resumeAbsence ? "inbox_resume_absence" : "inbox_quick_identify",
        allowDuplicate: input.allowDuplicate,
        resumeAbsence: input.resumeAbsence,
      });
    },
    onSuccess: async (result, input) => {
      if (!input.resumeAbsence && result.can_resume_absence && await confirmAbsenceResume(confirm)) {
        return identifyMut.mutate({ ...input, resumeAbsence: true });
      }
      if (
        result.code === "OMR_GRADING_CONFIGURATION_REQUIRED"
        && result.recovery?.action === "configure_exam"
        && result.recovery.exam_id === input.row.target_id
        && input.row.target_type === "exam" && isTargetResolved(input.row)
        && input.row.lecture_id && input.row.session_id
      ) {
        setIdentificationNotice({
          row: input.row,
          message: `학생 지정은 저장됐습니다. ${CONFIGURATION_REASON} 설정을 완료하면 보관된 답안을 다시 채점할 수 있습니다.`,
          canReview: false,
          resultPath: `/workspace/lectures/${input.row.lecture_id}/sessions/${input.row.session_id}/exams?exam_id=${input.row.target_id}&examTab=setup`,
          actionLabel: "문항·정답 설정",
        });
        setPickerRow((current) => current?.id === input.row.id ? null : current);
        refreshAssignmentResults(input.row);
        return;
      }
      const message = result.absence_preserved
        ? "학생 지정은 저장됐지만 이 학생은 결시 상태라 점수에 반영하지 않았습니다."
        : result.absence_resumed && result.projection_ready === false
          ? "결시를 해제하고 객관식을 채점했습니다. 서술형 점수는 채점표에서 입력해 주세요."
        : result.graded === true && result.projection_ready !== false
        ? "학생 지정과 채점이 완료됐습니다. 결과를 확인해 주세요."
        : result.projection_ready === false
          ? "학생 지정은 저장됐습니다. 아직 성적 반영이 끝나지 않았습니다. 답안을 검토해 주세요."
          : result.graded !== false && ["submitted", "dispatched", "extracting", "grading", "processing"].includes(result.status ?? "")
            ? "학생 지정은 저장됐습니다. 답안 처리 중이며 완료 후 결과를 확인할 수 있습니다."
            : "학생 지정은 저장됐습니다. 채점 전 확인이 필요합니다. 답안을 검토해 주세요.";
      const canReview = !["submitted", "dispatched", "extracting", "grading", "processing"].includes(result.status ?? "");
      setIdentificationNotice({ row: input.row, message, canReview });
      feedback.info(message);
      setPickerRow((current) => current?.id === input.row.id ? null : current);
      refreshAssignmentResults(input.row);
    },
    onError: (e: unknown, input) => {
      const err = e as {
        response?: {
          status?: number;
          data?: {
            detail?: string;
            code?: string;
            conflict_submission_id?: number;
            recovery?: { action?: string; exam_id?: number; enrollment_id?: number };
          };
        };
        message?: string;
      };
      const recovery = err.response?.data?.recovery;
      const setupPath = examSetupPath(input.row, recovery);
      if (err.response?.status === 409 && err.response.data?.code === "OMR_GRADING_CONFIGURATION_CONFLICT" && setupPath) {
        setIdentificationNotice({
          row: input.row,
          message: "문항·정답 설정을 먼저 확인해 주세요. 이번 변경은 저장되지 않았으며 기존 답안과 성적은 유지됩니다.",
          canReview: false,
          resultPath: setupPath,
          actionLabel: "문항·정답 설정",
        });
        setPickerRow((current) => current?.id === input.row.id ? null : current);
        refreshAssignmentResults(input.row);
        return;
      }
      if (isResumableAbsenceConflict(e) && !input.resumeAbsence && recovery?.enrollment_id === input.enrollmentId) {
        void confirmAbsenceResume(confirm).then((ok) => ok && identifyMut.mutate({ ...input, resumeAbsence: true }));
        return;
      }
      if (
        err.response?.status === 409 && err.response.data?.code === "OMR_ATTEMPT_CONFLICT"
        && recovery?.action === "review_existing_result"
        && input.row.target_type === "exam" && isTargetResolved(input.row)
        && recovery.exam_id === input.row.target_id && recovery.enrollment_id === input.enrollmentId
        && input.row.lecture_id && input.row.session_id
      ) {
        setIdentificationNotice({
          row: input.row,
          message: "기존 성적·미응시 판정과 충돌해 배정하지 않았습니다. 기존 성적에서 답안을 확인하고 미리보기 후 확정한 다음, 제출함에서 다시 배정해 주세요.",
          canReview: false,
          resultPath: `/workspace/lectures/${input.row.lecture_id}/sessions/${input.row.session_id}/exams?exam_id=${input.row.target_id}&examTab=results&enrollmentId=${input.enrollmentId}`,
        });
        setPickerRow((current) => current?.id === input.row.id ? null : current);
        return;
      }
      if (
        err?.response?.status === 409 &&
        err?.response?.data?.code === "DUPLICATE_ENROLLMENT"
      ) {
        const conflictId = err.response.data.conflict_submission_id;
        confirm({
          title: "이미 매칭된 답안지가 있습니다",
          message:
            `이 학생은 이미 다른 답안지(#${conflictId ?? "?"})에 매칭돼 있습니다. ` +
            "이 답안지로 덮어쓰기 하시겠어요? (기존 답안지는 그대로 남지만 대표 답안지는 변경됩니다.)",
          confirmText: "덮어쓰기",
          cancelText: "취소",
          danger: true,
        }).then((ok) => {
          if (!ok) return;
          identifyMut.mutate({ ...input, allowDuplicate: true });
        });
        return;
      }
      feedback.error(err?.response?.data?.detail || err?.message || "학생 지정에 실패했습니다.");
    },
  });

  /* ── Handlers ── */

  function handleNavigate(row: PendingSubmissionRow) {
    if (!isTargetResolved(row) || !row.lecture_id || !row.session_id || !row.target_id) {
      feedback.error("원본 시험/과제 정보를 찾을 수 없어 이동할 수 없습니다. 폐기 후 다시 업로드해 주세요.");
      return;
    }
    if (row.target_type === "exam") {
      navigate(
        `/workspace/lectures/${row.lecture_id}/sessions/${row.session_id}/exams?exam_id=${row.target_id}`,
      );
    } else {
      navigate(
        `/workspace/lectures/${row.lecture_id}/sessions/${row.session_id}/assignments?homeworkId=${row.target_id}`,
      );
    }
  }

  function handleAskDiscard(row: PendingSubmissionRow) {
    // orphan 인 경우 default 사유를 target_missing 으로
    const initialReason: DiscardReason | undefined = !isTargetResolved(row) ? "target_missing" : undefined;
    setDiscardModal({ kind: "single", row });
    // store last default in modal local state via key
    void initialReason; // noop — modal reads defaultReason via prop below
  }

  function handleAskBatchDiscard() {
    if (selectedCurrentIds.length === 0) return;
    setDiscardModal({ kind: "batch", ids: selectedCurrentIds });
  }

  function handleDiscardConfirm(reason: DiscardReason) {
    if (!discardModal) return;
    if (discardModal.kind === "single") {
      discardMut.mutate({ sid: discardModal.row.id, reason });
    } else {
      discardBatchMut.mutate({ ids: discardModal.ids, reason });
    }
  }

  function handleStartIdentify(row: PendingSubmissionRow) {
    if (!row.target_id) {
      feedback.error("원본 시험/과제 정보가 없어 학생을 지정할 수 없습니다.");
      return;
    }
    setIdentificationNotice(null);
    setPickerRow(row);
  }

  function handlePickStudent(c: CandidateRow) {
    if (!pickerRow) return;
    if (identifyMut.isPending) return;
    identifyMut.mutate({ row: pickerRow, enrollmentId: c.enrollment_id });
  }

  function toggleSelect(rowId: number) {
    setSelectedIds((prev) => {
      const n = new Set(prev);
      if (n.has(rowId)) n.delete(rowId);
      else n.add(rowId);
      return n;
    });
  }

  function handleSelectAllVisible() {
    const ids = rows.filter(isSelectable).map((r) => r.id);
    if (ids.every((id) => selectedIds.has(id)) && ids.length > 0) {
      // 모두 선택된 상태 → 해제
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(ids));
    }
  }

  /* ── UI ── */

  const emptyTitle =
    filter === "pending"
      ? "대기 중인 제출이 없습니다."
      : filter === "done"
        ? "완료된 제출이 없습니다."
        : filter === "failed"
          ? "실패한 제출이 없습니다."
          : "제출이 없습니다.";

  const visibleSelectableIds = rows.filter(isSelectable).map((r) => r.id);
  const allVisibleSelected =
    visibleSelectableIds.length > 0 && visibleSelectableIds.every((id) => selectedIds.has(id));

  // picker fetcher 분기 (exam vs homework)
  const pickerFetcher = pickerRow
    ? pickerRow.target_type === "exam"
      ? (q: string) => fetchExamCandidates(Number(pickerRow.target_id), q)
      : (q: string) => fetchHomeworkCandidates(Number(pickerRow.target_id), q)
    : undefined;

  // 폐기 모달의 기본 사유 (orphan 이면 target_missing)
  const discardDefaultReason: DiscardReason | undefined =
    discardModal?.kind === "single" && !isTargetResolved(discardModal.row)
      ? "target_missing"
      : undefined;
  const discardCount = discardModal?.kind === "batch" ? discardModal.ids.length : 1;

  return (
    <div className="space-y-5">
      <p className="text-sm leading-relaxed text-[var(--color-text-muted)]">
        대기 중인 제출은 모두 표시합니다. 완료·실패·폐기는 최근 24시간에 접수된 제출만 표시합니다.
      </p>
      {identificationNotice && (
        <div role="status" className="flex flex-wrap items-center gap-3 rounded-xl border border-[var(--color-border-divider)] bg-[var(--color-bg-surface)] p-4" data-testid="submission-identification-result">
          <p className="min-w-0 flex-1 text-sm">{identificationNotice.message}</p>
          {identificationNotice.resultPath && <Link to={identificationNotice.resultPath} className="text-sm font-semibold text-[var(--color-primary)] underline underline-offset-4">{identificationNotice.actionLabel ?? "기존 성적 확인·정정"}</Link>}
          {identificationNotice.canReview && identificationNotice.row.target_type === "exam" && (
            <Button type="button" intent="secondary" size="sm" onClick={() => setReviewRow(identificationNotice.row)}>답안 검토·복구</Button>
          )}
          <Button type="button" intent="ghost" size="sm" onClick={() => setIdentificationNotice(null)}>안내 닫기</Button>
        </div>
      )}
      {/* 식별 필요 안내 배너 */}
      {needsIdentificationCount > 0 && (
        <div
          className="flex items-center justify-between gap-3 rounded-xl px-4 py-3 border"
          // eslint-disable-next-line no-restricted-syntax
          style={{
            background: "color-mix(in srgb, var(--color-warning, #f59e0b) 8%, var(--color-bg-surface))",
            borderColor: "color-mix(in srgb, var(--color-warning, #f59e0b) 24%, transparent)",
          }}
          data-testid="submissions-needs-identification-banner"
        >
          <div className="flex flex-col gap-0.5 min-w-0">
            <span className="text-sm font-bold text-[var(--color-text-primary)]">
              이 페이지의 학생 미식별 제출 {needsIdentificationCount}건
            </span>
            <span className="text-xs text-[var(--color-text-muted)]">
              제출물을 확인한 뒤 학생을 지정하세요. 지정 후에도 확인이 필요한 시험 답안은 <b>답안 검토·복구</b>에서 검토하고 저장할 수 있습니다.
              {orphanCount > 0 && (
                <>
                  {" "}원본 시험/과제를 찾을 수 없는 {orphanCount}건은 <b>일괄 폐기</b>로 정리하세요.
                </>
              )}
            </span>
          </div>
        </div>
      )}

      {/* Filter tabs + 일괄 액션 바 */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <Tabs
          value={filter}
          items={FILTER_TABS}
          onChange={(key) => {
            handleFilterChange(key as FilterKey);
          }}
        />
        <div className="flex items-center gap-2">
          {selectedCurrentIds.length > 0 && (
            <>
              <span className="text-xs text-[var(--color-text-muted)]">
                {selectedCurrentIds.length}건 선택됨
              </span>
              <Button
                type="button"
                intent="danger"
                size="sm"
                disabled={discardBatchMut.isPending}
                onClick={handleAskBatchDiscard}
              >
                일괄 폐기
              </Button>
              <Button type="button" intent="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>
                선택 해제
              </Button>
            </>
          )}
          <Button type="button" intent="ghost" size="sm" onClick={() => q.refetch()}>
            새로고침
          </Button>
        </div>
      </div>

      {/* failed 탭 sub-filter — 폐기/실제실패 분리 */}
      {filter === "failed" && failedCounts.total > 0 && (
        <div className="flex items-center gap-1 text-xs">
          <span className="text-[var(--color-text-muted)] mr-2">분류:</span>
          {([
            { key: "all", label: `전체 ${failedCounts.total}` },
            { key: "real_failed", label: `실패 ${failedCounts.real}` },
            { key: "discarded", label: `폐기됨 ${failedCounts.discarded}` },
          ] as { key: FailedSubFilter; label: string }[]).map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => changePage(1, filter, opt.key)}
              className={`px-2.5 py-1 rounded-full border ${
                failedSub === opt.key
                  ? "bg-[var(--color-bg-surface-soft)] border-[var(--color-border-strong)] text-[var(--color-text-primary)] font-bold"
                  : "border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}

      {!q.isError && q.data && (
        <SubmissionInboxPager data={q.data} onPage={changePage} disabled={!!pickerRow || !!previewRow || !!discardModal} />
      )}

      {q.isLoading && (
        <EmptyState scope="panel" tone="loading" title="제출 목록 불러오는 중..." />
      )}

      {q.isError && !q.isLoading && (
        <EmptyState
          scope="panel"
          tone="error"
          title="제출 목록을 불러올 수 없습니다."
          description="잠시 후 다시 시도해 주세요."
          actions={
            <Button type="button" intent="secondary" size="sm" onClick={() => q.refetch()}>
              다시 시도
            </Button>
          }
        />
      )}

      {!q.isLoading && !q.isError && rows.length === 0 && (
        <EmptyState scope="panel" tone="empty" title={emptyTitle} />
      )}

      {!q.isLoading && !q.isError && rows.length > 0 && (
        <div className="rounded-xl border border-[var(--color-border-divider)] bg-[var(--color-bg-surface)] overflow-hidden">
          {/* 헤더 — 일괄 선택 체크박스 */}
          <div className="flex items-center gap-3 px-4 py-2 border-b border-[var(--color-border-divider)] text-xs text-[var(--color-text-muted)]">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={allVisibleSelected}
                onChange={handleSelectAllVisible}
                disabled={visibleSelectableIds.length === 0}
                aria-label="모두 선택"
              />
              <span>이 페이지에서 폐기 가능한 항목 모두 선택</span>
            </label>
          </div>

          <div className="divide-y divide-[var(--color-border-divider)]">
            {rows.map((r) => (
              <SubmissionRow
                key={r.id}
                row={r}
                selected={selectedIds.has(r.id)}
                selectable={isSelectable(r)}
                busy={
                  (retryMut.isPending && retryMut.variables === r.id) ||
                  (discardMut.isPending && discardMut.variables?.sid === r.id) ||
                  (identifyMut.isPending && identifyMut.variables?.row.id === r.id)
                }
                onToggleSelect={() => toggleSelect(r.id)}
                onPreview={() => setPreviewRow(r)}
                onNavigate={() => handleNavigate(r)}
                onIdentify={() => handleStartIdentify(r)}
                onReview={() => setReviewRow(r)}
                onRetry={() => retryMut.mutate(r.id)}
                onDiscard={() => handleAskDiscard(r)}
              />
            ))}
          </div>
        </div>
      )}

      {/* 제출물 확인 후 학생 지정 */}
      <SubmissionPreviewModal
        open={!!previewRow}
        row={previewRow}
        onClose={() => setPreviewRow(null)}
        onIdentify={() => {
          const row = previewRow;
          setPreviewRow(null);
          if (row) handleStartIdentify(row);
        }}
      />

      {/* 학생 지정 모달 */}
      {pickerRow && pickerFetcher && (
        <StudentPickerModal
          open={true}
          fetchCandidates={pickerFetcher}
          contextLabel={pickerRow.target_type === "exam" ? "응시 대상" : "수강생"}
          onClose={() => setPickerRow(null)}
          onPick={handlePickStudent}
        />
      )}

      {/* 폐기 사유 모달 */}
      {reviewRow && (
        <Suspense fallback={<div role="status">답안 검토 화면을 불러오는 중입니다.</div>}>
          <OmrReviewWorkspace
            open
            examId={reviewRow.target_id}
            examTitle={reviewRow.target_title}
            initialSubmissionId={reviewRow.id}
            exactInitialSelection
            onClose={() => {
              refreshAssignmentResults(reviewRow);
              setReviewRow(null);
              setIdentificationNotice(null);
            }}
          />
        </Suspense>
      )}
      <DiscardReasonModal
        open={!!discardModal}
        count={discardCount}
        defaultReason={discardDefaultReason}
        onClose={() => setDiscardModal(null)}
        onConfirm={handleDiscardConfirm}
      />
    </div>
  );
}

/* ─── Row ─── */

function SubmissionRow({
  row,
  selected,
  selectable,
  busy,
  onToggleSelect,
  onPreview,
  onNavigate,
  onIdentify,
  onReview,
  onRetry,
  onDiscard,
}: {
  row: PendingSubmissionRow;
  selected: boolean;
  selectable: boolean;
  busy: boolean;
  onToggleSelect: () => void;
  onPreview: () => void;
  onNavigate: () => void;
  onIdentify: () => void;
  onReview: () => void;
  onRetry: () => void;
  onDiscard: () => void;
}) {
  // 폐기된 row 는 status badge 와 tone 을 별도로 (실제 실패와 시각 분리).
  const isExam = row.target_type === "exam";
  const resolved = isTargetResolved(row);
  const isDiscardedRow = row.status === "failed" && row.is_discarded === true;
  const tone = isDiscardedRow
    ? "neutral"
    : (SUBMISSION_STATUS_TONE as Record<string, "success" | "danger" | "warning" | "primary" | "neutral">)[row.status] ?? "neutral";
  const statusLabel = isDiscardedRow
    ? discardReasonLabel(row.discard_reason)
    : (SUBMISSION_STATUS_LABEL as Record<string, string>)[row.status] ?? row.status;

  const isNeedsId = row.status === "needs_identification";
  const isFailedReal = row.status === "failed" && !isDiscardedRow;
  const isProcessing = PROCESSING_STATUSES.has(row.status);
  const isDone = row.status === "done";
  const isAnswersReady = row.status === "answers_ready";
  const isSuperseded = row.status === "superseded";
  const setupPath = !isDiscardedRow && !isSuperseded && !isProcessing
    && row.omr_readiness?.can_grade === false
    && row.omr_readiness.missing.some((reason) => CONFIGURATION_MISSING.has(reason))
    ? examSetupPath(row, row.recovery) : undefined;
  const hasFile = row.has_file === true;
  const fileName = submissionFileName(row.file_name);
  const fileMeta = hasFile
    ? `${submissionFileKind(row.file_type, row.file_name)} · ${submissionFileSize(row.file_size)}`
    : "파일 정보 없음";

  // exam/homework 양쪽 picker 지원 — target_id 만 있으면 inline 매칭 가능
  const canIdentifyInline = !!row.target_id;

  const orphanReason = !resolved ? orphanReasonLabel(row) : "";
  const targetTitleDisplay = row.target_title || (resolved ? "—" : orphanReason || "원본을 찾을 수 없음");
  const lectureTitleDisplay = row.lecture_title || "";

  return (
    <div data-testid={`submission-inbox-${row.id}`} className="flex flex-wrap items-center gap-2 px-4 py-3 hover:bg-[var(--color-bg-surface-soft)] transition-colors sm:flex-nowrap sm:gap-3">
      {/* 일괄 선택 체크박스 */}
      <input
        type="checkbox"
        checked={selected}
        disabled={!selectable}
        onChange={onToggleSelect}
        title={selectable ? "선택" : "이 상태는 일괄 폐기 대상이 아닙니다."}
        aria-label="row 선택"
        className="flex-shrink-0"
      />

      <StudentNameWithLectureChip
        className="min-w-0 max-w-full flex-[1_1_150px] sm:flex-none"
        name={row.student_name || "미식별 학생"}
        profilePhotoUrl={row.profile_photo_url}
        avatarSize={32}
        lectures={lectureTitleDisplay ? [{ lectureName: lectureTitleDisplay }] : undefined}
        chipSize={16}
      />

      <span
        className="flex-shrink-0 inline-flex items-center justify-center text-[11px] font-bold rounded w-5 h-5 leading-none"
        // eslint-disable-next-line no-restricted-syntax
        style={{
          background: isExam
            ? "var(--color-primary-bg, #eff6ff)"
            : "var(--color-success-bg, #f0fdf4)",
          color: isExam
            ? "var(--color-primary, #3b82f6)"
            : "var(--color-success, #22c55e)",
        }}
        title={isExam ? "시험" : "과제"}
      >
        {isExam ? "시" : "과"}
      </span>

      <div className="min-w-0 flex-[1_1_190px] max-w-full sm:max-w-[320px]">
        <p
          className="truncate text-sm"
          // eslint-disable-next-line no-restricted-syntax
          style={{
            color: resolved ? "var(--color-text-primary)" : "var(--color-text-muted)",
            fontStyle: resolved ? undefined : "italic",
          }}
          title={resolved ? row.target_title : orphanReason}
        >
          {targetTitleDisplay}
        </p>
        {setupPath && (
          <p className="mt-1 text-xs text-[var(--color-text-secondary)]" data-testid={`submission-readiness-${row.id}`}>
            {CONFIGURATION_REASON}
          </p>
        )}
        <p
          className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-[var(--color-text-muted)]"
          data-testid={`submission-file-meta-${row.id}`}
          title={hasFile ? `${fileName} · ${fileMeta}` : fileMeta}
        >
          <FileSearch size={ICON_FOR_BUTTON.sm} className="shrink-0" aria-hidden />
          <span className="truncate">{hasFile ? fileName : fileMeta}</span>
          {hasFile && <span className="shrink-0">· {fileMeta}</span>}
        </p>
      </div>

      <span className="hidden flex-1 sm:block" />

      <Badge variant="solid" tone={tone} className="flex-shrink-0">
        {setupPath ? "설정 확인 필요" : statusLabel}
      </Badge>

      <span className="text-xs text-[var(--color-text-muted)] flex-shrink-0 tabular-nums">
        {formatSubmissionDate(row.created_at)}
      </span>

      <div className="ml-auto flex flex-wrap items-center justify-end gap-1.5 flex-shrink-0">
        {setupPath && (
          <Link to={setupPath} className="rounded px-2 py-1.5 text-sm font-medium text-[var(--color-primary)] underline underline-offset-2" data-testid={`submission-setup-${row.id}`}>
            문항·정답 설정
          </Link>
        )}
        {isExam && resolved && !isProcessing && !isSuperseded && !isDiscardedRow && (row.source === "omr_scan" || row.source === "omr_manual" || row.source === "scan") && (
          <Button type="button" intent="secondary" size="sm" disabled={busy} onClick={onReview} data-testid={`submission-review-${row.id}`}>답안 검토·복구</Button>
        )}
        {hasFile && (
          <Button
            type="button"
            intent={isNeedsId ? "primary" : "secondary"}
            size="sm"
            disabled={busy}
            onClick={onPreview}
            leftIcon={<FileSearch size={ICON_FOR_BUTTON.sm} />}
            className="shrink-0"
            data-testid={`submission-preview-${row.id}`}
          >
            제출물 확인
          </Button>
        )}
        {isNeedsId && resolved && canIdentifyInline && !hasFile && (
          <Button type="button" intent="primary" size="sm" disabled={busy} onClick={onIdentify} className="shrink-0">
            학생 지정
          </Button>
        )}
        {isNeedsId && !resolved && (
          <Button
            type="button"
            intent="secondary"
            size="sm"
            disabled
            title={orphanReason}
            className="shrink-0"
          >
            지정 불가
          </Button>
        )}
        {isFailedReal && (
          <Button type="button" intent="primary" size="sm" disabled={busy} onClick={onRetry} className="shrink-0">
            재처리
          </Button>
        )}
        {isDiscardedRow && (
          <span className="text-xs text-[var(--color-text-muted)] px-2" title="이미 폐기된 답안지입니다.">
            폐기됨
          </span>
        )}
        {isProcessing && (
          <span className="text-xs text-[var(--color-text-muted)] px-2">처리 중…</span>
        )}
        {isSuperseded && (
          <span className="text-xs text-[var(--color-text-muted)] px-2" title="다른 제출이 최종 답안으로 채택되었습니다.">
            대체됨
          </span>
        )}
        {(isDone || isAnswersReady) && resolved && !setupPath && (
          <Button type="button" intent="primary" size="sm" onClick={onNavigate} className="shrink-0">
            결과 보기
          </Button>
        )}
        {(isDone || isAnswersReady) && !resolved && (
          <Button
            type="button"
            intent="secondary"
            size="sm"
            disabled
            title={orphanReason}
            className="shrink-0"
          >
            결과 없음
          </Button>
        )}

        {/* 폐기 버튼은 이미 discarded 된 row 에는 안 보임 — 중복 폐기 방지 */}
        {!isDiscardedRow && (isNeedsId || isFailedReal || !resolved) && (
          <Button
            type="button"
            intent="ghost"
            size="sm"
            disabled={busy}
            onClick={onDiscard}
            title="이 답안지를 폐기"
            className="shrink-0"
          >
            폐기
          </Button>
        )}
      </div>
    </div>
  );
}
