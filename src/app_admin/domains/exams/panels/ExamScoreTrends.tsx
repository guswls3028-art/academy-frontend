import { Button, EmptyState } from "@/shared/ui/ds";
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
  trend_threshold_pp: number;
  trends: ScoreTrend[];
};

function formatRate(rate: number, difference: number | null) {
  if (difference == null) return `${rate.toFixed(1)}%`;
  return `${rate.toFixed(1)}% (${difference > 0 ? "+" : ""}${difference.toFixed(1)}%p)`;
}

export default function ExamScoreTrends({
  data,
  loading,
  error,
  onRetry,
}: {
  data: ExamAnalysisInsights | undefined;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
}) {
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
      {loading ? (
        <EmptyState scope="panel" tone="loading" title="추천 컷과 성적 변화를 불러오는 중…" />
      ) : error || !data ? (
        <EmptyState
          scope="panel"
          tone="error"
          title="추천 컷과 성적 변화를 불러오지 못했습니다."
          actions={<Button type="button" intent="secondary" size="sm" onClick={onRetry}>다시 시도</Button>}
        />
      ) : data.trends.length === 0 ? (
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
                        <div><dt>이번 시험</dt><dd>{formatRate(student.current_rate, null)}</dd></div>
                        <div>
                          <dt>직전 차시 평균</dt>
                          <dd>{student.previous_session_rate == null
                            ? "기록 없음"
                            : formatRate(student.previous_session_rate, student.previous_delta_pp)}</dd>
                        </div>
                        <div>
                          <dt>이전 누적 평균 ({student.prior_exam_count}회)</dt>
                          <dd>{student.cumulative_rate == null
                            ? "기록 없음"
                            : formatRate(student.cumulative_rate, student.cumulative_delta_pp)}</dd>
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
