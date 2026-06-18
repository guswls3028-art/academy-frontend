// PATH: src/app_admin/domains/messages/pages/MessageLogPage.tsx
// 발송 내역 — 카드형 리스트 + 상세 팝업 (디자인 강화, 모든 데이터 표시)

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { EmptyState } from "@/shared/ui/ds";
import { AdminModal, ModalHeader, ModalBody, ModalFooter } from "@/shared/ui/modal";
import { Button } from "@/shared/ui/ds";
import { useConfirm } from "@/shared/ui/confirm";
import { useNotificationLog } from "../hooks/useNotificationLog";
import {
  cancelScheduledNotification,
  fetchMessagingOperationsStatus,
  fetchScheduledNotifications,
  type MessagingOperationsStatus,
  type NotificationLogItem,
  type ScheduledNotificationItem,
} from "../api/messages.api";
import { feedback } from "@/shared/ui/feedback/feedback";
import styles from "./MessageLogPage.module.css";

// ── helpers ──

function formatDate(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function formatDateFull(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleString("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return iso;
  }
}

const MESSAGE_MODE_LABELS: Record<string, string> = {
  sms: "문자 발송 차단(레거시)",
  alimtalk: "알림톡",
  both: "알림톡 (레거시)",
};

type StatusFilter = "all" | "success" | "failure";
const PAGE_SIZE = 30;

const FILTER_OPTIONS: { key: StatusFilter; label: string; count?: number }[] = [
  { key: "all", label: "전체" },
  { key: "success", label: "성공" },
  { key: "failure", label: "실패" },
];

// ── StatusBadge ──

function StatusBadge({ success, size = "sm" }: { success: boolean; size?: "sm" | "md" }) {
  return (
    <span
      className={styles.statusBadge}
      data-success={success}
      data-size={size}
    >
      <span className={styles.statusBadgeDot} />
      {success ? "성공" : "실패"}
    </span>
  );
}

// ── ModeBadge ──

function ModeBadge({ mode }: { mode?: string }) {
  if (!mode) return null;
  const label = MESSAGE_MODE_LABELS[mode] ?? mode;
  return (
    <span className={styles.modeBadge}>
      {label}
    </span>
  );
}

function ScheduledRow({
  item,
  onCancel,
  cancelling,
}: {
  item: ScheduledNotificationItem;
  onCancel: () => void;
  cancelling: boolean;
}) {
  return (
    <div className={styles.scheduledRow}>
      <span className={styles.scheduledAtCell}>{formatDate(item.send_at)}</span>
      <span className={styles.recipientCell}>{item.recipient_summary || "—"}</span>
      <span className={styles.previewCell}>{item.message_preview || "—"}</span>
      <Button size="sm" intent="secondary" onClick={onCancel} disabled={cancelling}>
        취소
      </Button>
    </div>
  );
}

function formatAge(seconds: number | null) {
  if (seconds == null) return "기록 없음";
  if (seconds < 60) return `${seconds}초 전`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}분 전`;
  return `${Math.floor(seconds / 3600)}시간 전`;
}

function OperationsPanel({
  status,
  loading,
}: {
  status?: MessagingOperationsStatus;
  loading: boolean;
}) {
  const hasRisk = Boolean(status?.risks?.length);
  const workerStatus = status?.worker.status ?? "unknown";
  return (
    <div className={styles.operationsPanel} data-risk={hasRisk ? "true" : "false"}>
      <div className={styles.operationsHeader}>
        <div>
          <span className={styles.operationsTitle}>운영 상태</span>
          <span className={styles.operationsHint}>워커·예약 큐·최근 실패를 함께 확인합니다.</span>
        </div>
        <span className={styles.operationsBadge} data-status={workerStatus}>
          {loading ? "확인 중" : workerStatus === "ok" ? "정상" : workerStatus === "stale" ? "워커 확인" : "기록 없음"}
        </span>
      </div>
      {loading && !status ? (
        <div className={styles.operationsLoading}>운영 상태를 확인하고 있습니다.</div>
      ) : status ? (
        <>
          <div className={styles.operationsGrid}>
            <div className={styles.operationsMetric}>
              <span>워커</span>
              <strong>{formatAge(status.worker.age_seconds)}</strong>
            </div>
            <div className={styles.operationsMetric} data-warning={status.scheduled.overdue > 0 ? "true" : "false"}>
              <span>예약 대기</span>
              <strong>{status.scheduled.pending.toLocaleString()}건</strong>
              {status.scheduled.overdue > 0 && <em>{status.scheduled.overdue.toLocaleString()}건 지연</em>}
            </div>
            <div className={styles.operationsMetric} data-warning={status.log_24h.failed > 0 ? "true" : "false"}>
              <span>최근 24시간</span>
              <strong>{status.log_24h.sent.toLocaleString()}성공 / {status.log_24h.failed.toLocaleString()}실패</strong>
            </div>
            <div className={styles.operationsMetric} data-warning={status.auto_send.enabled_without_template + status.auto_send.enabled_unapproved_template > 0 ? "true" : "false"}>
              <span>자동발송</span>
              <strong>{status.auto_send.enabled.toLocaleString()}개 ON</strong>
            </div>
          </div>
          {status.risks.length > 0 ? (
            <div className={styles.operationsRisks}>
              {status.risks.slice(0, 3).map((risk) => (
                <span key={risk.code}>{risk.title}: {risk.detail}</span>
              ))}
            </div>
          ) : (
            <div className={styles.operationsOk}>현재 감지된 운영 리스크가 없습니다.</div>
          )}
        </>
      ) : (
        <div className={styles.operationsLoading}>운영 상태를 불러오지 못했습니다.</div>
      )}
    </div>
  );
}

// ── LogRow (horizontal log-style) ──

function LogRow({
  item,
  onClick,
}: {
  item: NotificationLogItem;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={styles.logRow}
    >
      {/* 일시 */}
      <span className={styles.sentAtCell}>
        {formatDate(item.sent_at)}
      </span>

      {/* 상태 */}
      <span className={styles.statusCell}>
        <StatusBadge success={item.success} />
      </span>

      {/* 발송방식 */}
      <span className={styles.modeCell}>
        <ModeBadge mode={item.message_mode} />
      </span>

      {/* 수신자 */}
      <span className={styles.recipientCell}>
        {item.recipient_summary || "—"}
      </span>

      {/* 내용 미리보기 */}
      <span className={styles.previewCell}>
        {(item.template_summary && !item.template_summary.startsWith("KA01"))
          ? item.template_summary
          : item.message_body?.slice(0, 80) || "—"}
      </span>

      {/* 실패 사유 (짧게) */}
      {item.failure_reason ? (
        <span className={styles.failureCell}>
          {item.failure_reason}
        </span>
      ) : null}

      {/* 차감 */}
      <span className={styles.amountCell}>
        {item.amount_deducted && Number(item.amount_deducted) > 0
          ? `-${Number(item.amount_deducted).toLocaleString()}원`
          : "—"}
      </span>

      {/* 화살표 */}
      <span className={styles.arrowCell}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    </button>
  );
}

// ── DetailModal ──

function DetailRow({
  label,
  children,
  mono,
}: {
  label: string;
  children: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className={styles.detailRow}>
      <span className={styles.detailLabel}>
        {label}
      </span>
      <span className={styles.detailValue} data-mono={mono}>
        {children}
      </span>
    </div>
  );
}

function LogDetailModal({
  item,
  open,
  onClose,
}: {
  item: NotificationLogItem | null;
  open: boolean;
  onClose: () => void;
}) {
  if (!item) return null;

  return (
    <AdminModal open={open} onClose={onClose} type="inspect" width={540}>
      <ModalHeader
        title="발송 상세"
        description={formatDateFull(item.sent_at)}
        type="inspect"
      />
      <ModalBody>
        <div className={styles.modalContent}>
          {/* 상태 + 차감 요약 */}
          <div className={styles.summaryBox} data-success={item.success}>
            <StatusBadge success={item.success} size="md" />
            {item.message_mode ? (
              <ModeBadge mode={item.message_mode} />
            ) : null}
            <span className={styles.summarySpacer} />
            <span
              className={styles.summaryAmount}
              data-success={item.success}
            >
              {item.amount_deducted && Number(item.amount_deducted) > 0
                ? `-${Number(item.amount_deducted).toLocaleString()}원`
                : "0원"}
            </span>
          </div>

          <DetailRow label="수신자">
            {item.recipient_summary || "—"}
          </DetailRow>
          <DetailRow label="템플릿">
            {item.template_summary || "—"}
          </DetailRow>
          <DetailRow label="발송 방식">
            {item.message_mode
              ? MESSAGE_MODE_LABELS[item.message_mode] ?? item.message_mode
              : "—"}
          </DetailRow>

          {/* 메시지 본문 */}
          <div className={styles.modalSection}>
            <div className={styles.modalSectionLabel}>
              발송 내용
            </div>
            {item.message_body ? (
              <div className={styles.messageBody}>
                {item.message_body}
              </div>
            ) : (
              <div className={styles.emptyMessageBody}>
                본문 정보가 없습니다
              </div>
            )}
          </div>

          {/* 실패 사유 */}
          {item.failure_reason ? (
            <div className={styles.modalSection}>
              <div className={styles.modalSectionLabel} data-tone="error">
                실패 사유
              </div>
              <div className={styles.failureReasonBox}>
                {item.failure_reason}
              </div>
            </div>
          ) : null}
        </div>
      </ModalBody>
      <ModalFooter
        right={
          <Button size="md" onClick={onClose}>
            닫기
          </Button>
        }
      />
    </AdminModal>
  );
}

// ── Pagination ──

function PaginationBar({
  currentPage,
  totalPages,
  onPageChange,
}: {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;

  const pages: (number | "...")[] = [];
  const range = 2;
  for (let i = 1; i <= totalPages; i++) {
    if (
      i === 1 ||
      i === totalPages ||
      (i >= currentPage - range && i <= currentPage + range)
    ) {
      pages.push(i);
    } else if (pages[pages.length - 1] !== "...") {
      pages.push("...");
    }
  }

  return (
    <div className={styles.pagination}>
      <button
        type="button"
        disabled={currentPage === 1}
        onClick={() => onPageChange(currentPage - 1)}
        className={styles.paginationButton}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
      {pages.map((p, i) =>
        p === "..." ? (
          <span key={`dots-${i}`} className={styles.paginationDots}>
            ...
          </span>
        ) : (
          <button
            key={p}
            type="button"
            onClick={() => onPageChange(p)}
            className={styles.paginationButton}
            data-active={p === currentPage}
          >
            {p}
          </button>
        )
      )}
      <button
        type="button"
        disabled={currentPage === totalPages}
        onClick={() => onPageChange(currentPage + 1)}
        className={styles.paginationButton}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
    </div>
  );
}

// ── Main Page ──

export default function MessageLogPage() {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedItem, setSelectedItem] = useState<NotificationLogItem | null>(null);
  const { data, isLoading, isError } = useNotificationLog({
    page: currentPage,
    page_size: PAGE_SIZE,
    status: statusFilter === "all" ? undefined : statusFilter,
  });
  const { data: scheduledData } = useQuery({
    queryKey: ["messaging", "scheduled", "pending"],
    queryFn: () => fetchScheduledNotifications({ status: "pending", page_size: 50 }),
    staleTime: 10 * 1000,
  });
  const { data: operationsStatus, isLoading: operationsLoading } = useQuery({
    queryKey: ["messaging", "operations-status"],
    queryFn: fetchMessagingOperationsStatus,
    staleTime: 15 * 1000,
    refetchInterval: 30 * 1000,
  });
  const cancelMut = useMutation({
    mutationFn: cancelScheduledNotification,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["messaging", "scheduled", "pending"] });
      qc.invalidateQueries({ queryKey: ["messaging", "operations-status"] });
      feedback.success("예약 발송이 취소되었습니다.");
    },
    onError: () => {
      feedback.error("예약 발송 취소에 실패했습니다.");
    },
  });
  const results = data?.results ?? [];
  const pendingScheduled = scheduledData?.results ?? [];
  const count = data?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));

  const filtered =
    statusFilter === "all"
      ? results
      : results.filter((r) =>
          statusFilter === "success" ? r.success : !r.success
        );

  const filteredCountLabel =
    statusFilter !== "all" && filtered.length !== results.length
      ? `${filtered.length}/${results.length}건 (현재 페이지)`
      : null;

  const handleFilterChange = (key: StatusFilter) => {
    setStatusFilter(key);
    setCurrentPage(1);
  };

  const handleCancelScheduled = async (item: ScheduledNotificationItem) => {
    const ok = await confirm({
      title: "예약 발송 취소",
      message: `${formatDate(item.send_at)}에 예약된 ${item.recipient_summary || "알림톡"} 발송을 취소할까요?`,
      confirmText: "예약 취소",
      cancelText: "유지",
      danger: true,
    });
    if (!ok) return;
    cancelMut.mutate(item.id);
  };

  return (
    <div className={styles.root}>
      {/* 헤더 */}
      <div className={styles.header}>
        <div>
          <div className={styles.title}>
            발송 내역
          </div>
          <div className={styles.description}>
            알림톡 발송 내역과 성공/실패, 차감 금액을 확인할 수 있습니다.
            {!isLoading && count > 0 ? (
              <span className={styles.countText}>
                총 {count.toLocaleString()}건
                {filteredCountLabel && (
                  <span className={styles.filteredCountText}>
                    ({filteredCountLabel})
                  </span>
                )}
              </span>
            ) : null}
          </div>
        </div>

        {/* 필터 */}
        {!isLoading && results.length > 0 ? (
          <div data-guide="messages-filter" className={styles.filterGroup}>
            {FILTER_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => handleFilterChange(opt.key)}
                className={styles.filterButton}
                data-active={statusFilter === opt.key}
              >
                {opt.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <OperationsPanel status={operationsStatus} loading={operationsLoading} />

      <div className={styles.scheduledPanel} data-empty={pendingScheduled.length === 0 ? "true" : "false"}>
        <div className={styles.scheduledHeader}>
          <div>
            <span className={styles.scheduledTitle}>예약 발송</span>
            <span className={styles.scheduledHint}>발송 전 예약은 여기서 확인·취소합니다.</span>
          </div>
          <span className={styles.scheduledCount}>{pendingScheduled.length.toLocaleString()}건 대기</span>
        </div>
        {pendingScheduled.length > 0 ? (
          <div className={styles.scheduledList}>
            {pendingScheduled.map((item) => (
              <ScheduledRow
                key={item.id}
                item={item}
                cancelling={cancelMut.isPending}
                onCancel={() => handleCancelScheduled(item)}
              />
            ))}
          </div>
        ) : (
          <div className={styles.scheduledEmpty}>
            현재 예약 대기 중인 알림톡이 없습니다.
          </div>
        )}
      </div>

      {/* 콘텐츠 */}
      {isError ? (
        <EmptyState
          title="발송 내역을 불러오지 못했습니다"
          description="잠시 후 다시 시도해 주세요."
          tone="error"
          scope="panel"
        />
      ) : isLoading ? (
        <div className={styles.loadingList}>
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div
              key={i}
              className={styles.skeletonRow}
            />
          ))}
        </div>
      ) : results.length === 0 ? (
        <EmptyState
          title="발송 내역이 없습니다"
          description="메시지를 발송하면 이곳에 기록됩니다."
          tone="empty"
          scope="panel"
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          title={`${statusFilter === "success" ? "성공" : "실패"} 내역이 없습니다`}
          description="필터를 변경해 보세요."
          tone="empty"
          scope="panel"
          mode="embedded"
        />
      ) : (
        <>
          {/* 로그 테이블 */}
          <div className={styles.logTable}>
            {/* 헤더 */}
            <div className={styles.logHeader}>
              <span className={styles.sentAtCell}>일시</span>
              <span className={styles.statusCell}>상태</span>
              <span className={styles.modeCell}>방식</span>
              <span className={styles.recipientCell}>수신자</span>
              <span className={styles.previewCell}>내용</span>
              <span className={styles.amountCell}>차감</span>
              <span className={styles.arrowCell} />
            </div>
            {/* 행 */}
            {filtered.map((item) => (
              <LogRow
                key={item.id}
                item={item}
                onClick={() => setSelectedItem(item)}
              />
            ))}
          </div>
          <PaginationBar
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={(p) => setCurrentPage(p)}
          />
        </>
      )}

      {/* 상세 팝업 */}
      <LogDetailModal
        item={selectedItem}
        open={!!selectedItem}
        onClose={() => setSelectedItem(null)}
      />
    </div>
  );
}
