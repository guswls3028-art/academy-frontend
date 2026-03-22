// PATH: src/features/homework/panels/HomeworkResultsPanel.tsx
/**
 * HomeworkResultsPanel — 과제 결과 (시험 채점·결과 탭과 쌍둥이 구조)
 * - 채점결과: KPI 카드, 커트라인(퍼센트/문항수), 요약
 * - 통계: 과제는 문항별 정답률 없음 → 제출/채점 요약
 * - 학생별 결과: 테이블 + 선택 시 우측 상세
 */

import { useMemo, useState } from "react";
import { useAdminHomework } from "../hooks/useAdminHomework";
import { useHomeworkPolicy } from "../hooks/useHomeworkPolicy";
import { EmptyState } from "@/shared/ui/ds";
import { fetchSessionScores, type SessionScoreHomeworkEntry } from "@/features/scores/api/sessionScores";
import StudentNameWithLectureChip from "@/shared/ui/chips/StudentNameWithLectureChip";
import { useQuery } from "@tanstack/react-query";
import { getHomeworkStatus, homeworkStatusLabel, type HomeworkStatus, type HomeworkMetaStatus } from "@/features/scores/utils/homeworkStatus";

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
  // 학생 SSOT 표시용
  profile_photo_url?: string | null;
  lecture_title?: string | null;
  lecture_color?: string | null;
  lecture_chip_label?: string | null;
  name_highlight_clinic_target?: boolean;
};

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-[var(--color-border-divider)] bg-[var(--color-bg-surface-soft)] px-3 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">{label}</div>
      <div className="mt-1 text-base font-bold text-[var(--color-text-primary)]">{value}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: HomeworkStatus }) {
  const tone =
    status === "NOT_SUBMITTED"
      ? "danger"
      : status === "SCORED" || status === "ZERO"
      ? "success"
      : "neutral";
  return (
    <span className="ds-status-badge" data-tone={tone}>
      {homeworkStatusLabel(status)}
    </span>
  );
}

