/**
 * 성적 통계 탭 — StatCard 그리드 + 추이 차트 + 과제 진행바
 * GradesPage에서 추출.
 */
import { useMemo } from "react";
import { StatCard, StatGrid } from "@student/shared/ui/components/StatCard";
import ProgressRing from "@student/shared/ui/components/ProgressRing";
import type { StudentExamTrendPoint } from "@/shared/api/contracts/studentGrades";
import StudentScoreTrendChart from "@/shared/ui/assessment/StudentScoreTrendChart";
import type { MyExamGradeSummary, MyGradesAnalytics, MyHomeworkGradeSummary } from "../api/grades.api";
import styles from "./GradesStatsTab.module.css";

type Props = {
  exams: MyExamGradeSummary[];
  homeworks: MyHomeworkGradeSummary[];
  examTrend: StudentExamTrendPoint[];
  analytics?: MyGradesAnalytics;
  analyticsLoading?: boolean;
  analyticsError?: boolean;
};

type TrendDatum = {
  name: string;
  득점률: number;
  전체평균?: number;
};

export default function GradesStatsTab({ exams, homeworks, examTrend, analytics, analyticsLoading, analyticsError }: Props) {
  const examStats = useMemo(() => {
    if (exams.length === 0) return null;
    const scoredExams = exams.filter((e) => e.total_score != null);
    const avgPct = scoredExams.length > 0
      ? scoredExams.reduce((s, e) => s + (e.max_score > 0 ? ((e.total_score ?? 0) / e.max_score) * 100 : 0), 0) / scoredExams.length
      : 0;
    // 합격률 정책: "성취" 기준. achievement가 내려오면 PASS+REMEDIATED를 합격으로,
    // FAIL을 불합격으로 집계. 미응시/미판정은 분모에서 제외.
    // 백엔드가 achievement를 안 내려주는 구서버 환경에선 is_pass로 폴백.
    let passCount = 0;
    let judgedCount = 0;
    for (const e of exams) {
      if (e.achievement) {
        if (e.achievement === "PASS" || e.achievement === "REMEDIATED") {
          passCount += 1;
          judgedCount += 1;
        } else if (e.achievement === "FAIL") {
          judgedCount += 1;
        }
      } else if (e.is_pass !== null) {
        judgedCount += 1;
        if (e.is_pass) passCount += 1;
      }
    }
    const passRate = judgedCount > 0 ? (passCount / judgedCount) * 100 : 0;
    const rankedExams = exams.filter((e) => e.rank != null && e.cohort_size != null && e.cohort_size > 1 && e.meta_status !== "NOT_SUBMITTED");
    const avgRank = rankedExams.length > 0
      ? Math.round((rankedExams.reduce((s, e) => s + e.rank!, 0) / rankedExams.length) * 10) / 10
      : null;
    return { avgPct: Math.round(avgPct), passRate: Math.round(passRate), count: exams.length, avgRank };
  }, [exams]);

  const hwStats = useMemo(() => {
    if (homeworks.length === 0) return null;
    const graded = homeworks.filter((h) => h.score != null);
    const passed = graded.filter((h) => h.passed).length;
    const withMax = graded.filter((h) => h.max_score != null && h.max_score > 0);
    const avgPct = withMax.length > 0
      ? Math.round(withMax.reduce((s, h) => s + (h.score! / h.max_score!) * 100, 0) / withMax.length)
      : null;
    const passRate = graded.length > 0 ? Math.round((passed / graded.length) * 100) : 0;
    return { passed, failed: graded.length - passed, graded: graded.length, total: homeworks.length, avgPct, passRate };
  }, [homeworks]);

  const rankInsight = useMemo(() => {
    const ranked = exams.filter((e) => e.rank != null && e.cohort_size != null && e.cohort_size > 1 && e.meta_status !== "NOT_SUBMITTED");
    if (ranked.length === 0) return null;
    const topQuartile = ranked.filter((e) => e.percentile != null && e.percentile <= 25).length;
    const midRange = ranked.filter((e) => e.percentile != null && e.percentile > 25 && e.percentile <= 75).length;
    const bottom = ranked.length - topQuartile - midRange;
    const bestExam = [...ranked].sort((a, b) => (a.percentile ?? 100) - (b.percentile ?? 100))[0];
    const worstExam = [...ranked].sort((a, b) => (b.percentile ?? 0) - (a.percentile ?? 0))[0];
    return { topQuartile, midRange, bottom, bestExam, worstExam };
  }, [exams]);

  const weakestLecture = useMemo(() => {
    const byLecture = new Map<string, { total: number; pass: number; scores: number[] }>();
    for (const e of exams) {
      if (!e.lecture_title || e.total_score == null) continue;
      const key = e.lecture_title;
      if (!byLecture.has(key)) byLecture.set(key, { total: 0, pass: 0, scores: [] });
      const entry = byLecture.get(key)!;
      entry.total++;
      if (e.is_pass) entry.pass++;
      entry.scores.push(e.max_score > 0 ? (e.total_score / e.max_score) * 100 : 0);
    }
    if (byLecture.size < 2) return null;
    const lectureStats = Array.from(byLecture.entries())
      .map(([name, d]) => ({
        name: name.length > 8 ? name.slice(0, 8) + "\u2026" : name,
        avg: Math.round(d.scores.reduce((s, v) => s + v, 0) / d.scores.length),
        passRate: Math.round((d.pass / d.total) * 100),
      }))
      .sort((a, b) => a.avg - b.avg);
    const weakest = lectureStats[0];
    return weakest && weakest.avg < 70 ? weakest : null;
  }, [exams]);

  const homeworkPassPct = hwStats && hwStats.total > 0 ? (hwStats.passed / hwStats.total) * 100 : 0;
  const homeworkFailPct = hwStats && hwStats.total > 0 ? (hwStats.failed / hwStats.total) * 100 : 0;

  return (
    <div className={styles.stack}>
      <StudentScoreTrendChart points={examTrend} audience="learner" />

      <AnalyticsOverview
        analytics={analytics}
        loading={analyticsLoading}
        error={analyticsError}
      />

      {/* 시험 통계 요약 */}
      {examStats && (
        <div>
          <div className={styles.sectionTitle}>시험 성적 요약</div>
          <div className={styles.examSummary}>
            <ProgressRing
              percent={examStats.avgPct}
              size={88}
              color={examStats.avgPct >= 70 ? "var(--stu-success)" : examStats.avgPct >= 40 ? "var(--stu-warn)" : "var(--stu-danger)"}
              sublabel="평균"
            />
            <div className={styles.summaryStats}>
              <StatGrid>
                <StatCard label="합격률" value={`${examStats.passRate}%`} accent={examStats.passRate >= 70 ? "success" : examStats.passRate > 0 ? "danger" : undefined} />
                <StatCard label="시험 수" value={`${examStats.count}건`} />
                {examStats.avgRank != null
                  ? <StatCard label="평균 등수" value={`${examStats.avgRank}등`} />
                  : <StatCard label="응시완료" value={`${exams.filter((e) => e.total_score != null).length}건`} />
                }
              </StatGrid>
            </div>
          </div>
        </div>
      )}

      {/* 시험 석차 & 위치 요약 */}
      {examStats && rankInsight && (
          <div>
            <div className={styles.sectionTitle}>내 위치 분석</div>
            <StatGrid>
              <StatCard label="상위권" value={`${rankInsight.topQuartile}회`} accent="success" />
              <StatCard label="중위권" value={`${rankInsight.midRange}회`} />
              <StatCard label="하위권" value={`${rankInsight.bottom}회`} accent={rankInsight.bottom > 0 ? "danger" : undefined} />
            </StatGrid>
            <div className={styles.rankNotes}>
              {rankInsight.bestExam && (
                <div>
                  <span className={styles.bestLabel}>최고 성적</span>{" "}
                  {rankInsight.bestExam.title} — {rankInsight.bestExam.rank}등/{rankInsight.bestExam.cohort_size}명
                </div>
              )}
              {rankInsight.worstExam && rankInsight.worstExam.exam_id !== rankInsight.bestExam?.exam_id && (
                <div>
                  <span className={styles.worstLabel}>보완 필요</span>{" "}
                  {rankInsight.worstExam.title} — {rankInsight.worstExam.rank}등/{rankInsight.worstExam.cohort_size}명
                </div>
              )}
            </div>
          </div>
      )}

      {/* 강좌별 성적 분석 */}
      {weakestLecture && (
          <div className={styles.weaknessCard}>
            <div className={styles.sectionTitle}>약점 강좌</div>
            <div className={styles.weaknessText}>
              <span className={styles.weaknessEmphasis}>{weakestLecture.name}</span> 강좌의
              평균 득점률이 <strong className={styles.weaknessEmphasis}>{weakestLecture.avg}%</strong>로 가장 낮습니다.
              {weakestLecture.passRate < 50 && ` 합격률도 ${weakestLecture.passRate}%입니다.`}
            </div>
          </div>
      )}

      {/* 과제 현황 통계 */}
      {hwStats && (
        <div>
          <div className={styles.sectionTitle}>과제 현황</div>
          <StatGrid>
            <StatCard label="채점 완료" value={`${hwStats.graded}/${hwStats.total}건`} />
            <StatCard label="평균 득점률" value={hwStats.avgPct != null ? `${hwStats.avgPct}%` : "-"} />
            <StatCard label="합격률" value={`${hwStats.passRate}%`} accent={hwStats.passRate >= 70 ? "success" : hwStats.passRate > 0 ? "danger" : undefined} />
          </StatGrid>

          {hwStats.total > 0 && (
            <svg
              className={styles.homeworkBar}
              viewBox="0 0 100 8"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <rect width="100" height="8" fill="var(--stu-surface-soft)" rx="4" />
              <rect className={styles.homeworkFill} width={homeworkPassPct} height="8" fill="var(--stu-success)" rx="4" />
              <rect className={styles.homeworkFill} x={homeworkPassPct} width={homeworkFailPct} height="8" fill="var(--stu-danger)" rx="4" />
            </svg>
          )}
        </div>
      )}
    </div>
  );
}

