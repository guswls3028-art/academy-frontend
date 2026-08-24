import { AlertTriangle, CheckCircle2, FileCheck2, RotateCcw, UsersRound } from "lucide-react";

import { Button } from "@/shared/ui/ds";
import { AdminModal, ModalBody, ModalFooter, ModalHeader } from "@/shared/ui/modal";
import type {
  StudentImportFailedRow,
  StudentImportResult,
  StudentImportResultRow,
} from "./asyncStatusStore";
import styles from "./StudentImportResultDialog.module.css";

type Props = {
  result: StudentImportResult;
  onClose: () => void;
};

type ResultRowProps = {
  item: StudentImportResultRow;
  badge: string;
  tone: "created" | "restored" | "existing";
};

function ResultRow({ item, badge, tone }: ResultRowProps) {
  return (
    <li className={styles.row}>
      <span className={styles.rowNumber}>{item.row != null ? `${item.row}행` : "행 미상"}</span>
      <span className={styles.rowName}>{item.name}</span>
      <span className={`${styles.rowBadge} ${styles[`rowBadge_${tone}`]}`}>{badge}</span>
    </li>
  );
}

function EmptyRows({ children }: { children: string }) {
  return <div className={styles.empty}>{children}</div>;
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "neutral" | "created" | "existing" | "failed";
}) {
  return (
    <div className={`${styles.summaryCard} ${styles[`summaryCard_${tone}`]}`}>
      <span>{label}</span>
      <strong>{value.toLocaleString()}명</strong>
    </div>
  );
}

function FailedRow({ item }: { item: StudentImportFailedRow }) {
  return (
    <li className={`${styles.row} ${styles.failedRow}`}>
      <span className={styles.rowNumber}>{item.row != null ? `${item.row}행` : "행 미상"}</span>
      <span className={styles.failedCopy}>
        <strong>{item.name}</strong>
        <span>{item.reason}</span>
      </span>
    </li>
  );
}

