// PATH: src/app_admin/domains/submissions/pages/SubmissionsInboxPage.tsx
/**
 * Submissions Inbox (제출함)
 * - 학생이 제출한 시험/과제를 한 곳에서 확인하고 1-click 으로 처리
 * - 필터 탭: 대기 중 | 완료 | 실패 | 전체
 * - 5초 자동 새로고침
 *
 * 행 액션 매트릭스 (status × target_resolved):
 *   needs_identification + target_resolved        → 학생 지정 (in-place picker)
 *   needs_identification + !target_resolved       → 폐기만 가능 (원본 시험 결손)
 *   failed                                        → 재처리 / 폐기
 *   submitted/dispatched/extracting/grading       → 처리 중 (액션 없음)
 *   answers_ready / done + target_resolved         → 결과 보기 (세션 페이지 이동)
 *   answers_ready / done + !target_resolved        → 결과 진입 불가 표시
 *
 * 직접 navigate 시 lecture/session 결손 가드를 두어 SessionLayout의
 * "잘못된 세션 접근입니다." 데드락에 빠지지 않도록 한다.
 */

import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, EmptyState, Tabs, Badge } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";
import { useConfirm } from "@/shared/ui/confirm";
import StudentNameWithLectureChip from "@/shared/ui/chips/StudentNameWithLectureChip";
import StudentPickerModal from "@admin/domains/results/components/omr-review/StudentPickerModal";
import type { CandidateRow } from "@admin/domains/results/components/omr-review/omrReviewApi";
import {
  manualEditSubmissionApi,
  retrySubmissionApi,
  discardSubmissionApi,
} from "@admin/domains/materials/sheets/components/submissions/submissions.api";
import {
  SUBMISSION_STATUS_LABEL,
  SUBMISSION_STATUS_TONE,
} from "@admin/domains/submissions/statusMaps";
import {
  fetchPendingSubmissions,
  type PendingSubmissionRow,
} from "../api/adminPendingSubmissions";
import type { SubmissionStatus } from "../types";

/* ─── Filter tabs ─── */

type FilterKey = "pending" | "done" | "failed" | "all";

const FILTER_TABS: { key: FilterKey; label: string }[] = [
  { key: "pending", label: "대기 중" },
  { key: "done", label: "완료" },
  { key: "failed", label: "실패" },
  { key: "all", label: "전체" },
];

const FILTER_PARAM: Record<FilterKey, string | undefined> = {
  pending: "pending",
  done: "done",
  failed: "failed",
  all: undefined,
};

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

function clientFilter(rows: PendingSubmissionRow[], filter: FilterKey): PendingSubmissionRow[] {
  if (filter === "all") return rows;
  if (filter === "done") return rows.filter((r) => r.status === "done");
  if (filter === "failed") return rows.filter((r) => r.status === "failed");
  return rows.filter((r) => PENDING_STATUSES.has(r.status));
}

/* ─── Helpers ─── */

function formatDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function isTargetResolved(row: PendingSubmissionRow): boolean {
  if (typeof row.target_resolved === "boolean") return row.target_resolved;
  // 백엔드 신규 필드 미배포 환경 대비 fallback
  return Boolean(row.lecture_id && row.session_id && row.target_title);
}

/* ─── Component ─── */

