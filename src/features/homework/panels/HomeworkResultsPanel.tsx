// PATH: src/features/homework/panels/HomeworkResultsPanel.tsx
/**
 * HomeworkResultsPanel — 과제 결과 운영 (시험 결과와 대칭)
 * - 상단 요약 바: 대상 / 제출 / 미제출 / 채점완료 / 클리닉 대상
 * - 학생별 상태 테이블: 이름, 제출여부, 점수, 합불, 클리닉, 잠금
 * - 데이터: session scores API에서 해당 과제 블록만 필터
 */

import { useMemo, useState } from "react";
import { useAdminHomework } from "../hooks/useAdminHomework";
import { EmptyState } from "@/shared/ui/ds";
import { fetchSessionScores, type SessionScoreHomeworkEntry } from "@/features/scores/api/sessionScores";
import { useQuery } from "@tanstack/react-query";
import { getHomeworkStatus, homeworkStatusLabel, type HomeworkStatus } from "@/features/scores/utils/homeworkStatus";

type HomeworkResultRow = {
  enrollment_id: number;
  student_name: string;
  status: HomeworkStatus;
  score: number | null;
  max_score: number | null;
  passed: boolean | null;
  clinic_required: boolean;
  is_locked: boolean;
  lock_reason?: string | null;
};