export default function StudentImportResultDialog({ result, onClose }: Props) {
  const successfulCount = result.createdCount + result.restoredCount;
  const hasCreatedCountWithoutRows = result.createdCount > result.createdRows.length;

  return (
    <AdminModal
      open
      onClose={onClose}
      type="action"
      width="min(1040px, calc(100vw - 32px))"
      noMinimize
      className={styles.modal}
    >
      <ModalHeader
        noIcon
        title={(
          <span className={styles.title}>
            <FileCheck2 aria-hidden size={24} />
            학생 등록 결과
          </span>
        )}
        description="엑셀의 각 행이 어떻게 처리됐는지 한눈에 확인할 수 있습니다."
      />
      <ModalBody>
        <div className={styles.body}>
          <div className={styles.totalLine}>
            <span>처리 완료</span>
            <strong>전체 {result.total.toLocaleString()}명</strong>
          </div>

          <div className={styles.summary} aria-label="등록 결과 요약">
            <SummaryCard label="신규 등록" value={result.createdCount} tone="created" />
            <SummaryCard label="복원" value={result.restoredCount} tone="neutral" />
            <SummaryCard label="이미 등록" value={result.duplicateCount} tone="existing" />
            <SummaryCard label="확인 필요" value={result.failedCount} tone="failed" />
          </div>

          <p className={styles.legacyNote}>
            행별 목록은 유형별 최대 500명의 표본이며, 위 요약은 전체 처리 건수입니다.
          </p>

          <div className={styles.ledger}>
            <section className={styles.panel} aria-labelledby="student-import-success-title">
              <header className={styles.panelHeader}>
                <span className={`${styles.panelIcon} ${styles.panelIcon_success}`}>
                  <CheckCircle2 aria-hidden size={18} />
                </span>
                <span>
                  <strong id="student-import-success-title">등록 완료</strong>
                  <small>새 계정과 복원된 계정</small>
                </span>
                <b>{successfulCount.toLocaleString()}명</b>
              </header>
              <div className={styles.listViewport}>
                {result.createdRows.length === 0 && result.restoredRows.length === 0 ? (
                  <EmptyRows>새로 등록되거나 복원된 학생이 없습니다.</EmptyRows>
                ) : (
                  <ul className={styles.rows}>
                    {result.createdRows.map((item, index) => (
                      <ResultRow key={`created-${item.row}-${index}`} item={item} badge="신규" tone="created" />
                    ))}
                    {result.restoredRows.map((item, index) => (
                      <ResultRow key={`restored-${item.row}-${index}`} item={item} badge="복원" tone="restored" />
                    ))}
                  </ul>
                )}
                {hasCreatedCountWithoutRows && (
                  <p className={styles.legacyNote}>
                    신규 전체 {result.createdCount.toLocaleString()}명 중 {result.createdRows.length.toLocaleString()}명 표본을 표시합니다.
                  </p>
                )}
                {result.restoredCount > result.restoredRows.length && (
                  <p className={styles.legacyNote}>
                    복원 전체 {result.restoredCount.toLocaleString()}명 중 {result.restoredRows.length.toLocaleString()}명 표본을 표시합니다.
                  </p>
                )}
              </div>
            </section>

            <section className={styles.panel} aria-labelledby="student-import-existing-title">
              <header className={styles.panelHeader}>
                <span className={`${styles.panelIcon} ${styles.panelIcon_existing}`}>
                  <UsersRound aria-hidden size={18} />
                </span>
                <span>
                  <strong id="student-import-existing-title">이미 등록된 학생</strong>
                  <small>기존 계정은 변경하지 않음</small>
                </span>
                <b>{result.duplicateCount.toLocaleString()}명</b>
              </header>
              <div className={styles.listViewport}>
                {result.duplicateRows.length === 0 ? (
                  <EmptyRows>중복으로 확인된 학생이 없습니다.</EmptyRows>
                ) : (
                  <ul className={styles.rows}>
                    {result.duplicateRows.map((item, index) => (
                      <ResultRow key={`duplicate-${item.row}-${index}`} item={item} badge="기존" tone="existing" />
                    ))}
                  </ul>
                )}
                {result.duplicateCount > result.duplicateRows.length && (
                  <p className={styles.legacyNote}>
                    전체 {result.duplicateCount.toLocaleString()}명 중 {result.duplicateRows.length.toLocaleString()}명 표본을 표시합니다.
                  </p>
                )}
              </div>
            </section>

            <section className={`${styles.panel} ${styles.failedPanel}`} aria-labelledby="student-import-failed-title">
              <header className={styles.panelHeader}>
                <span className={`${styles.panelIcon} ${styles.panelIcon_failed}`}>
                  <AlertTriangle aria-hidden size={18} />
                </span>
                <span>
                  <strong id="student-import-failed-title">확인 필요</strong>
                  <small>엑셀 행과 사유를 수정한 뒤 다시 등록</small>
                </span>
                <b>{result.failedCount.toLocaleString()}명</b>
              </header>
              <div className={styles.listViewport}>
                {result.failedRows.length === 0 ? (
                  <EmptyRows>실패한 학생이 없습니다.</EmptyRows>
                ) : (
                  <ul className={styles.rows}>
                    {result.failedRows.map((item, index) => (
                      <FailedRow key={`failed-${item.row}-${index}`} item={item} />
                    ))}
                  </ul>
                )}
                {result.failedCount > result.failedRows.length && (
                  <p className={styles.legacyNote}>
                    전체 {result.failedCount.toLocaleString()}명 중 {result.failedRows.length.toLocaleString()}명 표본을 표시합니다.
                  </p>
                )}
              </div>
            </section>
          </div>

          {result.failedCount > 0 && (
            <div className={styles.retryHint}>
              <RotateCcw aria-hidden size={16} />
              실패한 행만 수정해 다시 업로드해도 이미 등록된 학생 정보는 덮어쓰지 않습니다.
            </div>
          )}
        </div>
      </ModalBody>
      <ModalFooter
        left={<span className={styles.footerNote}>결과는 작업박스에서 다시 열 수 있습니다.</span>}
        right={<Button intent="primary" onClick={onClose}>확인</Button>}
      />
    </AdminModal>
  );
}
