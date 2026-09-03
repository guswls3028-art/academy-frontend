// PATH: src/app_admin/domains/messages/pages/MessageLogPage.tsx
// 알림톡 발송 기록 — provider lifecycle와 보안 projection을 그대로 설명한다.

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  CircleDashed,
  Clock3,
  LockKeyhole,
  MessageCircle,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import {
  Badge,
  Button,
  EmptyState,
  ICON,
  type BadgeTone,
} from "@/shared/ui/ds";
import { AdminModal, ModalHeader, ModalBody, ModalFooter } from "@/shared/ui/modal";
import { useConfirm } from "@/shared/ui/confirm";
import { feedback } from "@/shared/ui/feedback/feedback";
import { koreanDateTimeText, koreanFullDateTimeText } from "@/shared/utils/displayText";
import { useNotificationLog } from "../hooks/useNotificationLog";
import {
  AUTO_SEND_TRIGGER_LABELS,
  cancelScheduledNotification,
  fetchMessagingOperationsStatus,
  fetchNotificationLogDetail,
  fetchScheduledNotifications,
  type MessagingOperationsStatus,
  type NotificationLogItem,
  type NotificationLogStatus,
  type ScheduledNotificationItem,
} from "../api/messages.api";
import { messageQueryKeys } from "../queryKeys";
import styles from "./MessageLogPage.module.css";
import previewStyles from "./MessageLogPreview.module.css";

type StatusFilter = "all" | "sent" | "active" | "attention" | "failed";

type DeliveryState = {
  label: string;
  detail: string;
  tone: BadgeTone;
  icon: typeof CheckCircle2;
};

const PAGE_SIZE = 30;

const FILTER_OPTIONS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "sent", label: "접수 완료" },
  { key: "active", label: "진행 중" },
  { key: "attention", label: "확인 필요" },
  { key: "failed", label: "실패" },
];

const DELIVERY_STATES: Record<NotificationLogStatus, DeliveryState> = {
  processing: {
    label: "발송 준비 중",
    detail: "알림톡 발송 순서를 확보하고 있습니다.",
    tone: "info",
    icon: CircleDashed,
  },
  sending: {
    label: "접수 확인 중",
    detail: "카카오 공급사에 발송 요청을 전달하고 있습니다.",
    tone: "info",
    icon: Clock3,
  },
  sent: {
    label: "접수 완료",
    detail: "카카오 공급사가 발송 요청을 접수했습니다. 읽음 여부는 제공되지 않습니다.",
    tone: "success",
    icon: CheckCircle2,
  },
  retryable_failed: {
    label: "재시도 대기",
    detail: "공급사 호출 전에 일시적인 문제가 확인되어 자동 처리 순서를 기다립니다.",
    tone: "warning",
    icon: RefreshCw,
  },
  failed: {
    label: "발송 실패",
    detail: "발송이 확정적으로 완료되지 않았습니다. 아래 사유를 확인해 주세요.",
    tone: "danger",
    icon: XCircle,
  },
  ambiguous: {
    label: "결과 확인 필요",
    detail: "공급사 접수 여부가 불분명해 자동으로 다시 보내지 않습니다.",
    tone: "warning",
    icon: AlertTriangle,
  },
};

function deliveryState(item: NotificationLogItem): DeliveryState {
  if (item.status && item.status in DELIVERY_STATES) {
    return DELIVERY_STATES[item.status as NotificationLogStatus];
  }
  return item.success ? DELIVERY_STATES.sent : DELIVERY_STATES.failed;
}

function notificationLabel(item: NotificationLogItem): string {
  const template = item.template_summary?.trim();
  if (template && !template.startsWith("KA01")) return template;
  if (item.notification_type === "manual_send") return "직접 발송";
  return AUTO_SEND_TRIGGER_LABELS[item.notification_type || ""] || "알림톡 안내";
}

function amountLabel(item: NotificationLogItem): string {
  const amount = Number(item.amount_deducted || 0);
  return amount > 0 ? `${amount.toLocaleString()}원` : "차감 없음";
}

