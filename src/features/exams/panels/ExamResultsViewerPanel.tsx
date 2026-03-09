/**
 * 채점·결과 탭 — 시험정책 영역과 동일한 섹션 디자인
 * - 채점결과: 실제 데이터 기반 요약 통계, 점수 분포, 커트라인
 * - 통계: 문항별 정답률 테이블, 엑셀 내보내기
 * - 학생별 결과: 기존 ExamResultsPanel (목록 + 상세)
 */

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "@/shared/api/axios";
import type { AdminExamSummary } from "@/features/results/types/results.types";
import type { AdminExamResultRow } from "@/features/results/types/results.types";
import type { QuestionStat } from "@/features/results/types/results.types";
import { useAdminExam } from "../hooks/useAdminExam";
import ExamResultsPanel from "@/features/results/panels/ExamResultsPanel";
import { Button, EmptyState } from "@/shared/ui/ds";

type Props = { examId: number };

async function fetchSummary(examId: number): Promise<AdminExamSummary | null> {
  const res = await api.get(`/results/admin/exams/${examId}/summary/`);
  return res.data as AdminExamSummary;
}

async function fetchResults(examId: number): Promise<AdminExamResultRow[]> {
  const res = await api.get(`/results/admin/exams/${examId}/results/`);
  const raw = res.data?.results ?? res.data;
  return Array.isArray(raw) ? raw : [];
}

async function fetchQuestionStats(examId: number): Promise<QuestionStat[]> {
  const res = await api.get(`/results/admin/exams/${examId}/questions/`);
  const raw = res.data?.results ?? res.data;
  return Array.isArray(raw) ? raw : raw ?? [];
}

const BUCKETS = [
  { label: "1-20", min: 1, max: 20 },
  { label: "21-40", min: 21, max: 40 },
  { label: "41-60", min: 41, max: 60 },
  { label: "61-80", min: 61, max: 80 },
  { label: "81-100", min: 81, max: 100 },
];

function computeStdDev(scores: number[]): number {
  if (scores.length === 0) return 0;
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  const sqDiffs = scores.map((s) => (s - mean) ** 2);
  return Math.sqrt(sqDiffs.reduce((a, b) => a + b, 0) / scores.length);
}

function computeTop10Avg(scores: number[]): number {
  if (scores.length === 0) return 0;
  const sorted = [...scores].sort((a, b) => b - a);
  const topCount = Math.max(1, Math.ceil(scores.length * 0.1));
  const top = sorted.slice(0, topCount);
  return top.reduce((a, b) => a + b, 0) / top.length;
}