export default function HomeworkResultsPanel({ homeworkId }: { homeworkId: number }) {
  const [selectedEnrollmentId, setSelectedEnrollmentId] = useState<number | null>(null);
  const { data: homework, isLoading: hwLoading } = useAdminHomework(homeworkId);
  const sessionId = useMemo(() => Number(homework?.session_id) || 0, [homework?.session_id]);
  const { data: policy } = useHomeworkPolicy(sessionId);

  const { data: scoresData, isLoading: scoresLoading } = useQuery({
    queryKey: ["session-scores", sessionId],
    queryFn: () => fetchSessionScores(sessionId),
    enabled: Number.isFinite(sessionId) && sessionId > 0,
  });

  const { rows, summary } = useMemo(() => {
    if (!scoresData?.rows || !homeworkId) return { rows: [] as HomeworkResultRow[], summary: { assigned: 0, notSubmitted: 0, graded: 0, passCount: 0, failCount: 0, clinic: 0 } };
    const rows: HomeworkResultRow[] = [];
    let notSubmitted = 0;
    let graded = 0;
    let passCount = 0;
    let failCount = 0;
    let clinic = 0;

    for (const row of scoresData.rows) {
      const hw = row.homeworks?.find((h: SessionScoreHomeworkEntry) => h.homework_id === homeworkId);
      if (!hw) continue;

      const status = getHomeworkStatus({
        score: hw.block?.score ?? null,
        metaStatus: (hw.block?.meta?.status ?? null) as HomeworkMetaStatus,
      });
      if (status === "NOT_SUBMITTED") notSubmitted++;
      if (status === "SCORED" || status === "ZERO") graded++;
      if (hw.block?.passed === true) passCount++;
      if (hw.block?.passed === false) failCount++;
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
        // 학생 SSOT 표시용 pass-through
        profile_photo_url: row.profile_photo_url,
        lecture_title: row.lecture_title,
        lecture_color: row.lecture_color,
        lecture_chip_label: (row as any).lecture_chip_label,
        name_highlight_clinic_target: row.name_highlight_clinic_target,
      });
    }

    return {
      rows,
      summary: {
        assigned: rows.length,
        notSubmitted,
        graded,
        passCount,
        failCount,
        clinic,
      },
    };
  }, [scoresData?.rows, homeworkId]);

  const selectedRow = useMemo(
    () => (selectedEnrollmentId != null ? rows.find((r) => r.enrollment_id === selectedEnrollmentId) : null),
    [rows, selectedEnrollmentId],
  );

  const scoresForHistogram = useMemo(
    () =>
      rows
        .map((r) => r.score != null && r.max_score != null && r.max_score > 0 ? (r.score / r.max_score) * 100 : null)
        .filter((s): s is number => typeof s === "number" && Number.isFinite(s)),
    [rows]
  );
  const histogram = useMemo(() => {
    const BUCKETS = [
      { label: "0-20", min: 0, max: 20 },
      { label: "21-40", min: 21, max: 40 },
      { label: "41-60", min: 41, max: 60 },
      { label: "61-80", min: 61, max: 80 },
      { label: "81-100", min: 81, max: 100 },
    ];
    return BUCKETS.map((b) => ({
      ...b,
      count: scoresForHistogram.filter((s) => s >= b.min && s <= b.max).length,
    }));
  }, [scoresForHistogram]);
  const maxHist = Math.max(1, ...histogram.map((h) => h.count));

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

  const cutlineMode = policy?.cutline_mode ?? "PERCENT";
  const cutlineValue = policy?.cutline_value ?? 80;
  const cutlineLabel = cutlineMode === "COUNT" ? `최소 ${cutlineValue}문항(점)` : `커트라인 ${cutlineValue}%`;
  const hasData = summary.assigned > 0;

  return (
    <div className="space-y-6">
      {/* ========== 채점결과 섹션 (시험과 동일 디자인) ========== */}
      <section className="space-y-6 rounded border border-[var(--color-border-divider)] bg-[var(--color-bg-surface)] p-5">
        <div>
          <div className="text-lg font-semibold">채점결과</div>
          <div className="text-xs text-[var(--color-text-muted)]">과제 제출·채점 기준 요약입니다. 커트라인은 기본설정에서 퍼센트 또는 문항 수로 설정할 수 있습니다.</div>
        </div>

        {!hasData ? (
          <div className="rounded border border-[var(--color-border-divider)] bg-[var(--color-bg-surface-soft)] px-4 py-6 text-center text-sm text-[var(--color-text-muted)]">
            이 과제에 연결된 대상자가 없거나 성적 데이터가 없습니다. 성적 탭에서 대상자를 확인하세요.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
              <KpiCard label="대상" value={`${summary.assigned}명`} />
              <KpiCard label="미제출" value={`${summary.notSubmitted}명`} />
              <KpiCard label="채점완료" value={`${summary.graded}명`} />
              <KpiCard label="합격" value={`${summary.passCount}명`} />
              <KpiCard label="불합격" value={`${summary.failCount}명`} />
              <KpiCard label="클리닉 대상" value={`${summary.clinic}명`} />
            </div>

            <div className="text-xs text-[var(--color-text-muted)]">
              커트라인: <strong className="text-[var(--color-text-primary)]">{cutlineLabel}</strong>
              {summary.graded > 0 && (
                <> (합격 {summary.passCount}명 / 불합격 {summary.failCount}명)</>
              )}
            </div>

            {scoresForHistogram.length > 0 && (
              <div className="space-y-2">
                <div className="text-sm font-semibold text-[var(--color-text-primary)]">점수 분포 (%)</div>
                <div className="flex items-end gap-1 rounded border border-[var(--color-border-divider)] bg-[var(--color-bg-surface-soft)] p-3">
                  {histogram.map((h) => (
                    <div key={h.label} className="flex flex-1 flex-col items-center gap-1" title={`${h.label}: ${h.count}명`}>
                      <div
                        className="w-full min-h-[4px] rounded-t"
                        style={{
                          height: maxHist > 0 ? `${(h.count / maxHist) * 80}px` : 0,
                          background: "var(--color-primary)",
                        }}
                      />
                      <span className="text-[10px] text-[var(--color-text-muted)]">{h.label}</span>
                      <span className="text-xs font-medium">{h.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </section>

      {/* ========== 통계 (과제는 문항별 정답률 없음) ========== */}
      <section className="space-y-6 rounded border border-[var(--color-border-divider)] bg-[var(--color-bg-surface)] p-5">
        <div>
          <div className="text-lg font-semibold">통계</div>
          <div className="text-xs text-[var(--color-text-muted)]">제출·채점 현황 요약입니다. 과제는 문항별 정답률 통계가 없습니다.</div>
        </div>
        <div className="rounded border border-[var(--color-border-divider)] bg-[var(--color-bg-surface-soft)] px-4 py-4 text-sm text-[var(--color-text-muted)]">
          제출률 {summary.assigned > 0 ? ((summary.assigned - summary.notSubmitted) / summary.assigned * 100).toFixed(1) : 0}% · 채점완료 {summary.graded}명
        </div>
      </section>

      {/* ========== 학생별 결과 ========== */}
      <section className="space-y-4 rounded border border-[var(--color-border-divider)] bg-[var(--color-bg-surface)] p-5">
        <div>
          <div className="text-lg font-semibold">학생별 결과</div>
          <div className="text-xs text-[var(--color-text-muted)]">학생을 선택하면 우측에 상세를 볼 수 있습니다. 점수 입력·미제출 처리·잠금은 세션 &gt; 성적 탭에서 진행하세요.</div>
        </div>

        <div className="flex gap-0">
          {/* Student list table */}
          <div className="min-w-0 flex-1 overflow-hidden">
            {rows.length === 0 ? (
              <div className="rounded border border-[var(--color-border-divider)] bg-[var(--color-bg-surface-soft)] px-4 py-6 text-center text-sm text-[var(--color-text-muted)]">
                이 과제에 연결된 대상자가 없거나 성적 데이터가 없습니다.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-l border border-[var(--color-border-divider)]">
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
                    {rows.map((r, idx) => {
                      const isSelected = selectedEnrollmentId === r.enrollment_id;
                      const isEven = idx % 2 === 1;
                      return (
                        <tr
                          key={r.enrollment_id}
                          className={[
                            "border-b border-[var(--color-border-divider)] cursor-pointer transition-colors",
                            isSelected
                              ? "bg-[var(--color-primary)]/10 ring-1 ring-inset ring-[var(--color-primary)]/30"
                              : isEven
                              ? "bg-[var(--color-bg-surface-soft)]/40 hover:bg-[var(--color-bg-surface-soft)]"
                              : "hover:bg-[var(--color-bg-surface-soft)]/60",
                          ].join(" ")}
                          onClick={() => setSelectedEnrollmentId((prev) => (prev === r.enrollment_id ? null : r.enrollment_id))}
                        >
                          <td className="px-3 py-2 font-medium text-[var(--color-text-primary)]">
                            <StudentNameWithLectureChip
                              name={r.student_name}
                              lectures={r.lecture_title ? [{ lectureName: r.lecture_title, color: r.lecture_color, chipLabel: r.lecture_chip_label }] : undefined}
                              profilePhotoUrl={r.profile_photo_url}
                              avatarSize={24}
                              clinicHighlight={r.name_highlight_clinic_target}
                            />
                          </td>
                          <td className="px-3 py-2">
                            <StatusBadge status={r.status} />
                          </td>
                          <td className="px-3 py-2 text-center text-[var(--color-text-primary)]">
                            {r.score != null ? `${r.score}${r.max_score != null ? ` / ${r.max_score}` : ""}` : "—"}
                          </td>
                          <td className="px-3 py-2 text-center">
                            {r.passed == null ? (
                              <span className="text-[var(--color-text-muted)]">—</span>
                            ) : (
                              <span className="ds-status-badge" data-tone={r.passed ? "success" : "danger"}>
                                {r.passed ? "합격" : "불합"}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-center">
                            {r.clinic_required ? (
                              <span className="ds-status-badge" data-tone="warning">대상</span>
                            ) : (
                              <span className="text-[var(--color-text-muted)]">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-center">
                            {r.is_locked ? (
                              <span
                                className="cursor-default text-base"
                                title={r.lock_reason ?? "잠금됨"}
                                aria-label={`잠금: ${r.lock_reason ?? "잠금됨"}`}
                              >
                                🔒
                              </span>
                            ) : (
                              <span className="text-[var(--color-text-muted)]">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Divider + detail aside */}
          {selectedRow && (
            <>
              <div className="w-px shrink-0 bg-[var(--color-border-divider)]" />
              <aside className="w-72 shrink-0 rounded-r border border-l-0 border-[var(--color-border-divider)] bg-[var(--color-bg-surface)]">
                {/* Header */}
                <div className="border-b border-[var(--color-border-divider)] bg-[var(--color-bg-surface-soft)] px-4 py-3">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">선택 학생 상세</div>
                  <div className="mt-0.5 text-base font-bold text-[var(--color-text-primary)] truncate" title={selectedRow.student_name}>
                    {selectedRow.student_name}
                  </div>
                </div>

                {/* Body */}
                <div className="p-4">
                  <dl className="space-y-3 text-sm">
                    <div>
                      <dt className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">상태</dt>
                      <dd className="mt-1">
                        <StatusBadge status={selectedRow.status} />
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">점수</dt>
                      <dd className="mt-1 font-medium text-[var(--color-text-primary)]">
                        {selectedRow.score != null
                          ? `${selectedRow.score}${selectedRow.max_score != null ? ` / ${selectedRow.max_score}` : ""}`
                          : "—"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">합불</dt>
                      <dd className="mt-1">
                        {selectedRow.passed == null ? (
                          <span className="text-[var(--color-text-muted)]">—</span>
                        ) : (
                          <span className="ds-status-badge" data-tone={selectedRow.passed ? "success" : "danger"}>
                            {selectedRow.passed ? "합격" : "불합"}
                          </span>
                        )}
                      </dd>
                    </div>
                    {selectedRow.clinic_required && (
                      <div>
                        <dt className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">클리닉</dt>
                        <dd className="mt-1">
                          <span className="ds-status-badge" data-tone="warning">대상</span>
                        </dd>
                      </div>
                    )}
                    {selectedRow.is_locked && (
                      <div>
                        <dt className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">잠금</dt>
                        <dd className="mt-1 flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
                          <span aria-hidden>🔒</span>
                          <span>{selectedRow.lock_reason || "잠금됨"}</span>
                        </dd>
                      </div>
                    )}
                  </dl>
                  <p className="mt-5 border-t border-[var(--color-border-divider)] pt-3 text-xs text-[var(--color-text-muted)]">
                    상세 입력은 세션 &gt; 성적 탭에서 진행하세요.
                  </p>
                </div>
              </aside>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