function formatAge(seconds: number | null) {
  if (seconds == null) return "기록 없음";
  if (seconds < 60) return `${seconds}초 전`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}분 전`;
  return `${Math.floor(seconds / 3600)}시간 전`;
}

function StatusMark({ item, size = "sm" }: { item: NotificationLogItem; size?: "sm" | "md" }) {
  const state = deliveryState(item);
  return (
    <Badge tone={state.tone} size={size} variant="soft" className={styles.statusBadge}>
      {state.label}
    </Badge>
  );
}

function OperationsStrip({
  status,
  loading,
}: {
  status?: MessagingOperationsStatus;
  loading: boolean;
}) {
  if (loading && !status) {
    return <div className={styles.operationsStrip}>알림톡 운영 상태를 확인하고 있습니다.</div>;
  }
  if (!status) {
    return <div className={styles.operationsStrip} data-tone="warning">운영 상태를 불러오지 못했습니다.</div>;
  }

  const unresolvedActionRequired = status.unresolved?.action_required ?? status.log_24h.ambiguous;
  const hasRisk = status.risks.length > 0
    || unresolvedActionRequired > 0
    || !["ok", "idle"].includes(status.worker.status);
  return (
    <section className={styles.operationsStrip} data-tone={hasRisk ? "warning" : "success"} aria-label="알림톡 운영 요약">
      <div className={styles.operationsLead}>
        <span className={styles.operationsIcon} aria-hidden>
          {hasRisk ? <AlertTriangle size={ICON.sm} /> : <ShieldCheck size={ICON.sm} />}
        </span>
        <span>
          <strong>{hasRisk ? "운영 확인 필요" : "알림톡 운영 정상"}</strong>
          <small>워커 기록 {formatAge(status.worker.age_seconds)}</small>
        </span>
      </div>
      <div className={styles.operationsFacts}>
        <span><strong>{status.log_24h.sent.toLocaleString()}</strong> 최근 24시간 접수</span>
        <span>
          <strong>{(
            status.log_24h.processing
            + status.log_24h.sending
            + status.log_24h.retryable_failed
          ).toLocaleString()}</strong> 진행 중
        </span>
        <span data-warning={unresolvedActionRequired > 0 ? "true" : undefined}>
          <strong>{unresolvedActionRequired.toLocaleString()}</strong> 미확정 전체
        </span>
        <span data-warning={status.log_24h.failed > 0 ? "true" : undefined}>
          <strong>{status.log_24h.failed.toLocaleString()}</strong> 실패
        </span>
      </div>
      {status.risks.length > 0 && (
        <div className={styles.operationsRisks}>
          {status.risks.slice(0, 2).map((risk) => (
            <span key={risk.code}>{risk.title}: {risk.detail}</span>
          ))}
        </div>
      )}
    </section>
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
      <span className={styles.scheduledTime}>{koreanDateTimeText(item.send_at)}</span>
      <span className={styles.scheduledRecipient}>{item.recipient_summary || "수신자 정보 없음"}</span>
      <span className={styles.scheduledPreview}>{item.message_preview || "내용 미리보기 없음"}</span>
      <Button size="sm" intent="secondary" onClick={onCancel} disabled={cancelling}>
        예약 취소
      </Button>
    </div>
  );
}

function LogRow({ item, onClick }: { item: NotificationLogItem; onClick: () => void }) {
  const state = deliveryState(item);
  return (
    <button type="button" onClick={onClick} className={styles.logRow} data-tone={state.tone}>
      <span className={styles.sentAtCell}>
        <span className={styles.mobileLabel}>로그 기록</span>
        {koreanDateTimeText(item.sent_at)}
      </span>
      <span className={styles.statusCell}><StatusMark item={item} /></span>
      <span className={styles.recipientCell}>
        <span className={styles.mobileLabel}>수신자</span>
        {item.recipient_summary || "수신자 정보 없음"}
      </span>
      <span className={styles.purposeCell}>
        <span className={styles.mobileLabel}>알림 종류</span>
        <span className={styles.purposeLabel}>
          <span className={styles.kakaoDot} aria-hidden>
            <MessageCircle size={10} fill="currentColor" />
          </span>
          <strong>{notificationLabel(item)}</strong>
        </span>
        {item.failure_reason && <small>{item.failure_reason}</small>}
      </span>
      <span className={styles.amountCell}>{amountLabel(item)}</span>
      <ChevronRight className={styles.arrowCell} size={ICON.sm} aria-hidden />
    </button>
  );
}

function DetailItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className={styles.detailItem}>
      <span>{label}</span>
      <strong>{children}</strong>
    </div>
  );
}

function BodyPanel({ item }: { item: NotificationLogItem }) {
  if (item.body_visibility === "sensitive_redacted") {
    return (
      <div className={styles.protectedBody}>
        <LockKeyhole size={ICON.lg} aria-hidden />
        <div>
          <strong>보안 알림 본문은 남기지 않습니다</strong>
          <p>아이디·임시 비밀번호·인증번호가 포함될 수 있어 보안을 위해 본문을 저장하지 않았습니다.</p>
        </div>
      </div>
    );
  }
  if (item.body_visibility === "restricted") {
    return (
      <div className={styles.protectedBody}>
        <LockKeyhole size={ICON.lg} aria-hidden />
        <div>
          <strong>본문 열람 권한이 제한되어 있습니다</strong>
          <p>계정과 개인정보 보호를 위해 학원장·관리자 권한에서만 저장된 본문을 볼 수 있습니다.</p>
        </div>
      </div>
    );
  }
  if (item.body_visibility === "available" && item.message_body) {
    return <div className={styles.messageBody}>{item.message_body}</div>;
  }
  return (
    <div className={styles.emptyMessageBody}>
      이 기록에는 저장된 본문이 없습니다. 알림 종류와 처리 상태를 확인해 주세요.
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
  const detailQ = useQuery({
    queryKey: messageQueryKeys.logDetail(item?.id ?? 0),
    queryFn: () => fetchNotificationLogDetail(item!.id),
    enabled: open && Boolean(item),
    staleTime: 30 * 1000,
  });
  const providerQ = useQuery({
    queryKey: messageQueryKeys.logProviderDelivery(item?.id ?? 0),
    queryFn: () => fetchNotificationLogDetail(item!.id, { verify_provider: true }),
    enabled: false,
    retry: false,
  });
  if (!item) return null;

  const detail = providerQ.data ?? detailQ.data ?? item;
  const state = deliveryState(detail);
  const StateIcon = state.icon;
  const providerStatus = providerQ.data?.provider_delivery_status;
  const providerState = providerStatus === "delivered"
    ? { label: "최종 전달 확인", tone: "success" as const, detail: "공급사가 최종 전달 완료로 보고했습니다." }
    : providerStatus === "failed"
      ? { label: "최종 전달 실패", tone: "danger" as const, detail: "공급사가 최종 전달 실패로 보고했습니다." }
      : providerStatus === "provider_accepted"
        ? { label: "공급사 접수", tone: "info" as const, detail: "공급사 접수는 확인됐지만 최종 전달 완료 상태는 아닙니다." }
        : providerStatus === "unavailable"
          ? { label: "최종 상태 확인 불가", tone: "warning" as const, detail: "공급사 최종 상태를 확인할 수 없습니다." }
          : null;

  return (
    <AdminModal open={open} onClose={onClose} type="inspect" width={820} noMinimize className={styles.detailModal}>
      <ModalHeader
        title="알림톡 발송 기록"
        description={`${koreanFullDateTimeText(detail.sent_at)} 로그 기록`}
        type="inspect"
      />
      <ModalBody>
        <div className={styles.modalContent}>
          <div className={previewStyles.detailLayout}>
            <section className={previewStyles.chatPreview} aria-label="카카오 알림톡 미리보기">
              <header className={previewStyles.chatPreviewHeader}>
                <span className={previewStyles.chatPreviewIcon} aria-hidden>
                  <MessageCircle size={18} fill="currentColor" />
                </span>
                <span>
                  <strong>카카오 알림톡 미리보기</strong>
                  <small>{detail.recipient_summary || "수신자 정보 없음"}</small>
                </span>
                <Badge tone="info" size="sm">알림톡</Badge>
              </header>
              <div className={previewStyles.chatRoom}>
                <span className={previewStyles.chatDate}>{koreanFullDateTimeText(detail.sent_at)}</span>
                <div className={previewStyles.chatMessageRow}>
                  <span className={previewStyles.chatAvatar} aria-hidden>
                    <MessageCircle size={17} fill="currentColor" />
                  </span>
                  <div className={previewStyles.chatMessageColumn}>
                    <span className={previewStyles.chatSender}>우리 학원 알림톡</span>
                    <div className={previewStyles.chatBubble}>
                      <span className={previewStyles.chatTemplate}>알림톡 · {notificationLabel(detail)}</span>
                      <strong>{notificationLabel(detail)}</strong>
                      {detailQ.isLoading ? (
                        <div className={styles.bodyLoading}>저장된 본문 기록을 확인하고 있습니다.</div>
                      ) : detailQ.isError ? (
                        <div className={styles.bodyError}>
                          <span>본문 기록을 불러오지 못했습니다.</span>
                          <Button size="sm" intent="secondary" onClick={() => void detailQ.refetch()}>다시 시도</Button>
                        </div>
                      ) : (
                        <BodyPanel item={detail} />
                      )}
                    </div>
                    <span className={previewStyles.chatTime}>{koreanDateTimeText(detail.sent_at)}</span>
                  </div>
                </div>
              </div>
            </section>

            <aside className={previewStyles.deliveryAudit} aria-label="발송 처리 정보">
              <section className={styles.deliveryHero} data-tone={state.tone}>
                <span className={styles.deliveryHeroIcon} aria-hidden><StateIcon size={ICON.xl} /></span>
                <div className={styles.deliveryHeroCopy}>
                  <div><StatusMark item={detail} size="md" /></div>
                  <strong>{state.detail}</strong>
                </div>
                {Number(detail.amount_deducted || 0) > 0 && (
                  <span className={styles.deliveryCost}>{amountLabel(detail)} 차감</span>
                )}
              </section>

              <section className={styles.detailGrid} aria-label="발송 기본 정보">
                <DetailItem label="수신자">{detail.recipient_summary || "정보 없음"}</DetailItem>
                <DetailItem label="알림 종류">{notificationLabel(detail)}</DetailItem>
                <DetailItem label="로그 기록">{koreanFullDateTimeText(detail.sent_at)}</DetailItem>
                <DetailItem label="처리 시작">
                  {detail.claimed_at ? koreanFullDateTimeText(detail.claimed_at) : "기록 없음"}
                </DetailItem>
              </section>

              <section className={styles.evidenceRow} data-confirmed={detail.provider_evidence ? "true" : "false"}>
                <MessageCircle size={ICON.md} aria-hidden />
                <span>
                  <strong>{detail.provider_evidence ? "공급사 접수 기록 있음" : "공급사 접수 기록 없음"}</strong>
                  <small>
                    {detail.provider_evidence
                      ? `${detail.provider_message_id || detail.provider_message_reference || "식별 정보 보호됨"} · 접수 기록은 읽음 확인을 뜻하지 않습니다.`
                      : "아직 공급사 접수 근거가 기록되지 않았습니다."}
                  </small>
                </span>
              </section>

              <section className={styles.evidenceRow} data-confirmed={providerStatus === "delivered" ? "true" : "false"} aria-live="polite">
                <RefreshCw size={ICON.md} aria-hidden />
                <span>
                  <strong>{providerState?.label ?? "최종 전달 상태 미확인"}</strong>
                  <small>
                    {providerState
                      ? (detail.provider_delivery_failure_reason || providerState.detail)
                      : "공급사 접수 기록과 최종 전달 상태는 다를 수 있습니다."}
                  </small>
                </span>
                <Button
                  size="sm"
                  intent="secondary"
                  disabled={providerQ.isFetching}
                  onClick={() => void providerQ.refetch()}
                >
                  {providerQ.isFetching ? "확인 중" : "최종 상태 확인"}
                </Button>
              </section>

              {detail.failure_reason && (
                <section className={styles.failurePanel}>
                  <AlertTriangle size={ICON.md} aria-hidden />
                  <span><strong>확인할 내용</strong><small>{detail.failure_reason}</small></span>
                </section>
              )}
            </aside>
          </div>
        </div>
      </ModalBody>
      <ModalFooter right={<Button size="md" onClick={onClose}>닫기</Button>} />
    </AdminModal>
  );
}

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
  for (let page = 1; page <= totalPages; page += 1) {
    if (page === 1 || page === totalPages || Math.abs(page - currentPage) <= 2) pages.push(page);
    else if (pages[pages.length - 1] !== "...") pages.push("...");
  }
  return (
    <nav className={styles.pagination} aria-label="발송 기록 페이지">
      <button type="button" disabled={currentPage === 1} onClick={() => onPageChange(currentPage - 1)} className={styles.paginationButton} aria-label="이전 페이지">‹</button>
      {pages.map((page, index) => page === "..." ? (
        <span key={`dots-${index}`} className={styles.paginationDots}>…</span>
      ) : (
        <button key={page} type="button" onClick={() => onPageChange(page)} className={styles.paginationButton} data-active={page === currentPage} aria-current={page === currentPage ? "page" : undefined}>{page}</button>
      ))}
      <button type="button" disabled={currentPage === totalPages} onClick={() => onPageChange(currentPage + 1)} className={styles.paginationButton} aria-label="다음 페이지">›</button>
    </nav>
  );
}

export default function MessageLogPage() {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedItem, setSelectedItem] = useState<NotificationLogItem | null>(null);
  const { data, isLoading, isError, refetch } = useNotificationLog({
    page: currentPage,
    page_size: PAGE_SIZE,
    status: statusFilter === "all" ? undefined : statusFilter,
  });
  const { data: scheduledData } = useQuery({
    queryKey: messageQueryKeys.scheduledPending,
    queryFn: () => fetchScheduledNotifications({ status: "pending", page_size: 50 }),
    staleTime: 10 * 1000,
  });
  const { data: operationsStatus, isLoading: operationsLoading } = useQuery({
    queryKey: messageQueryKeys.operationsStatus,
    queryFn: fetchMessagingOperationsStatus,
    staleTime: 15 * 1000,
    refetchInterval: 30 * 1000,
  });
  const cancelMut = useMutation({
    mutationFn: cancelScheduledNotification,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: messageQueryKeys.scheduledPending });
      qc.invalidateQueries({ queryKey: messageQueryKeys.operationsStatus });
      feedback.success("예약 발송이 취소되었습니다.");
    },
    onError: () => feedback.error("예약 발송 취소에 실패했습니다."),
  });

  const results = data?.results ?? [];
  const pendingScheduled = scheduledData?.results ?? [];
  const count = data?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));

  const handleCancelScheduled = async (item: ScheduledNotificationItem) => {
    const ok = await confirm({
      title: "예약 발송 취소",
      message: `${koreanDateTimeText(item.send_at)}에 예약된 ${item.recipient_summary || "알림톡"} 발송을 취소할까요?`,
      confirmText: "예약 취소",
      cancelText: "유지",
      danger: true,
    });
    if (ok) cancelMut.mutate(item.id);
  };

  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>카카오 알림톡 · 발송 기록</span>
          <h1 className={styles.title}>발송 내역</h1>
          <p className={styles.description}>
            알림톡 요청이 어디까지 처리됐는지 확인합니다.
            {!isLoading && <span className={styles.countText}>총 {count.toLocaleString()}건</span>}
          </p>
        </div>
        <div className={styles.filterGroup} aria-label="발송 상태 필터">
          {FILTER_OPTIONS.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => { setStatusFilter(option.key); setCurrentPage(1); }}
              className={styles.filterButton}
              data-active={statusFilter === option.key}
              aria-pressed={statusFilter === option.key}
            >
              {option.label}
            </button>
          ))}
        </div>
      </header>

      <OperationsStrip status={operationsStatus} loading={operationsLoading} />

      {pendingScheduled.length > 0 && (
        <section className={styles.scheduledPanel} aria-label="예약 발송">
          <div className={styles.scheduledHeader}>
            <div><strong>예약 발송</strong><span>발송 전 예약만 표시합니다.</span></div>
            <Badge tone="info" size="sm">{pendingScheduled.length.toLocaleString()}건 대기</Badge>
          </div>
          <div className={styles.scheduledList}>
            {pendingScheduled.map((item) => (
              <ScheduledRow key={item.id} item={item} cancelling={cancelMut.isPending} onCancel={() => handleCancelScheduled(item)} />
            ))}
          </div>
        </section>
      )}

      {isError ? (
        <EmptyState
          title="발송 내역을 불러오지 못했습니다"
          description="기록이 없는 것으로 표시하지 않았습니다. 잠시 후 다시 시도해 주세요."
          tone="error"
          scope="panel"
          actions={<Button intent="secondary" size="sm" onClick={() => void refetch()}>다시 시도</Button>}
        />
      ) : isLoading ? (
        <div className={styles.loadingList} aria-label="발송 기록 불러오는 중">
          {[1, 2, 3, 4, 5].map((item) => <div key={item} className={styles.skeletonRow} />)}
        </div>
      ) : results.length === 0 ? (
        <EmptyState
          title={statusFilter === "all" ? "발송 내역이 없습니다" : `${FILTER_OPTIONS.find((item) => item.key === statusFilter)?.label} 기록이 없습니다`}
          description={statusFilter === "all" ? "알림톡을 발송하면 처리 결과가 이곳에 기록됩니다." : "다른 상태 필터를 선택해 보세요."}
          tone="empty"
          scope="panel"
        />
      ) : (
        <>
          <section className={styles.logTable} aria-label="알림톡 발송 기록">
            <div className={styles.logHeader} aria-hidden>
              <span>로그 기록</span><span>처리 상태</span><span>수신자</span><span>알림 종류</span><span>차감</span><span />
            </div>
            <div className={styles.logList}>
              {results.map((item) => <LogRow key={item.id} item={item} onClick={() => setSelectedItem(item)} />)}
            </div>
          </section>
          <PaginationBar currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
        </>
      )}

      <LogDetailModal item={selectedItem} open={Boolean(selectedItem)} onClose={() => setSelectedItem(null)} />
    </div>
  );
}
