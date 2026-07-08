import { useQuery } from "@tanstack/react-query";
import { EmptyState } from "@/shared/ui/ds";
import { Card, KpiCard, SectionTitle } from "@teacher/shared/ui/Card";
import {
  fetchEnterpriseAnalytics,
  type EnterpriseAnalytics,
} from "@teacher/domains/results/statsApi";
import { teacherResultsQueryKeys } from "@teacher/domains/results/queryKeys";
import styles from "./EnterpriseAnalyticsTab.module.css";

export default function EnterpriseAnalyticsTab() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: teacherResultsQueryKeys.enterpriseAnalytics,
    queryFn: fetchEnterpriseAnalytics,
    staleTime: 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className={styles.stack}>
        <div className={styles.kpiSkeletonGrid}>
          <div />
          <div />
          <div />
          <div />
        </div>
        <div className={styles.panelSkeleton} />
        <div className={styles.panelSkeleton} />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <EmptyState
        scope="panel"
        tone="error"
        title="운영 분석을 불러올 수 없습니다"
        actions={(
          <button type="button" className={styles.retryButton} onClick={() => refetch()}>
            다시 시도
          </button>
        )}
      />
    );
  }

  return <AnalyticsBody data={data} />;
}

function AnalyticsBody({ data }: { data: EnterpriseAnalytics }) {
  const qualityFlags =
    data.data_quality.filtered_test_exam_results +
    data.data_quality.no_enrollment_exam_results +
    data.data_quality.foreign_enrollment_exam_results;
  const maxActivity = Math.max(
    1,
    ...data.trends.map((row) => row.manual_score_events + row.auto_grade_submissions),
  );
  const activity = activityLabel(data.usage.activity_level);

  return (
    <div className={styles.stack}>
      <div className={styles.headerLine}>
        <div>
          <span className={styles.eyebrow}>{data.tenant.name}</span>
          <h3>운영 성적 분석</h3>
        </div>
        <span className={styles.rangeBadge}>최근 {data.date_range.days}일</span>
      </div>

      <div className={styles.kpiGrid}>
        <KpiCard label="평균 득점률" value={formatPct(data.summary.avg_score_pct)} />
        <KpiCard label="중앙값" value={formatPct(data.summary.median_score_pct)} />
        <KpiCard label="통과율" value={formatPct(data.summary.pass_rate_pct)} />
        <KpiCard
          label="활용 수준"
          value={activity.label}
          color={activity.color}
        />
      </div>

      <div className={styles.usageGrid}>
        <Card>
          <SectionTitle>기간별 성적·활용 추이</SectionTitle>
          <div className={styles.monthBars}>
            {data.trends.map((row) => {
              const activityTotal = row.manual_score_events + row.auto_grade_submissions;
              return (
                <div key={row.period} className={styles.monthRow}>
                  <span>{row.period.slice(2)}</span>
                  <div className={styles.monthTrack}>
                    <svg className={styles.trackSvg} viewBox="0 0 100 18" preserveAspectRatio="none" aria-hidden="true">
                      <rect className={styles.scoreBar} width={clamp(row.avg_score_pct ?? 0)} height="18" rx="9" />
                      <rect className={styles.activityBar} y="5" width={Math.max(4, (activityTotal / maxActivity) * 100)} height="8" rx="4" />
                    </svg>
                  </div>
                  <strong>{formatPct(row.avg_score_pct)}</strong>
                  <em>{activityTotal}건</em>
                </div>
              );
            })}
          </div>
          <div className={styles.legend}>
            <span><i className={styles.legendScore} />성적 평균</span>
            <span><i className={styles.legendActivity} />입력·자동채점</span>
          </div>
        </Card>

        <Card>
          <SectionTitle>성적 입력·자동채점 사용량</SectionTitle>
          <div className={styles.usageList}>
            <MetricLine label="수동 성적 입력" value={`${data.usage.manual_score_events}건`} sub={`${data.usage.manual_active_days}일 사용`} />
            <MetricLine label="자동채점 접수" value={`${data.usage.auto_grade_submissions}건`} sub={`완료 ${data.usage.auto_grade_done}건`} />
            <MetricLine label="자동채점 완료율" value={formatPct(data.usage.auto_completion_rate_pct)} sub={`검토 ${data.usage.auto_grade_review}건 · 실패 ${data.usage.auto_grade_failed}건`} />
            <MetricLine label="최근 활동" value={formatDate(data.usage.latest_activity_at)} sub="성적/입력/자동채점 기준" />
          </div>
        </Card>
      </div>

      {qualityFlags > 0 && (
        <div className={styles.qualityNotice}>
          분석에서 데모·E2E {data.data_quality.filtered_test_exam_results}건,
          고아 결과 {data.data_quality.no_enrollment_exam_results}건,
          타 테넌트 연결 {data.data_quality.foreign_enrollment_exam_results}건을 분리했습니다.
        </div>
      )}

      <div className={styles.tableGrid}>
        <Card>
          <SectionTitle>시험별 성과</SectionTitle>
          {data.top_exams.length > 0 ? (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>시험</th>
                    <th>응시</th>
                    <th>평균</th>
                    <th>통과</th>
                    <th>P10/P90</th>
                  </tr>
                </thead>
                <tbody>
                  {data.top_exams.slice(0, 8).map((exam) => (
                    <tr key={exam.exam_id}>
                      <td>{exam.title}</td>
                      <td>{exam.scored_count}명</td>
                      <td>{formatPct(exam.avg_score_pct)}</td>
                      <td>{formatPct(exam.pass_rate_pct)}</td>
                      <td>{formatPct(exam.p10_score_pct)} / {formatPct(exam.p90_score_pct)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState scope="panel" tone="empty" title="시험 성과 데이터가 없습니다" />
          )}
        </Card>

        <Card>
          <SectionTitle>문항 리스크</SectionTitle>
          {data.weak_questions.length > 0 ? (
            <div className={styles.questionList}>
              {data.weak_questions.map((row) => (
                <div key={`${row.exam_id}-${row.question_number}`} className={styles.questionRow}>
                  <span>{row.question_number}번</span>
                  <div className={styles.questionTrack}>
                    <svg className={styles.trackSvg} viewBox="0 0 100 8" preserveAspectRatio="none" aria-hidden="true">
                      <rect className={styles.questionRiskBar} width={clamp(100 - (row.accuracy_pct ?? 0))} height="8" rx="4" />
                    </svg>
                  </div>
                  <strong>정답률 {formatPct(row.accuracy_pct)}</strong>
                  <em>오답 {row.wrong_count}건</em>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState scope="panel" tone="empty" title="문항별 분석 데이터가 없습니다" />
          )}
        </Card>
      </div>
    </div>
  );
}

function MetricLine({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className={styles.metricLine}>
      <span>{label}</span>
      <strong>{value}</strong>
      <em>{sub}</em>
    </div>
  );
}

function formatPct(value: number | null | undefined) {
  return value == null ? "-" : `${Math.round(value)}%`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, value));
}

function activityLabel(value: string) {
  if (value === "high") return { label: "높음", color: "var(--tc-success)" };
  if (value === "regular") return { label: "정기 사용", color: "var(--tc-info)" };
  if (value === "light") return { label: "낮음", color: "var(--tc-warn)" };
  return { label: "없음", color: "var(--tc-text-muted)" };
}