export default function ExamResultsViewerPanel({ examId }: Props) {
  const { data: exam } = useAdminExam(examId);
  const summaryQ = useQuery({
    queryKey: ["admin-exam-summary", examId],
    queryFn: () => fetchSummary(examId),
    enabled: Number.isFinite(examId),
  });
  const resultsQ = useQuery({
    queryKey: ["admin-exam-results", examId],
    queryFn: () => fetchResults(examId),
    enabled: Number.isFinite(examId),
  });
  const statsQ = useQuery({
    queryKey: ["exam-question-stats", examId],
    queryFn: () => fetchQuestionStats(examId),
    enabled: Number.isFinite(examId),
  });

  const summary = summaryQ.data ?? null;
  const results: AdminExamResultRow[] = resultsQ.data ?? [];
  const questionStats: QuestionStat[] = statsQ.data ?? [];

  const scores = useMemo(
    () =>
      results
        .map((r) => r.final_score)
        .filter((s): s is number => typeof s === "number" && Number.isFinite(s)),
    [results]
  );
  const stdDev = useMemo(() => computeStdDev(scores), [scores]);
  const top10Avg = useMemo(() => computeTop10Avg(scores), [scores]);
  const histogram = useMemo(() => {
    return BUCKETS.map((b) => ({
      ...b,
      count: scores.filter((s) => s >= b.min && s <= b.max).length,
    }));
  }, [scores]);
  const maxHist = Math.max(1, ...histogram.map((h) => h.count));
  const passScore = exam?.pass_score ?? 0;

  const isLoading = summaryQ.isLoading || resultsQ.isLoading;
  const isError = summaryQ.isError || resultsQ.isError;
  const hasData = (summary && summary.participant_count > 0) || results.length > 0;

  if (isLoading) {
    return (
      <section className="space-y-6 rounded border border-[var(--border-divider)] bg-[var(--bg-surface)] p-5">
        <EmptyState scope="panel" tone="loading" title="채점 결과를 불러오는 중…" />
      </section>
    );
  }
  if (isError) {
    return (
      <section className="space-y-6 rounded border border-[var(--border-divider)] bg-[var(--bg-surface)] p-5">
        <EmptyState scope="panel" tone="error" title="채점 결과를 불러오지 못했습니다." />
      </section>
    );
  }

  return (
    <div className="space-y-6">
      {/* ========== 채점결과 섹션 (시험정책과 동일 디자인) ========== */}
      <section className="space-y-6 rounded border border-[var(--border-divider)] bg-[var(--bg-surface)] p-5">
        <div>
          <div className="text-lg font-semibold">채점결과</div>
          <div className="text-xs text-muted">
            실제 채점 데이터 기준 요약 통계입니다.
          </div>
        </div>

        {!hasData ? (
          <div className="rounded border border-[var(--border-divider)] bg-[var(--color-bg-surface-soft)] px-4 py-6 text-center text-sm text-[var(--color-text-muted)]">
            아직 제출·채점된 결과가 없습니다.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
              <KpiCard label="평균" value={`${(summary?.avg_score ?? 0).toFixed(1)}점`} />
              <KpiCard label="상위 10% 평균" value={`${top10Avg.toFixed(1)}점`} />
              <KpiCard label="최고점" value={`${summary?.max_score ?? 0}점`} />
              <KpiCard label="표준편차" value={stdDev.toFixed(1)} />
              <KpiCard label="응시자 수" value={`${summary?.participant_count ?? 0}명`} />
              <KpiCard label="미응시자 수" value="—" />
            </div>

            {passScore > 0 && (
              <div className="text-xs text-muted">
                커트라인: <strong className="text-[var(--color-text-primary)]">{passScore}점</strong>
                {summary != null && (
                  <> (합격 {summary.pass_count}명 / 불합격 {summary.fail_count}명)</>
                )}
              </div>
            )}

            {/* 점수 분포 히스토그램 */}
            {scores.length > 0 && (
              <div className="space-y-2">
                <div className="text-sm font-semibold text-[var(--color-text-primary)]">점수 분포</div>
                <div className="flex items-end gap-1 rounded border border-[var(--border-divider)] bg-[var(--color-bg-surface-soft)] p-3">
                  {histogram.map((h) => (
                    <div
                      key={h.label}
                      className="flex flex-1 flex-col items-center gap-1"
                      title={`${h.label}: ${h.count}명`}
                    >
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

      {/* ========== 통계 (문항별 정답률) 섹션 ========== */}
      <section className="space-y-6 rounded border border-[var(--border-divider)] bg-[var(--bg-surface)] p-5">
        <div>
          <div className="text-lg font-semibold">통계</div>
          <div className="text-xs text-muted">
            각 문항별 정답률을 실제 채점 데이터 기준으로 제공합니다.
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" intent="secondary" size="sm" disabled>
            문항별 통계 (엑셀)
          </Button>
          <Button type="button" intent="secondary" size="sm" disabled>
            학생별 틀린 문항 (엑셀)
          </Button>
          <Button type="button" intent="secondary" size="sm" disabled>
            학생별 등수 통계 (엑셀)
          </Button>
          <Button type="button" intent="secondary" size="sm" disabled>
            학생별 답안 (엑셀)
          </Button>
        </div>

        {questionStats.length === 0 ? (
          <div className="rounded border border-[var(--border-divider)] bg-[var(--color-bg-surface-soft)] px-4 py-6 text-center text-sm text-[var(--color-text-muted)]">
            문항별 통계 데이터가 없습니다. 채점이 완료된 후 표시됩니다.
          </div>
        ) : (
          <div className="overflow-x-auto rounded border border-[var(--border-divider)]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border-divider)] bg-[var(--color-bg-surface-soft)]">
                  <th className="px-3 py-2 text-left font-semibold">문항</th>
                  <th className="px-3 py-2 text-right font-semibold">정답률</th>
                  <th className="px-3 py-2 text-right font-semibold">정답 수</th>
                  <th className="px-3 py-2 text-right font-semibold">응시 수</th>
                </tr>
              </thead>
              <tbody>
                {questionStats
                  .sort((a, b) => a.question_id - b.question_id)
                  .map((q) => (
                    <tr key={q.question_id} className="border-b border-[var(--border-divider)]">
                      <td className="px-3 py-2 font-medium">{q.question_id}번</td>
                      <td className="px-3 py-2 text-right">
                        <span
                          style={{
                            color:
                              q.accuracy >= 0.8
                                ? "var(--color-success)"
                                : q.accuracy >= 0.5
                                  ? "var(--color-text-secondary)"
                                  : "var(--color-status-warning)",
                          }}
                        >
                          {(q.accuracy * 100).toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right">{q.correct}</td>
                      <td className="px-3 py-2 text-right">{q.attempts}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ========== 학생별 결과 (기존 패널) ========== */}
      <section className="space-y-6 rounded border border-[var(--border-divider)] bg-[var(--bg-surface)] p-5">
        <div>
          <div className="text-lg font-semibold">학생별 결과</div>
          <div className="text-xs text-muted">
            학생을 선택하면 상세 채점 결과를 볼 수 있습니다.
          </div>
        </div>
        <ExamResultsPanel examId={examId} />
      </section>
    </div>
  );
}

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-[var(--border-divider)] bg-[var(--color-bg-surface-soft)] px-3 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
        {label}
      </div>
      <div className="mt-1 text-base font-bold text-[var(--color-text-primary)]">{value}</div>
    </div>
  );
}
