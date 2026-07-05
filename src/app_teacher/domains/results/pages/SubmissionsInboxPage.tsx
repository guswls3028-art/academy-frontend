/* eslint-disable no-restricted-syntax */
// PATH: src/app_teacher/domains/results/pages/SubmissionsInboxPage.tsx
// 제출함 — 학생 제출(시험·과제) 인박스. 모바일 포팅.
// (inline style 은 teacher mobile 설계 통일 패턴. tc-* CSS 변수 토큰을 직접 사용)
// 5초 자동 새로고침. 카드 탭 → 세션의 시험/과제 페이지로 이동.
//
// admin 인박스 동등 매트릭스 (mobile UX):
//   needs_identification + target_resolved → tap = 시험 페이지(어드민 PC 매칭 안내)
//   needs_identification + !target_resolved → "원본 없음" 라벨 + 폐기
//   failed (real)        → 재처리
//   failed (discarded)   → "폐기됨" 라벨 (액션 없음)
//   processing           → 처리 중 라벨
//   done/answers_ready + resolved → tap = 결과
//   done/answers_ready + !resolved → "결과 없음" 라벨
//
// SessionLayout 데드락 회피: navigate 전 target_resolved 가드.
import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { EmptyState , ICON } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";
import { BackButton } from "@teacher/shared/ui/Card";
import { Badge } from "@teacher/shared/ui/Badge";
import { ChevronRight } from "@teacher/shared/ui/Icons";
import StudentNameWithLectureChip from "@/shared/ui/chips/StudentNameWithLectureChip";
import {
  fetchPendingSubmissions,
  retrySubmissionApi,
  discardSubmissionApi,
  discardSubmissionsBatchApi,
  type PendingSubmissionRow,
} from "@/shared/api/contracts/submissions";
import { teacherResultsQueryKeys } from "@teacher/domains/results/queryKeys";

type FilterKey = "pending" | "done" | "failed" | "all";

const FILTER_TABS: { key: FilterKey; label: string }[] = [
  { key: "pending", label: "대기 중" },
  { key: "done", label: "완료" },
  { key: "failed", label: "실패/폐기" },
  { key: "all", label: "전체" },
];

const FILTER_PARAM: Record<FilterKey, string | undefined> = {
  pending: "pending",
  done: "done",
  failed: "failed",
  all: undefined,
};

const PENDING_STATUSES = new Set([
  "submitted",
  "dispatched",
  "extracting",
  "needs_identification",
  "answers_ready",
  "grading",
]);

const STATUS_LABEL: Record<string, string> = {
  submitted: "업로드됨",
  dispatched: "작업 큐",
  extracting: "인식 중",
  needs_identification: "식별 필요",
  answers_ready: "답안 생성",
  grading: "채점 중",
  done: "완료",
  failed: "실패",
};

const STATUS_TONE: Record<string, "success" | "danger" | "warning" | "info" | "neutral"> = {
  submitted: "neutral",
  dispatched: "info",
  extracting: "info",
  needs_identification: "warning",
  answers_ready: "warning",
  grading: "warning",
  done: "success",
  failed: "danger",
};

const DISCARD_REASON_LABEL: Record<string, string> = {
  scan_quality: "스캔 품질",
  wrong_upload: "오업로드",
  duplicate: "중복",
  target_missing: "원본 없음",
  operator_discarded: "폐기",
  cascade_exam_deleted: "시험 삭제",
  cascade_homework_deleted: "과제 삭제",
  other: "기타",
};

function clientFilter(rows: PendingSubmissionRow[], filter: FilterKey): PendingSubmissionRow[] {
  if (filter === "all") return rows;
  if (filter === "done") return rows.filter((r) => r.status === "done");
  if (filter === "failed") return rows.filter((r) => r.status === "failed");
  return rows.filter((r) => PENDING_STATUSES.has(r.status));
}