function AnalyticsOverview({
  analytics,
  loading,
  error,
}: {
  analytics?: MyGradesAnalytics;
  loading?: boolean;
  error?: boolean;
}) {
  if (loading) {
    return (
      <div className={styles.analyticsPanel}>
        <div className={styles.analyticsHeader}>
          <span>성적 비교</span>
          <span className={styles.analyticsMeta}>전체 평균과 비교</span>
        </div>
        <div className={styles.analyticsSkeletonGrid}>
          <div />
          <div />
          <div />
        </div>
      </div>
    );
  }
  if (error || !analytics) {
    return error ? (
      <div className={styles.analyticsNotice}>비교 분석을 불러오지 못했습니다. 누적 성적은 위 그래프에서 계속 확인할 수 있습니다.</div>
    ) : null;
  }

  const summary = analytics.summary;
  const trendData = analytics.trends
    .filter((row) => row.score_pct != null)
    .slice(-8)
    .map((row) => ({
      name: row.title.length > 6 ? `${row.title.slice(0, 6)}…` : row.title,
      득점률: Math.round(row.score_pct ?? 0),
      전체평균: row.cohort_avg_pct != null ? Math.round(row.cohort_avg_pct) : undefined,
    }));
  const risk = riskLabel(summary.risk_level);
  const highlight = analytics.highlights?.weakest_exam ?? analytics.highlights?.latest_exam;

  return (
    <section className={styles.analyticsPanel} aria-label="성적 비교">
      <div className={styles.analyticsHeader}>
        <span>성적 비교</span>
        <span className={styles.analyticsMeta}>내 기록과 전체 평균</span>
      </div>

      <div className={styles.analyticsGrid}>
        <div className={styles.metricTile}>
          <span className={styles.metricLabel}>평균 득점률</span>
          <strong>{formatPct(summary.avg_score_pct)}</strong>
          <span>중앙값 {formatPct(summary.median_score_pct)}</span>
        </div>
        <div className={styles.metricTile}>
          <span className={styles.metricLabel}>통과율</span>
          <strong>{formatPct(summary.pass_rate_pct)}</strong>
          <span>분석 시험 {summary.scored_exam_count}건</span>
        </div>
        <div className={styles.metricTile}>
          <span className={styles.metricLabel}>상태</span>
          <strong className={styles[risk.className]}>{risk.label}</strong>
          <span>미응시 {summary.not_submitted_count}건</span>
        </div>
      </div>

      {trendData.length >= 2 && (
        <div>
          <div className={styles.chartLegend} role="list" aria-label="최근 성적 비교 그래프 범례">
            <span role="listitem" data-series="score">내 득점률</span>
            {trendData.some((row) => row.전체평균 != null) && <span role="listitem" data-series="average">전체 평균</span>}
          </div>
          <div className={styles.analyticsChartBox}>
            <TrendChart
              data={trendData}
              showAverage={trendData.some((row) => row.전체평균 != null)}
              ariaLabel="최근 시험 득점률과 전체 평균 비교. 실선은 내 득점률, 점선은 전체 평균입니다."
            />
          </div>
        </div>
      )}

      <div className={styles.analyticsSplit}>
        {analytics.lecture_breakdown.length > 0 && (
          <div className={styles.analyticsList}>
            <span className={styles.metricLabel}>강좌별 평균</span>
            {analytics.lecture_breakdown.slice(0, 4).map((row) => (
              <div key={row.lecture_title} className={styles.barRow}>
                <span>{row.lecture_title}</span>
                <svg className={styles.barTrack} viewBox="0 0 100 8" preserveAspectRatio="none" aria-hidden="true">
                  <rect className={styles.barTrackBg} width="100" height="8" rx="4" />
                  <rect className={styles.barTrackFill} width={Math.max(0, Math.min(100, row.avg_score_pct ?? 0))} height="8" rx="4" />
                </svg>
                <strong>{formatPct(row.avg_score_pct)}</strong>
              </div>
            ))}
          </div>
        )}

        {(analytics.weak_questions.length > 0 || highlight) && (
          <div className={styles.analyticsList}>
            <span className={styles.metricLabel}>보완 우선순위</span>
            {highlight && (
              <div className={styles.priorityLine}>
                {highlight.title} · {formatPct(highlight.score_pct)}
              </div>
            )}
            {analytics.weak_questions.length > 0 && (
              <div className={styles.questionChips}>
                {analytics.weak_questions.slice(0, 6).map((row) => (
                  <span key={row.question_number}>{row.question_number}번 · {row.wrong_count}회</span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {analytics.insights.length > 0 && (
        <div className={styles.insights}>
          {analytics.insights.slice(0, 3).map((text) => (
            <span key={text}>{text}</span>
          ))}
        </div>
      )}
    </section>
  );
}

function formatPct(value: number | null | undefined) {
  return value == null ? "-" : `${Math.round(value)}%`;
}

function riskLabel(value: string) {
  if (value === "attention") return { label: "집중 관리", className: "riskAttention" };
  if (value === "watch") return { label: "관찰", className: "riskWatch" };
  if (value === "stable") return { label: "안정", className: "riskStable" };
  return { label: "데이터 적음", className: "riskNeutral" };
}

function TrendChart({ data, showAverage, ariaLabel = "점수 추이" }: { data: TrendDatum[]; showAverage: boolean; ariaLabel?: string }) {
  const width = 320;
  const height = 160;
  const plot = { left: 34, right: 12, top: 12, bottom: 28 };
  const plotWidth = width - plot.left - plot.right;
  const plotHeight = height - plot.top - plot.bottom;
  const x = (index: number) => plot.left + (data.length === 1 ? plotWidth / 2 : (plotWidth * index) / (data.length - 1));
  const y = (value: number) => plot.top + plotHeight - (Math.max(0, Math.min(100, value)) / 100) * plotHeight;
  const scorePoints = data.map((d, index) => `${x(index)},${y(d.득점률)}`).join(" ");
  const avgPoints = data
    .map((d, index) => d.전체평균 == null ? null : `${x(index)},${y(d.전체평균)}`)
    .filter(Boolean)
    .join(" ");

  return (
    <svg className={styles.trendChart} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={ariaLabel}>
      {[0, 50, 100].map((tick) => (
        <g key={tick}>
          <line className={styles.chartGridLine} x1={plot.left} x2={width - plot.right} y1={y(tick)} y2={y(tick)} />
          <text className={styles.chartYAxisLabel} x={6} y={y(tick) + 4}>{tick}</text>
        </g>
      ))}

      {showAverage && avgPoints && (
        <polyline className={styles.chartAverageLine} points={avgPoints} />
      )}
      <polyline className={styles.chartScoreLine} points={scorePoints} />

      {data.map((d, index) => (
        <g key={`${d.name}-${index}`}>
          <circle className={styles.chartPoint} cx={x(index)} cy={y(d.득점률)} r={4} />
          <text className={styles.chartXLabel} x={x(index)} y={height - 8} textAnchor={index === 0 ? "start" : index === data.length - 1 ? "end" : "middle"}>
            {d.name}
          </text>
        </g>
      ))}
    </svg>
  );
}
