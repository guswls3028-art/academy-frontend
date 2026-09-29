/**
 * 성적 통계 탭 — StatCard 그리드 + 추이 차트 + 과제 진행바
 * GradesPage에서 추출.
 */
import { Fragment, useMemo, type ReactNode } from "react";
import { StatCard, StatGrid } from "@student/shared/ui/components/StatCard";
import ProgressRing from "@student/shared/ui/components/ProgressRing";
import type {
  StudentExamTrendPoint,
  StudentScoreLectureOption,
} from "@/shared/api/contracts/studentGrades";
import StudentScoreTrendChart from "@/shared/ui/assessment/StudentScoreTrendChart";
import type {
  StudentGradeReportLayout,
  StudentGradeReportScoreComparisonMetricId,
  StudentGradeReportSectionId,
} from "@/shared/api/contracts/studentGradeReportLayout";
import { STUDENT_GRADE_REPORT_ANALYTICS_SECTION_IDS } from "@/shared/api/contracts/studentGradeReportLayout";
import type { MyExamGradeSummary, MyGradesAnalytics, MyHomeworkGradeSummary } from "../api/grades.api";
import { useWrongCompletionDisplay } from "@/shared/scoring/assessmentStatusDisplay";
import { calculateExamStats, calculateHomeworkStats, calculateWeakestLecture } from "../utils/gradeStats";
import styles from "./GradesStatsTab.module.css";

type Props = {
  exams: MyExamGradeSummary[];
  homeworks: MyHomeworkGradeSummary[];
  examTrend: StudentExamTrendPoint[];
  lectureOptions: StudentScoreLectureOption[];
  analytics?: MyGradesAnalytics;
  analyticsLoading?: boolean;
  analyticsError?: boolean;
  reportLayout: StudentGradeReportLayout;
};

type TrendDatum = {
  name: string;
  득점률: number;
  전체평균?: number;
};

export default function GradesStatsTab({
  exams,
  homeworks,
  examTrend,
  lectureOptions,
  analytics,
  analyticsLoading,
  analyticsError,
  reportLayout,
}: Props) {
  const wrongCompletionOnly = useWrongCompletionDisplay();
  const examStats = useMemo(() => calculateExamStats(exams, wrongCompletionOnly), [exams, wrongCompletionOnly]);
  const hwStats = useMemo(() => calculateHomeworkStats(homeworks), [homeworks]);

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

  const weakestLecture = useMemo(() => calculateWeakestLecture(exams, wrongCompletionOnly), [exams, wrongCompletionOnly]);

  const homeworkPassPct = hwStats && hwStats.total > 0 ? (hwStats.passed / hwStats.total) * 100 : 0;
  const homeworkFailPct = hwStats && hwStats.total > 0 ? (hwStats.failed / hwStats.total) * 100 : 0;

  const firstVisibleAnalytics = reportLayout.sections.find(
    (section) => section.visible && STUDENT_GRADE_REPORT_ANALYTICS_SECTION_IDS.includes(section.id),
  )?.id;
  const withAnalyticsState = (
    sectionId: StudentGradeReportSectionId,
    content: ReactNode,
  ): ReactNode => {
    if (analyticsLoading) {
      return sectionId === firstVisibleAnalytics ? <AnalyticsLoading /> : null;
    }
    if (analyticsError || !analytics) {
      return analyticsError && sectionId === firstVisibleAnalytics ? (
        <div className={styles.analyticsNotice}>
          비교 분석을 불러오지 못했습니다. 다른 성적 정보는 계속 확인할 수 있습니다.
        </div>
      ) : null;
    }
    return content;
  };

  const sections: Record<StudentGradeReportSectionId, ReactNode> = {
    score_trend: (
      <StudentScoreTrendChart
        points={examTrend}
        audience="learner"
        lectureOptions={lectureOptions}
      />
    ),
    score_comparison: withAnalyticsState(
      "score_comparison",
      <ScoreComparisonSection
        analytics={analytics!}
        metrics={{
          ...reportLayout.score_comparison_metrics,
          pass_rate: reportLayout.score_comparison_metrics.pass_rate && !wrongCompletionOnly,
        }}
      />,
    ),
    lecture_average: withAnalyticsState(
      "lecture_average",
      <LectureAverageSection analytics={analytics!} />,
    ),
    improvement_priority: withAnalyticsState(
      "improvement_priority",
      <ImprovementPrioritySection analytics={analytics!} />,
    ),
    exam_summary: examStats ? (
      <section aria-label="시험 성적 요약">
        <div className={styles.sectionTitle}>시험 성적 요약</div>
        <div className={styles.examSummary}>
          <ProgressRing
            percent={examStats.avgPct ?? 0}
            label={examStats.avgPct == null ? "미채점" : undefined}
            size={88}
            color={examStats.avgPct == null ? "var(--stu-text-muted)" : examStats.avgPct >= 70 ? "var(--stu-success)" : examStats.avgPct >= 40 ? "var(--stu-warn)" : "var(--stu-danger)"}
            sublabel="평균"
          />
          <div className={styles.summaryStats}>
            <StatGrid>
              <StatCard label={wrongCompletionOnly ? "오답 완료율" : "합격률"} value={examStats.passRate == null ? "미판정" : `${examStats.passRate}%`} accent={examStats.passRate == null ? undefined : examStats.passRate >= 70 ? "success" : "danger"} />
              <StatCard label="시험 수" value={`${examStats.count}건`} />
              {examStats.avgRank != null
                ? <StatCard label="평균 등수" value={`${examStats.avgRank}등`} />
                : <StatCard label="응시완료" value={`${exams.filter((e) => e.total_score != null).length}건`} />
              }
            </StatGrid>
          </div>
        </div>
      </section>
    ) : null,
    rank_position: examStats && rankInsight ? (
      <section aria-label="내 위치 분석">
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
      </section>
    ) : null,
    weakest_lecture: weakestLecture ? (
      <section className={styles.weaknessCard} aria-label="약점 강좌">
        <div className={styles.sectionTitle}>약점 강좌</div>
        <div className={styles.weaknessText}>
          <span className={styles.weaknessEmphasis}>{weakestLecture.name}</span> 강좌의
          평균 득점률이 <strong className={styles.weaknessEmphasis}>{weakestLecture.avg}%</strong>로 가장 낮습니다.
          {weakestLecture.passRate != null && weakestLecture.passRate < 50 && ` ${wrongCompletionOnly ? "오답 완료율" : "합격률"}도 ${weakestLecture.passRate}%입니다.`}
        </div>
      </section>
    ) : null,
    homework_summary: hwStats ? (
      <section aria-label="과제 현황">
        <div className={styles.sectionTitle}>과제 현황</div>
        <StatGrid>
          <StatCard label="처리 완료" value={`${hwStats.graded}/${hwStats.total}건`} />
          <StatCard label="평균 득점률" value={hwStats.avgPct != null ? `${hwStats.avgPct}%` : "미채점"} />
          <StatCard label={wrongCompletionOnly ? "완료율" : "합격률"} value={hwStats.passRate == null ? "미판정" : `${hwStats.passRate}%`} accent={hwStats.passRate == null ? undefined : hwStats.passRate >= 70 ? "success" : "danger"} />
        </StatGrid>
        {hwStats.total > 0 && (
          <svg className={styles.homeworkBar} viewBox="0 0 100 8" preserveAspectRatio="none" aria-hidden="true">
            <rect width="100" height="8" fill="var(--stu-surface-soft)" rx="4" />
            <rect className={styles.homeworkFill} width={homeworkPassPct} height="8" fill="var(--stu-success)" rx="4" />
            <rect className={styles.homeworkFill} x={homeworkPassPct} width={homeworkFailPct} height="8" fill="var(--stu-danger)" rx="4" />
          </svg>
        )}
      </section>
    ) : null,
  };

  return (
    <div className={styles.stack}>
      {reportLayout.sections
        .filter((section) => section.visible)
        .map((section) => <Fragment key={section.id}>{sections[section.id]}</Fragment>)}
    </div>
  );
}