function formatTime(iso: string) {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function isTargetResolved(row: PendingSubmissionRow): boolean {
  if (typeof row.target_resolved === "boolean") return row.target_resolved;
  return Boolean(row.lecture_id && row.session_id && row.target_title);
}

export default function SubmissionsInboxPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<FilterKey>("pending");

  const q = useQuery({
    queryKey: teacherResultsQueryKeys.pendingSubmissionsList(filter),
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

  function refetchAll() {
    qc.invalidateQueries({ queryKey: teacherResultsQueryKeys.pendingSubmissions });
  }

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

  // 원본 없는(orphan) 제출 일괄 폐기 — admin desktop의 일괄 폐기를 모바일 1-tap 패턴으로.
  const discardOrphanBatchMut = useMutation({
    mutationFn: (ids: number[]) =>
      discardSubmissionsBatchApi({ submissionIds: ids, reason: "target_missing" }),
    onSuccess: (data) => {
      const skipped = data?.skipped_count ?? 0;
      const discarded = data?.discarded ?? 0;
      if (skipped > 0) {
        feedback.success(`${discarded}건 폐기, ${skipped}건은 건너뛰었습니다.`);
      } else {
        feedback.success(`${discarded}건을 일괄 폐기했습니다.`);
      }
      refetchAll();
    },
    onError: (e: unknown) => {
      const err = e as { response?: { data?: { detail?: string } }; message?: string };
      feedback.error(err?.response?.data?.detail || err?.message || "일괄 폐기에 실패했습니다.");
    },
  });

  const orphanRows = useMemo(
    () =>
      (q.data ?? []).filter(
        (r) => !isTargetResolved(r) && !(r.status === "failed" && r.is_discarded === true),
      ),
    [q.data],
  );

  const handleDiscardAllOrphans = () => {
    const ids = orphanRows.map((r) => r.id);
    if (ids.length === 0) return;
    const ok = window.confirm(
      `원본 시험·과제가 없는 답안지 ${ids.length}건을 한 번에 폐기할까요?\n폐기된 답안지는 채점 대상에서 제외됩니다.`,
    );
    if (!ok) return;
    discardOrphanBatchMut.mutate(ids);
  };

  const handleNavigate = (row: PendingSubmissionRow) => {
    if (!isTargetResolved(row)) {
      feedback.error("원본 시험/과제 정보를 찾을 수 없어 이동할 수 없습니다.");
      return;
    }
    if (row.target_type === "exam") {
      navigate(`/teacher/exams/${row.target_id}`);
    } else {
      navigate(`/teacher/homeworks/${row.target_id}`);
    }
  };

  const handleDiscard = (row: PendingSubmissionRow) => {
    const ok = window.confirm(
      "이 답안지를 폐기할까요?\n폐기하면 채점 대상에서 제외되고, 다시 채점하려면 새로 업로드해야 합니다.",
    );
    if (!ok) return;
    discardMut.mutate(row.id);
  };

  const emptyTitle =
    filter === "pending" ? "대기 중인 제출이 없습니다."
    : filter === "done" ? "완료된 제출이 없습니다."
    : filter === "failed" ? "실패한 제출이 없습니다."
    : "제출이 없습니다.";

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center gap-2 py-0.5">
        <BackButton onClick={() => navigate(-1)} />
        <h1 className="text-[17px] font-bold flex-1" style={{ color: "var(--tc-text)" }}>제출함</h1>
      </div>

      {/* 원본 없음 일괄 폐기 배너 — 2건 이상일 때만 노출. 학원장 노동 압축. */}
      {orphanRows.length >= 2 && (
        <div
          className="flex items-center gap-2 rounded-xl"
          style={{
            padding: "10px 12px",
            background: "color-mix(in srgb, var(--tc-warning, #f59e0b) 8%, var(--tc-surface))",
            border: "1px solid color-mix(in srgb, var(--tc-warning, #f59e0b) 24%, transparent)",
          }}
        >
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-bold" style={{ color: "var(--tc-text)" }}>
              원본 없음 {orphanRows.length}건
            </div>
            <div className="text-[11px]" style={{ color: "var(--tc-text-muted)" }}>
              시험·과제가 삭제돼 매칭이 안 되는 답안지입니다. 한 번에 정리할 수 있어요.
            </div>
          </div>
          <button
            type="button"
            onClick={handleDiscardAllOrphans}
            disabled={discardOrphanBatchMut.isPending}
            className="shrink-0 px-3 py-2 rounded text-[12px] font-bold"
            style={{
              background: discardOrphanBatchMut.isPending ? "var(--tc-text-muted)" : "var(--tc-danger, #dc2626)",
              color: "#fff",
              border: "none",
              minHeight: "var(--tc-touch-min)",
              cursor: discardOrphanBatchMut.isPending ? "not-allowed" : "pointer",
            }}
          >
            {discardOrphanBatchMut.isPending ? "처리 중…" : "일괄 폐기"}
          </button>
        </div>
      )}

      {/* Filter tabs */}
      <div
        className="flex overflow-x-auto"
        style={{ borderBottom: "1px solid var(--tc-border)", WebkitOverflowScrolling: "touch" }}
      >
        {FILTER_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setFilter(t.key)}
            className="shrink-0 text-[13px] cursor-pointer"
            style={{
              padding: "12px 14px",
              minHeight: "var(--tc-touch-min)",
              background: "none",
              border: "none",
              borderBottom: filter === t.key ? "2px solid var(--tc-primary)" : "2px solid transparent",
              color: filter === t.key ? "var(--tc-primary)" : "var(--tc-text-secondary)",
              fontWeight: filter === t.key ? 700 : 500,
              whiteSpace: "nowrap",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Loading */}
      {q.isLoading && (
        <EmptyState scope="panel" tone="loading" title="제출 목록 불러오는 중…" />
      )}

      {/* Error */}
      {q.isError && !q.isLoading && (
        <EmptyState scope="panel" tone="error" title="제출 목록을 불러올 수 없습니다." />
      )}

      {/* Empty */}
      {!q.isLoading && !q.isError && rows.length === 0 && (
        <EmptyState scope="panel" tone="empty" title={emptyTitle} />
      )}

      {/* Rows */}
      {!q.isLoading && rows.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {rows.map((r) => {
            const isExam = r.target_type === "exam";
            const resolved = isTargetResolved(r);
            const isDiscardedRow = r.status === "failed" && r.is_discarded === true;

            const tone = isDiscardedRow ? "neutral" : (STATUS_TONE[r.status] ?? "neutral");
            const label = isDiscardedRow
              ? (DISCARD_REASON_LABEL[r.discard_reason || ""] ?? "폐기됨")
              : (STATUS_LABEL[r.status] ?? r.status);

            const isProcessing = ["submitted", "dispatched", "extracting", "grading"].includes(r.status);
            const isFailedReal = r.status === "failed" && !isDiscardedRow;
            const isNavigable = (r.status === "done" || r.status === "answers_ready") && resolved;

            const titleMain = r.student_name?.trim() || "이름 미상";
            const titleSub = r.target_title?.trim() || (resolved ? `${isExam ? "시험" : "과제"} #${r.id}` : (isExam ? "원본 시험 없음" : "원본 과제 없음"));

            return (
              <div
                key={r.id}
                className="flex items-center gap-2 rounded-xl"
                style={{
                  padding: "var(--tc-space-3) var(--tc-space-4)",
                  minHeight: "var(--tc-touch-min)",
                  background: "var(--tc-surface)",
                  border: "1px solid var(--tc-border)",
                }}
              >
                {/* Type tag */}
                <span
                  className="inline-flex items-center justify-center text-[10px] font-bold rounded shrink-0"
                  style={{
                    width: 22,
                    height: 22,
                    background: isExam ? "var(--tc-primary-bg)" : "var(--tc-success-bg)",
                    color: isExam ? "var(--tc-primary)" : "var(--tc-success)",
                  }}
                >
                  {isExam ? "시" : "과"}
                </span>

                <div className="flex-1 min-w-0">
                  <div
                    className="ds-text-name font-semibold"
                    style={{ color: resolved ? "var(--tc-text)" : "var(--tc-text-muted)" }}
                  >
                    <StudentNameWithLectureChip
                      name={titleMain}
                      profilePhotoUrl={r.profile_photo_url}
                      avatarSize={22}
                      chipSize={16}
                      lectures={r.lecture_title ? [{ lectureName: r.lecture_title }] : undefined}
                    />
                  </div>
                  <div className="flex gap-1.5 items-center text-[11px] mt-0.5" style={{ color: "var(--tc-text-muted)" }}>
                    <Badge tone={tone} size="xs">{label}</Badge>
                    <span className="truncate">{titleSub}</span>
                    <span className="tabular-nums shrink-0 ml-auto">{formatTime(r.created_at)}</span>
                  </div>
                </div>

                {/* 우측 액션 — 모바일 컴팩트 */}
                {isNavigable ? (
                  <button
                    type="button"
                    onClick={() => handleNavigate(r)}
                    className="shrink-0 px-2 py-1 rounded text-[12px]"
                    style={{ background: "var(--tc-primary)", color: "#fff", border: "none" }}
                  >
                    결과
                  </button>
                ) : isFailedReal ? (
                  <button
                    type="button"
                    onClick={() => retryMut.mutate(r.id)}
                    disabled={retryMut.isPending}
                    className="shrink-0 px-2 py-1 rounded text-[12px]"
                    style={{ background: "var(--tc-primary)", color: "#fff", border: "none" }}
                  >
                    재처리
                  </button>
                ) : isProcessing ? (
                  <span className="shrink-0 text-[11px]" style={{ color: "var(--tc-text-muted)" }}>처리 중…</span>
                ) : isDiscardedRow ? (
                  <span className="shrink-0 text-[11px]" style={{ color: "var(--tc-text-muted)" }}>폐기됨</span>
                ) : !resolved ? (
                  <button
                    type="button"
                    onClick={() => handleDiscard(r)}
                    disabled={discardMut.isPending}
                    className="shrink-0 px-2 py-1 rounded text-[12px]"
                    style={{ background: "transparent", color: "var(--tc-text-muted)", border: "1px solid var(--tc-border)" }}
                    title="원본 없음 — 폐기"
                  >
                    폐기
                  </button>
                ) : r.status === "needs_identification" ? (
                  <span
                    className="shrink-0 text-[11px]"
                    style={{ color: "var(--tc-text-muted)" }}
                    title="학원장(PC)에서 학생을 매칭한 후 자동 채점됩니다."
                  >
                    PC 매칭 대기
                  </span>
                ) : (
                  <ChevronRight size={ICON.xs} style={{ color: "var(--tc-text-muted)", flexShrink: 0 }} />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
