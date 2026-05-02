// PATH: src/app_teacher/domains/results/pages/SubmissionsInboxPage.tsx
// 제출함 — 학생 제출(시험·과제) 인박스. 데스크톱 SubmissionsInboxPage 모바일 포팅.
// 5초 자동 새로고침. 카드 탭 → 세션의 시험/과제 페이지로 이동.
import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { EmptyState } from "@/shared/ui/ds";
import { Card, BackButton } from "@teacher/shared/ui/Card";
import { Badge } from "@teacher/shared/ui/Badge";
import { ChevronRight } from "@teacher/shared/ui/Icons";
import {
  fetchPendingSubmissions,
  type PendingSubmissionRow,
} from "../api/submissions";

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

export default function SubmissionsInboxPage() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<FilterKey>("pending");

  const q = useQuery({
    queryKey: ["teacher-pending-submissions", filter],
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

  const handleNavigate = (row: PendingSubmissionRow) => {
    if (row.target_type === "exam") {
      navigate(`/teacher/exams/${row.target_id}`);
    } else {
      navigate(`/teacher/homeworks/${row.target_id}`);
    }
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
            const tone = STATUS_TONE[r.status] ?? "neutral";
            const label = STATUS_LABEL[r.status] ?? r.status;
            return (
              <button
                key={r.id}
                onClick={() => handleNavigate(r)}
                className="flex items-center gap-2 rounded-xl w-full text-left cursor-pointer"
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
                  <div className="text-[13px] font-semibold truncate" style={{ color: "var(--tc-text)" }}>
                    {[
                      r.student_name?.trim() || (r.status === "needs_identification" ? "식별 대기" : "이름 미상"),
                      r.target_title?.trim() || `${isExam ? "시험" : "과제"} #${r.id}`,
                    ].join(" · ")}
                  </div>
                  <div className="flex gap-1.5 items-center text-[11px] mt-0.5" style={{ color: "var(--tc-text-muted)" }}>
                    <Badge tone={tone} size="xs">{label}</Badge>
                    {r.lecture_title && <span className="truncate">{r.lecture_title}</span>}
                    <span className="tabular-nums shrink-0 ml-auto">{formatTime(r.created_at)}</span>
                  </div>
                </div>

                <ChevronRight size={14} style={{ color: "var(--tc-text-muted)", flexShrink: 0 }} />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
