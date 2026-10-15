import type { OmrUploadBatchItemStatus, OmrUploadBatchSummary } from "@/shared/api/contracts/submissions";
import styles from "./OmrBatchLedger.module.css";

const STATUS_LABELS: Record<OmrUploadBatchItemStatus, string> = {
  pending_admission: "접수 대기",
  received: "접수 완료",
  duplicate: "동일 파일 · 기존 답안지 사용",
  processing: "처리 중",
  completed: "OMR 처리 완료",
  needs_identification: "학생 확인 필요",
  failed: "실패",
  superseded: "보관",
};

export default function OmrBatchLedger({ batch, fileNames }: {
  batch: OmrUploadBatchSummary;
  fileNames?: Readonly<Record<number, string>>;
}) {
  if (!batch.items?.length) return null;
  return (
    <details
      className={styles.ledger}
      aria-label="답안지별 접수 내역"
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <summary>답안지별 접수 내역 · {batch.total_count}장</summary>
      <ol className={styles.items}>
        {batch.items.map((item) => (
          <li key={item.id} data-status={item.status}>
            <span className={styles.ordinal}>
              {item.ordinal}번 답안지
              {fileNames?.[item.ordinal] && <span className={styles.fileName}>{fileNames[item.ordinal]}</span>}
            </span>
            <span className={styles.state}>
              {batch.subjective_pending_ordinals?.includes(item.ordinal)
                ? "서술형 입력 필요"
                : STATUS_LABELS[item.status]}
              {item.failure_message && <span className={styles.reason}>{item.failure_message}</span>}
            </span>
          </li>
        ))}
      </ol>
    </details>
  );
}
