import type { SessionAssessmentTotals as SessionTotals } from "../api/grades.api";
import type { AssessmentTotal } from "@/shared/api/contracts/sessionScores";
import styles from "./AssessmentFeedback.module.css";

function Total({ label, total }: { label: string; total: AssessmentTotal }) {
  if (!total.selected_count) return null;
  return <div className={styles.total}><span>{label} <small>{total.selected_count}개 합산</small></span><strong>{total.score ?? "—"} / {total.max_score}</strong>{!total.complete && <small>집계 중 · {total.scored_count}/{total.selected_count}개 입력</small>}</div>;
}

export default function SessionAssessmentTotals({ items }: { items: SessionTotals[] }) {
  const visible = items.filter((item) => item.exam_total.selected_count || item.homework_total.selected_count);
  if (!visible.length) return null;
  return <details className={styles.totals}>
    <summary>차시별 총점 <span>{visible.length}개 차시</span></summary>
    <p className={styles.help}>선생님이 선택한 시험·점수형 과제의 합계입니다. 집계 중인 총점에는 아직 입력되지 않은 점수가 있습니다.</p>
    {visible.map((item) => <section key={item.session_id} className={styles.session} aria-label={`${item.lecture_title} ${item.session_title} 총점`}>
      <h3>{item.lecture_title} · {item.session_title}</h3>
      <Total label="시험 총점" total={item.exam_total} /><Total label="과제 총점" total={item.homework_total} />
    </section>)}
  </details>;
}