export default function HomeworkResultsPanel({ homeworkId }: { homeworkId: number }) {
  const [selectedEnrollmentId, setSelectedEnrollmentId] = useState<number | null>(null);
  const { data: homework, isLoading: hwLoading } = useAdminHomework(homeworkId);
  const sessionId = useMemo(() => Number(homework?.session_id) || 0, [homework?.session_id]);

  const { data: scoresData, isLoading: scoresLoading } = useQuery({
    queryKey: ["session-scores", sessionId],
    queryFn: () => fetchSessionScores(sessionId),
    enabled: Number.isFinite(sessionId) && sessionId > 0,
  });

  const { rows, summary } = useMemo(() => {
    if (!scoresData?.rows || !homeworkId) return { rows: [] as HomeworkResultRow[], summary: { assigned: 0, notSubmitted: 0, graded: 0, clinic: 0 } };
    const rows: HomeworkResultRow[] = [];
    let notSubmitted = 0;
    let graded = 0;
    let clinic = 0;

    for (const row of scoresData.rows) {
      const hw = row.homeworks?.find((h: SessionScoreHomeworkEntry) => h.homework_id === homeworkId);
      if (!hw) continue;

      const status = getHomeworkStatus({
        score: hw.block?.score ?? null,
        metaStatus: hw.block?.meta?.status ?? null,
      });
      if (status === "NOT_SUBMITTED") notSubmitted++;
      if (status === "SCORED" || status === "ZERO") graded++;
      if (hw.block?.clinic_required) clinic++;

      rows.push({
        enrollment_id: row.enrollment_id,
        student_name: row.student_name ?? "-",
        status,
        score: hw.block?.score ?? null,
        max_score: hw.block?.max_score ?? null,
        passed: hw.block?.passed ?? null,
        clinic_required: hw.block?.clinic_required ?? false,
        is_locked: hw.block?.is_locked ?? false,
        lock_reason: hw.block?.lock_reason ?? null,
      });
    }

    return {
      rows,
      summary: {
        assigned: rows.length,
        notSubmitted,
        graded,
        clinic,
      },
    };
  }, [scoresData?.rows, homeworkId]);

  const selectedRow = useMemo(
    () => (selectedEnrollmentId != null ? rows.find((r) => r.enrollment_id === selectedEnrollmentId) : null),
    [rows, selectedEnrollmentId],
  );

  if (!Number.isFinite(homeworkId) || homeworkId <= 0) {
    return <EmptyState scope="panel" tone="error" title="과제 ID가 올바르지 않습니다." />;
  }

  if (hwLoading) {
    return <EmptyState scope="panel" tone="loading" title="과제 정보 불러오는 중…" />;
  }

  if (!homework) {
    return <EmptyState scope="panel" tone="error" title="과제를 불러오지 못했습니다." />;
  }

  if (scoresLoading) {
    return <EmptyState scope="panel" tone="loading" title="성적 불러오는 중…" />;
  }

  return (
    <div className="flex gap-4">
      <div className="min-w-0 flex-1 space-y-6">
      {/* 상단 요약 바 */}
      <section className="rounded-lg border border-[var(--color-border-divider)] bg-[var(--color-bg-surface)] p-4">
        <div className="mb-2 text-sm font-semibold text-[var(--color-text-primary)]">과제 결과 요약</div>
        <div className="flex flex-wrap gap-4 text-sm">
          <span className="text-[var(--color-text-muted)]">대상 <b className="text-[var(--color-text-primary)]">{summary.assigned}</b>명</span>
          <span className="text-[var(--color-text-muted)]">미제출 <b className="text-[var(--color-text-primary)]">{summary.notSubmitted}</b>명</span>
          <span className="text-[var(--color-text-muted)]">채점완료 <b className="text-[var(--color-text-primary)]">{summary.graded}</b>명</span>
          <span className="text-[var(--color-text-muted)]">클리닉 대상 <b className="text-[var(--color-text-primary)]">{summary.clinic}</b>명</span>
        </div>
      </section>

      {/* 학생별 상태 테이블 */}
      <section className="rounded-lg border border-[var(--color-border-divider)] bg-[var(--color-bg-surface)] overflow-hidden">
        <div className="border-b border-[var(--color-border-divider)] px-4 py-3">
          <div className="text-sm font-semibold text-[var(--color-text-primary)]">학생별 상태</div>
          <div className="text-xs text-[var(--color-text-muted)]">대상 여부, 제출 여부, 점수, 합불, 클리닉, 잠금</div>
        </div>
        {rows.length === 0 ? (
          <div className="p-6 text-center text-sm text-[var(--color-text-muted)]">
            이 과제에 연결된 대상자가 없거나 성적 데이터가 없습니다. 성적 탭에서 대상자를 확인하세요.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border-divider)] bg-[var(--color-bg-surface-soft)]">
                  <th className="px-3 py-2 text-left font-medium text-[var(--color-text-secondary)]">이름</th>
                  <th className="px-3 py-2 text-left font-medium text-[var(--color-text-secondary)]">상태</th>
                  <th className="px-3 py-2 text-center font-medium text-[var(--color-text-secondary)]">점수</th>
                  <th className="px-3 py-2 text-center font-medium text-[var(--color-text-secondary)]">합불</th>
                  <th className="px-3 py-2 text-center font-medium text-[var(--color-text-secondary)]">클리닉</th>
                  <th className="px-3 py-2 text-center font-medium text-[var(--color-text-secondary)]">잠금</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.enrollment_id}
                    className={`border-b border-[var(--color-border-divider)] cursor-pointer ${selectedEnrollmentId === r.enrollment_id ? "bg-[var(--color-bg-surface-soft)]" : "hover:bg-[var(--color-bg-surface-soft)]/60"}`}
                    onClick={() => setSelectedEnrollmentId((prev) => (prev === r.enrollment_id ? null : r.enrollment_id))}
                  >
                    <td className="px-3 py-2 font-medium text-[var(--color-text-primary)]">{r.student_name}</td>
                    <td className="px-3 py-2">
                      <span
                        className="inline-flex rounded px-2 py-0.5 text-xs font-medium"
                        style={{
                          background: r.status === "NOT_SUBMITTED" ? "var(--color-danger-subtle, #fef2f2)" : "var(--color-bg-surface-soft)",
                          color: r.status === "NOT_SUBMITTED" ? "var(--color-danger, #b91c1c)" : "var(--color-text-primary)",
                        }}
                      >
                        {homeworkStatusLabel(r.status)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center text-[var(--color-text-primary)]">
                      {r.score != null ? `${r.score}${r.max_score != null ? ` / ${r.max_score}` : ""}` : "—"}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {r.passed == null ? "—" : (
                        <span className={r.passed ? "text-[var(--color-success)]" : "text-[var(--color-danger)]"}>
                          {r.passed ? "합격" : "불합"}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {r.clinic_required ? (
                        <span className="text-[var(--color-warning)] font-medium">대상</span>
                      ) : "—"}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {r.is_locked ? (
                        <span className="text-xs text-[var(--color-text-muted)]" title={r.lock_reason ?? ""}>잠금</span>
                      ) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="text-xs text-[var(--color-text-muted)]">
        점수 입력·미제출 처리·잠금은 <b>세션 &gt; 성적</b> 탭에서 진행하세요.
      </p>
      </div>

      {/* 우측 상세 패널 — 선택 학생 요약 */}
      {selectedRow && (
        <aside className="w-72 shrink-0 rounded-lg border border-[var(--color-border-divider)] bg-[var(--color-bg-surface)] p-4">
          <div className="mb-3 text-sm font-semibold text-[var(--color-text-primary)]">선택 학생 상세</div>
          <dl className="space-y-2 text-sm">
            <div>
              <dt className="text-[var(--color-text-muted)]">이름</dt>
              <dd className="font-medium text-[var(--color-text-primary)]">{selectedRow.student_name}</dd>
            </div>
            <div>
              <dt className="text-[var(--color-text-muted)]">상태</dt>
              <dd>
                <span
                  className="inline-flex rounded px-2 py-0.5 text-xs font-medium"
                  style={{
                    background: selectedRow.status === "NOT_SUBMITTED" ? "var(--color-danger-subtle, #fef2f2)" : "var(--color-bg-surface-soft)",
                    color: selectedRow.status === "NOT_SUBMITTED" ? "var(--color-danger, #b91c1c)" : "var(--color-text-primary)",
                  }}
                >
                  {homeworkStatusLabel(selectedRow.status)}
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-[var(--color-text-muted)]">점수</dt>
              <dd className="text-[var(--color-text-primary)]">
                {selectedRow.score != null ? `${selectedRow.score}${selectedRow.max_score != null ? ` / ${selectedRow.max_score}` : ""}` : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--color-text-muted)]">합불</dt>
              <dd>
                {selectedRow.passed == null ? "—" : (
                  <span className={selectedRow.passed ? "text-[var(--color-success)]" : "text-[var(--color-danger)]"}>
                    {selectedRow.passed ? "합격" : "불합"}
                  </span>
                )}
              </dd>
            </div>
            {selectedRow.clinic_required && (
              <div>
                <dt className="text-[var(--color-text-muted)]">클리닉</dt>
                <dd className="text-[var(--color-warning)] font-medium">대상</dd>
              </div>
            )}
            {selectedRow.is_locked && (
              <div>
                <dt className="text-[var(--color-text-muted)]">잠금</dt>
                <dd className="text-xs text-[var(--color-text-muted)]">{selectedRow.lock_reason || "잠금됨"}</dd>
              </div>
            )}
          </dl>
          <p className="mt-4 text-xs text-[var(--color-text-muted)]">
            상세 입력은 세션 &gt; 성적 탭에서 진행하세요.
          </p>
        </aside>
      )}
    </div>
  );
}
