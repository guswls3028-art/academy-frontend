import { EmptyState } from "@/shared/ui/ds";
import styles from "./ExamResultsViewerPanel.module.css";

type ScoreTrend = {
  enrollment_id: number;
  student_name: string;
  lecture_title: string;
  current_rate: number;
  previous_session_rate: number | null;
  cumulative_rate: number | null;
  prior_exam_count: number;
  previous_delta_pp: number | null;
  cumulative_delta_pp: number | null;
  signal: "up" | "down" | null;
};

export type ExamAnalysisInsights = {
  recommended_cutoff: number | null;
  below_recommended_count: number | null;
  scored_count: number;
  score_summary: {
    average: number | null;
    median: number | null;
    top_ten_average: number | null;
    highest: number | null;
    std_dev: number | null;
    std_rate: number | null;
    unscored_count: number;
    pass_criterion_count: number;
    pass_count: number;
    remediated_count: number;
    distribution_counts: [number, number, number, number, number];
  };
  trend_threshold_pp: number;
  trends: ScoreTrend[];
};

function ScoreRate({ rate, difference = null }: { rate: number | null; difference?: number | null }) {
  if (rate == null) return <dd>기록 없음</dd>;
  return (
    <dd>
      {rate.toFixed(1)}%
      {difference != null && ` (${difference > 0 ? "+" : ""}${difference.toFixed(1)}%p)`}
    </dd>
  );
}

export default function ExamScoreTrends({ data }: { data: ExamAnalysisInsights }) {
  const groups = [
    { label: "칭찬 참고", signal: "up" },
    { label: "상담 참고", signal: "down" },
    { label: "그 외 비교 결과", signal: null },
  ] as const;

  return (
    <section className={`${styles.evidencePanel} ${styles.trendPanel}`} aria-labelledby="score-trends-title">
      <div className={styles.panelHeading}>
        <h3 id="score-trends-title">학생별 성적 변화</h3>
      </div>
      {data.trends.length === 0 ? (
        <EmptyState scope="panel" tone="empty" title="같은 강의에 비교할 이전 확정 시험 점수가 없습니다" />
      ) : (
        <>
          <p className={styles.trendNote}>
            확정 {data.scored_count}명 중 {data.trends.length}명 비교 · 같은 강의의 시험별 득점률 기준
            <br />
            이전 누적 평균과 직전 차시 평균(있는 경우) 대비 같은 방향으로 {data.trend_threshold_pp}%p 이상 변한 학생을 표시합니다.
          </p>
          {groups.map(({ label, signal }) => {
            const students = data.trends.filter((student) => student.signal === signal);
            if (students.length === 0) return (
              <p className={styles.trendEmpty} key={label}>{label} 0명</p>
            );
            return (
              <details className={styles.trendGroup} key={label}>
                <summary>{label} <strong>{students.length}명</strong></summary>
                <ul className={styles.trendList}>
                  {students.map((student) => (
                    <li key={student.enrollment_id}>
                      <div className={styles.trendStudent}>
                        <strong>{student.student_name}</strong>
                        <span>{student.lecture_title}</span>
                      </div>
                      <dl className={styles.trendScores}>
                        <div><dt>이번 시험</dt><ScoreRate rate={student.current_rate} /></div>
                        <div>
                          <dt>직전 차시 평균</dt>
                          <ScoreRate rate={student.previous_session_rate} difference={student.previous_delta_pp} />
                        </div>
                        <div>
                          <dt>이전 누적 평균 ({student.prior_exam_count}회)</dt>
                          <ScoreRate rate={student.cumulative_rate} difference={student.cumulative_delta_pp} />
                        </div>
                      </dl>
                    </li>
                  ))}
                </ul>
              </details>
            );
          })}
        </>
      )}
    </section>
  );
}