function AnalyticsLoading() {
  return (
    <div className={styles.analyticsPanel} role="status">
      <div className={styles.analyticsHeader}>
        <span>성적 분석</span>
        <span className={styles.analyticsMeta}>불러오는 중</span>
      </div>
      <div className={styles.analyticsSkeletonGrid}><div /><div /><div /></div>
    </div>
  );
}

function ScoreComparisonSection({
  analytics,
  metrics,
}: {
  analytics: MyGradesAnalytics;
  metrics: Record<StudentGradeReportScoreComparisonMetricId, boolean>;
}) {
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

  return (
    <section className={styles.analyticsPanel} aria-label="성적 비교">
      <div className={styles.analyticsHeader}>
        <span>성적 비교</span>
        <span className={styles.analyticsMeta}>내 기록과 전체 평균</span>
      </div>

      <div className={styles.analyticsGrid}>
        {metrics.average_score && (
          <div className={styles.metricTile}>
            <span className={styles.metricLabel}>평균 득점률</span>
            <strong>{formatPct(summary.avg_score_pct)}</strong>
            <span>중앙값 {formatPct(summary.median_score_pct)}</span>
          </div>
        )}
        {metrics.pass_rate && (
          <div className={styles.metricTile}>
            <span className={styles.metricLabel}>통과율</span>
            <strong>{formatPct(summary.pass_rate_pct)}</strong>
            <span>분석 시험 {summary.scored_exam_count}건</span>
          </div>
        )}
        {metrics.status && (
          <div className={styles.metricTile}>
            <span className={styles.metricLabel}>상태</span>
            <strong className={styles[risk.className]}>{risk.label}</strong>
            <span>미응시 {summary.not_submitted_count}건</span>
          </div>
        )}
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

    </section>
  );
}

function LectureAverageSection({ analytics }: { analytics: MyGradesAnalytics }) {
  if (analytics.lecture_breakdown.length === 0) return null;
  return (
    <section className={styles.analyticsPanel} aria-label="강좌별 평균">
      <div className={styles.analyticsHeader}>
        <span>강좌별 평균</span>
        <span className={styles.analyticsMeta}>강좌별 득점률</span>
      </div>
      <div className={styles.analyticsList}>
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
    </section>
  );
}

function ImprovementPrioritySection({ analytics }: { analytics: MyGradesAnalytics }) {
  const highlight = analytics.highlights?.weakest_exam ?? analytics.highlights?.latest_exam;
  if (!highlight && analytics.weak_questions.length === 0 && analytics.insights.length === 0) return null;
  return (
    <section className={styles.analyticsPanel} aria-label="보완 우선순위">
      <div className={styles.analyticsHeader}>
        <span>보완 우선순위</span>
        <span className={styles.analyticsMeta}>최근 결과 기준</span>
      </div>
      <div className={styles.analyticsList}>
        {highlight && <div className={styles.priorityLine}>{highlight.title} · {formatPct(highlight.score_pct)}</div>}
        {analytics.weak_questions.length > 0 && (
          <div className={styles.questionChips}>
            {analytics.weak_questions.slice(0, 6).map((row) => (
              <span key={row.question_number}>{row.question_number}번 · {row.wrong_count}회</span>
            ))}
          </div>
        )}
      </div>
      {analytics.insights.length > 0 && (
        <div className={styles.insights}>
          {analytics.insights.slice(0, 3).map((text) => <span key={text}>{text}</span>)}
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
