/**
 * 시험 통계 탭 — grades API에서 시험 성적 데이터를 가져와 분석
 */
import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import EmptyState from "@student/layout/EmptyState";
import { StatCard, StatGrid } from "@student/shared/ui/components/StatCard";
import ProgressRing from "@student/shared/ui/components/ProgressRing";
import { useMyGradeRows } from "@student/domains/grades/hooks/useMyGradesSummary";
import { calculateExamStats } from "@student/domains/grades/utils/gradeStats";
import { useWrongCompletionDisplay } from "@/shared/scoring/assessmentStatusDisplay";
import styles from "./ExamStatsTab.module.css";

export default function ExamStatsTab() {
  const gradesQ = useMyGradeRows();
  const data = gradesQ.data;
  const isLoading = gradesQ.isLoading;
  const sourceExams = data?.exams;
  const wrongCompletionOnly = useWrongCompletionDisplay();
  const exams = useMemo(() => sourceExams ?? [], [sourceExams]);
  const stats = useMemo(() => calculateExamStats(exams, wrongCompletionOnly), [exams, wrongCompletionOnly]);

  // 강좌별 평균 점수
  const lectureStats = useMemo(() => {
    const map = new Map<string, { total: number; count: number }>();
    for (const e of exams) {
      if (e.total_score == null || e.max_score <= 0) continue;
      const key = e.lecture_title ?? "기타";
      const entry = map.get(key) ?? { total: 0, count: 0 };
      entry.total += (e.total_score / e.max_score) * 100;
      entry.count += 1;
      map.set(key, entry);
    }
    return Array.from(map.entries())
      .map(([name, { total, count }]) => ({
        name: name.length > 6 ? name.slice(0, 6) + "\u2026" : name,
        fullName: name,
        평균: Math.round(total / count),
      }))
      .sort((a, b) => b.평균 - a.평균);
  }, [exams]);

  if (isLoading) {
    return (
      <div className={styles.loadingStack}>
        <div className={`stu-skel ${styles.loadingSummary}`} />
        <div className={`stu-skel ${styles.loadingChart}`} />
      </div>
    );
  }

  if (gradesQ.isError) {
    return (
      <EmptyState
        title="시험 통계를 불러오지 못했습니다."
        description="시험이 없는 것으로 표시하지 않았습니다."
        onRetry={() => void gradesQ.refetch()}
      />
    );
  }

  if (!stats) {
    return <EmptyState title="시험 데이터가 없습니다." description="시험을 응시하면 통계가 표시됩니다." />;
  }

  return (
    <div className={styles.statsStack}>
      {/* 요약 */}
      <section className={styles.summaryRow} aria-label="시험 분석 요약">
        <ProgressRing
          percent={stats.avgPct ?? 0}
          label={stats.avgPct == null ? "미채점" : undefined}
          size={88}
          color={stats.avgPct == null ? "var(--stu-text-muted)" : stats.avgPct >= 70 ? "var(--stu-success)" : stats.avgPct >= 40 ? "var(--stu-warn)" : "var(--stu-danger)"}
          sublabel="평균 득점"
        />
        <div className={styles.summaryStats}>
          <StatGrid>
            <StatCard label="총 시험" value={`${stats.count}건`} />
            <StatCard label="응시완료" value={`${stats.submittedCount}건`} />
            <StatCard label={wrongCompletionOnly ? "오답 완료율" : "합격률"}
              value={stats.passRate == null ? "미판정" : `${stats.passRate}%`}
              accent={stats.passRate == null ? undefined : stats.passRate >= 70 ? "success" : "danger"} />
          </StatGrid>
        </div>
      </section>

      {/* 강좌별 성적 비교 */}
      {lectureStats.length >= 2 && (
        <div>
          <div className={styles.chartTitle}>
            강좌별 평균 득점률
          </div>
          <div className={styles.chartPanel}>
            <div className={styles.chartFrame}>
              <ResponsiveContainer width="100%" height={Math.max(120, lectureStats.length * 36)}>
                <BarChart data={lectureStats} layout="vertical" margin={{ top: 4, right: 12, bottom: 4, left: 0 }}>
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10, fill: "var(--stu-text-subtle)" }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: "var(--stu-text-muted)" }} axisLine={false} tickLine={false} width={60} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 8, border: "1px solid var(--stu-border)",
                      background: "var(--stu-surface)", fontSize: 13, padding: "6px 10px",
                    }}
                    formatter={(v) => [`${v}%`, "평균 득점률"]}
                    labelFormatter={(label, payload) => {
                      const first = payload?.[0] as { payload?: { fullName?: string } } | undefined;
                      return first?.payload?.fullName ?? label;
                    }}
                  />
                  <Bar dataKey="평균" radius={[0, 4, 4, 0]} barSize={20}>
                    {lectureStats.map((entry) => (
                      <Cell
                        key={entry.fullName}
                        fill={entry.평균 >= 70 ? "var(--stu-success)" : entry.평균 >= 40 ? "var(--stu-warn)" : "var(--stu-danger)"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
