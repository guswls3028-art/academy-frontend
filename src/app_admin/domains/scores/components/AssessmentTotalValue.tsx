import type { AssessmentTotal } from "../api/sessionScores";

export default function AssessmentTotalValue({ total }: { total: AssessmentTotal | undefined }) {
  if (!total) return <span title="합산 정보를 불러오지 못했습니다">—</span>;
  if (!total.selected_count) return <span className="assessment-total-value"><span>—</span><small>합산 대상 없음</small></span>;
  return <span className="assessment-total-value">
    <span>{total.score ?? "—"}<span className="text-[var(--color-text-muted)]"> / {total.max_score}</span></span>
    {!total.complete && <small>집계 중 · {total.scored_count}/{total.selected_count}</small>}
  </span>;
}
