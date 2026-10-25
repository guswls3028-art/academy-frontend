import { reasonLabel } from "./omrReviewReasonLabels";

export function OmrReviewReasons({ reasons, onIdentify, onEdit }: {
  reasons: string[];
  onIdentify?: () => void;
  onEdit?: () => void;
}) {
  return (
    <section className="orw-review-callout" aria-label="지금 확인할 내용">
      <div className="orw-review-callout__heading">지금 확인할 내용</div>
      <div className="orw-review-callout__reasons">
        {reasons.length ? [...new Set(reasons.map(reasonLabel))].map((label) => <div key={label}>{label}</div>)
          : <div>판독 결과 확인이 필요합니다.</div>}
      </div>
      <div className="orw-review-callout__actions">
        {onIdentify && <button type="button" className="orw-review-callout__action" onClick={onIdentify}>학생 연결하기</button>}
        {onEdit && <button type="button" className="orw-review-callout__action" onClick={onEdit}>답안 수정하기</button>}
      </div>
    </section>
  );
}
