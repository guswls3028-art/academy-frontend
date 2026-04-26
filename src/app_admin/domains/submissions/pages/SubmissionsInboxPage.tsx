// PATH: src/app_admin/domains/submissions/pages/SubmissionsInboxPage.tsx
/**
 * Submissions Inbox (제출함)
 * - 학생이 제출한 시험/과제를 한 곳에서 확인하고 1-click 바로가기로 처리
 * - 필터 탭: 대기 중 | 완료 | 실패 | 전체
 * - 5초 자동 새로고침
 */

import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button, EmptyState, Tabs, Badge } from "@/shared/ui/ds";
import StudentNameWithLectureChip from "@/shared/ui/chips/StudentNameWithLectureChip";
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

/** API filter param corresponding to each tab */
const FILTER_PARAM: Record<FilterKey, string | undefined> = {
  pending: "pending",
  done: "done",
  failed: "failed",
  all: undefined,
};

/** Client-side fallback: which statuses belong to which tab */
const PENDING_STATUSES: Set<SubmissionStatus> = new Set([
  "submitted",
  "dispatched",
  "extracting",
  "needs_identification",
  "answers_ready",
  "grading",
]);

function clientFilter(rows: PendingSubmissionRow[], filter: FilterKey): PendingSubmissionRow[] {
  if (filter === "all") return rows;
  if (filter === "done") return rows.filter((r) => r.status === "done");
  if (filter === "failed") return rows.filter((r) => r.status === "failed");
  // pending
  return rows.filter((r) => PENDING_STATUSES.has(r.status));
}

/* ─── Helpers ─── */

function formatDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/* ─── Component ─── */

export default function SubmissionsInboxPage() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<FilterKey>("pending");

  const q = useQuery({
    queryKey: ["admin-pending-submissions", filter],
    queryFn: () => fetchPendingSubmissions(FILTER_PARAM[filter]),
    refetchInterval: 5_000,
  });

  const rows = useMemo(() => {
    const data = q.data ?? [];
    // Sort by created_at descending (newest first)
    const sorted = [...data].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
    // Apply client-side filter as fallback in case the API returns unfiltered data
    return clientFilter(sorted, filter);
  }, [q.data, filter]);

  // 식별 필요 카운트 — 배너로 강조해 운영자가 일괄 처리 동선을 인지하게.
  const needsIdentificationCount = useMemo(
    () => (q.data ?? []).filter((r) => r.status === "needs_identification").length,
    [q.data],
  );

  function handleNavigate(row: PendingSubmissionRow) {
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
      {/* 식별 필요 안내 배너 — 학생 미매칭 row가 있을 때만 노출 */}
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
              스캔/AI 업로드 후 학생 매칭이 안 된 제출입니다. 행을 열어 학생을 지정하면 자동 채점 큐에 들어갑니다.
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
            {rows.map((r) => {
              const tone = (SUBMISSION_STATUS_TONE as any)[r.status] ?? "neutral";
              const statusLabel = (SUBMISSION_STATUS_LABEL as any)[r.status] ?? r.status;
              const isExam = r.target_type === "exam";

              return (
                <div
                  key={r.id}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--color-bg-surface-soft)] transition-colors"
                >
                  {/* Student avatar + name (식별 필요 시 미식별 학생 라벨) */}
                  <StudentNameWithLectureChip
                    name={r.student_name || "미식별 학생"}
                    profilePhotoUrl={r.profile_photo_url}
                    avatarSize={32}
                    lectures={
                      r.lecture_title
                        ? [{ lectureName: r.lecture_title }]
                        : undefined
                    }
                    chipSize={16}
                  />

                  {/* Target type badge */}
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
                  >
                    {isExam ? "시" : "과"}
                  </span>

                  {/* Target title */}
                  <span className="text-sm text-[var(--color-text-primary)] truncate min-w-0 max-w-[200px]">
                    {r.target_title}
                  </span>

                  {/* Lecture title (muted) */}
                  <span className="hidden sm:inline text-xs text-[var(--color-text-muted)] truncate max-w-[120px] flex-shrink-0">
                    {r.lecture_title}
                  </span>

                  <span className="flex-1" />

                  {/* Status badge */}
                  <Badge variant="solid" tone={tone} className="flex-shrink-0">
                    {statusLabel}
                  </Badge>

                  {/* Submission time */}
                  <span className="text-xs text-[var(--color-text-muted)] flex-shrink-0 tabular-nums">
                    {formatDate(r.created_at)}
                  </span>

                  {/* Navigate button */}
                  <Button
                    type="button"
                    intent="primary"
                    size="sm"
                    onClick={() => handleNavigate(r)}
                  >
                    바로가기
                  </Button>
                </div>
              );
            })}
          </div>
        )}
    </div>
  );
}