export default function SubmissionsInboxPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [filter, setFilter] = useState<FilterKey>("pending");

  // 학생 지정 모달 — 어떤 row를 매칭 중인지 추적
  const [pickerRow, setPickerRow] = useState<PendingSubmissionRow | null>(null);
  // 409 DUPLICATE_ENROLLMENT 재시도 시 마지막에 선택한 enrollment id 보존
  const lastPickedEnrollmentRef = useRef<number | null>(null);

  const q = useQuery({
    queryKey: ["admin-pending-submissions", filter],
    queryFn: () => fetchPendingSubmissions(FILTER_PARAM[filter]),
    refetchInterval: 5_000,
  });

  const rows = useMemo(() => {
    const data = q.data ?? [];
    const sorted = [...data].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
    return clientFilter(sorted, filter);
  }, [q.data, filter]);

  const needsIdentificationCount = useMemo(
    () => (q.data ?? []).filter((r) => r.status === "needs_identification").length,
    [q.data],
  );

  const orphanCount = useMemo(
    () => (q.data ?? []).filter((r) => !isTargetResolved(r)).length,
    [q.data],
  );

  function refetchAll() {
    qc.invalidateQueries({ queryKey: ["admin-pending-submissions"] });
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
    mutationFn: (sid: number) => discardSubmissionApi(sid, "operator_discarded"),
    onSuccess: () => {
      feedback.success("답안지를 폐기했습니다.");
      refetchAll();
    },
    onError: (e: unknown) => {
      const err = e as { response?: { data?: { detail?: string } }; message?: string };
      feedback.error(err?.response?.data?.detail || err?.message || "폐기에 실패했습니다.");
    },
  });

  const identifyMut = useMutation({
    mutationFn: async (input: { sid: number; enrollmentId: number; allowDuplicate?: boolean }) => {
      return manualEditSubmissionApi({
        submissionId: input.sid,
        identifier: { enrollment_id: input.enrollmentId },
        answers: [],
        note: "inbox_quick_identify",
        allowDuplicate: input.allowDuplicate,
      });
    },
    onSuccess: () => {
      feedback.success("학생을 지정했습니다. 자동 채점이 진행됩니다.");
      setPickerRow(null);
      refetchAll();
    },
    onError: (e: unknown) => {
      const err = e as {
        response?: {
          status?: number;
          data?: { detail?: string; code?: string; conflict_submission_id?: number };
        };
        message?: string;
      };
      // 409 DUPLICATE_ENROLLMENT — 운영자에게 덮어쓰기 확인 후 재시도
      if (
        err?.response?.status === 409 &&
        err?.response?.data?.code === "DUPLICATE_ENROLLMENT" &&
        pickerRow
      ) {
        const conflictId = err.response.data.conflict_submission_id;
        const sid = pickerRow.id;
        const eid = lastPickedEnrollmentRef.current;
        confirm({
          title: "이미 매칭된 답안지가 있습니다",
          message:
            `이 학생은 이미 다른 답안지(#${conflictId ?? "?"})에 매칭돼 있습니다. ` +
            "이 답안지로 덮어쓰기 하시겠어요? (기존 답안지는 그대로 남지만 대표 답안지는 변경됩니다.)",
          confirmText: "덮어쓰기",
          cancelText: "취소",
          danger: true,
        }).then((ok) => {
          if (!ok || !eid) return;
          identifyMut.mutate({ sid, enrollmentId: eid, allowDuplicate: true });
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
        `/admin/lectures/${row.lecture_id}/sessions/${row.session_id}/exams?exam_id=${row.target_id}`,
      );
    } else {
      navigate(
        `/admin/lectures/${row.lecture_id}/sessions/${row.session_id}/assignments?homeworkId=${row.target_id}`,
      );
    }
  }

  async function handleDiscard(row: PendingSubmissionRow) {
    const ok = await confirm({
      title: "이 답안지를 폐기할까요?",
      message:
        "폐기하면 채점 대상에서 제외되고 실패 상태로 보존됩니다. 다시 채점하려면 새로 업로드해야 합니다.",
      confirmText: "폐기",
      cancelText: "취소",
      danger: true,
    });
    if (!ok) return;
    discardMut.mutate(row.id);
  }

  function handleStartIdentify(row: PendingSubmissionRow) {
    if (!row.target_id || row.target_type !== "exam") {
      feedback.error("원본 시험 정보가 없어 학생을 지정할 수 없습니다.");
      return;
    }
    lastPickedEnrollmentRef.current = null;
    setPickerRow(row);
  }

  function handlePickStudent(c: CandidateRow) {
    if (!pickerRow) return;
    lastPickedEnrollmentRef.current = c.enrollment_id;
    identifyMut.mutate({ sid: pickerRow.id, enrollmentId: c.enrollment_id });
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

  return (
    <div className="space-y-5">
      {/* 식별 필요 안내 배너 */}
      {needsIdentificationCount > 0 && (
        <div
          className="flex items-center justify-between gap-3 rounded-xl px-4 py-3 border"
          style={{
            background: "color-mix(in srgb, var(--color-warning, #f59e0b) 8%, var(--color-bg-surface))",
            borderColor: "color-mix(in srgb, var(--color-warning, #f59e0b) 24%, transparent)",
          }}
          data-testid="submissions-needs-identification-banner"
        >
          <div className="flex flex-col gap-0.5 min-w-0">
            <span className="text-sm font-bold text-[var(--color-text-primary)]">
              학생 미식별 제출 {needsIdentificationCount}건
            </span>
            <span className="text-xs text-[var(--color-text-muted)]">
              스캔/AI 업로드 후 학생 매칭이 안 된 제출입니다. 행의 <b>학생 지정</b> 버튼을 눌러 매칭하면 자동 채점 큐에 들어갑니다.
              {orphanCount > 0 && (
                <>
                  {" "}원본 시험을 찾을 수 없는 {orphanCount}건은 <b>폐기</b>로 정리하세요.
                </>
              )}
            </span>
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <Tabs
          value={filter}
          items={FILTER_TABS}
          onChange={(key) => setFilter(key as FilterKey)}
        />
        <Button type="button" intent="ghost" size="sm" onClick={() => q.refetch()}>
          새로고침
        </Button>
      </div>

      {/* Loading */}
      {q.isLoading && (
        <EmptyState scope="panel" tone="loading" title="제출 목록 불러오는 중..." />
      )}

      {/* Error */}
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

      {/* Empty */}
      {!q.isLoading && !q.isError && rows.length === 0 && (
        <EmptyState scope="panel" tone="empty" title={emptyTitle} />
      )}

      {/* Rows */}
      {!q.isLoading && rows.length > 0 && (
        <div className="rounded-xl border border-[var(--color-border-divider)] divide-y divide-[var(--color-border-divider)] bg-[var(--color-bg-surface)]">
          {rows.map((r) => (
            <SubmissionRow
              key={r.id}
              row={r}
              busy={
                (retryMut.isPending && retryMut.variables === r.id) ||
                (discardMut.isPending && discardMut.variables === r.id) ||
                (identifyMut.isPending && pickerRow?.id === r.id)
              }
              onNavigate={() => handleNavigate(r)}
              onIdentify={() => handleStartIdentify(r)}
              onRetry={() => retryMut.mutate(r.id)}
              onDiscard={() => handleDiscard(r)}
            />
          ))}
        </div>
      )}

      {/* 학생 지정 모달 */}
      {pickerRow && pickerRow.target_type === "exam" && pickerRow.target_id ? (
        <StudentPickerModal
          examId={Number(pickerRow.target_id)}
          open={true}
          onClose={() => setPickerRow(null)}
          onPick={handlePickStudent}
        />
      ) : null}
    </div>
  );
}

/* ─── Row ─── */

function SubmissionRow({
  row,
  busy,
  onNavigate,
  onIdentify,
  onRetry,
  onDiscard,
}: {
  row: PendingSubmissionRow;
  busy: boolean;
  onNavigate: () => void;
  onIdentify: () => void;
  onRetry: () => void;
  onDiscard: () => void;
}) {
  const tone = (SUBMISSION_STATUS_TONE as any)[row.status] ?? "neutral";
  const statusLabel = (SUBMISSION_STATUS_LABEL as any)[row.status] ?? row.status;
  const isExam = row.target_type === "exam";
  const resolved = isTargetResolved(row);

  const isNeedsId = row.status === "needs_identification";
  const isFailed = row.status === "failed";
  const isProcessing = PROCESSING_STATUSES.has(row.status);
  const isDone = row.status === "done";
  const isAnswersReady = row.status === "answers_ready";

  const targetTitleDisplay = row.target_title || (resolved ? "—" : "원본 시험을 찾을 수 없음");
  const lectureTitleDisplay = row.lecture_title || "";

  return (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--color-bg-surface-soft)] transition-colors">
      <StudentNameWithLectureChip
        name={row.student_name || "미식별 학생"}
        profilePhotoUrl={row.profile_photo_url}
        avatarSize={32}
        lectures={lectureTitleDisplay ? [{ lectureName: lectureTitleDisplay }] : undefined}
        chipSize={16}
      />

      <span
        className="flex-shrink-0 inline-flex items-center justify-center text-[11px] font-bold rounded w-5 h-5 leading-none"
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

      <span
        className="text-sm truncate min-w-0 max-w-[220px]"
        style={{
          color: resolved ? "var(--color-text-primary)" : "var(--color-text-muted)",
          fontStyle: resolved ? undefined : "italic",
        }}
        title={targetTitleDisplay}
      >
        {targetTitleDisplay}
      </span>

      <span className="hidden sm:inline text-xs text-[var(--color-text-muted)] truncate max-w-[120px] flex-shrink-0">
        {lectureTitleDisplay}
      </span>

      <span className="flex-1" />

      <Badge variant="solid" tone={tone} className="flex-shrink-0">
        {statusLabel}
      </Badge>

      <span className="text-xs text-[var(--color-text-muted)] flex-shrink-0 tabular-nums">
        {formatDate(row.created_at)}
      </span>

      <div className="flex items-center gap-1.5 flex-shrink-0">
        {isNeedsId && resolved && (
          <Button type="button" intent="primary" size="sm" disabled={busy} onClick={onIdentify}>
            학생 지정
          </Button>
        )}
        {isNeedsId && !resolved && (
          <Button
            type="button"
            intent="secondary"
            size="sm"
            disabled
            title="원본 시험을 찾을 수 없어 학생 매칭이 불가합니다. 폐기 후 다시 업로드해 주세요."
          >
            지정 불가
          </Button>
        )}
        {isFailed && (
          <Button type="button" intent="primary" size="sm" disabled={busy} onClick={onRetry}>
            재처리
          </Button>
        )}
        {isProcessing && (
          <span className="text-xs text-[var(--color-text-muted)] px-2">처리 중…</span>
        )}
        {(isDone || isAnswersReady) && resolved && (
          <Button type="button" intent="primary" size="sm" onClick={onNavigate}>
            결과 보기
          </Button>
        )}
        {(isDone || isAnswersReady) && !resolved && (
          <Button
            type="button"
            intent="secondary"
            size="sm"
            disabled
            title="원본 시험을 찾을 수 없어 결과 페이지로 이동할 수 없습니다."
          >
            결과 없음
          </Button>
        )}

        {(isNeedsId || isFailed || !resolved) && (
          <Button
            type="button"
            intent="ghost"
            size="sm"
            disabled={busy}
            onClick={onDiscard}
            title="이 답안지를 폐기"
          >
            폐기
          </Button>
        )}
      </div>
    </div>
  );
}
