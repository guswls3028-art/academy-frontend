// PATH: src/features/messages/pages/MessageLogPage.tsx
// 발송 내역 — 카드형 리스트 + 상세 팝업 (디자인 강화, 모든 데이터 표시)

import { useState } from "react";
import { EmptyState } from "@/shared/ui/ds";
import { AdminModal, ModalHeader, ModalBody, ModalFooter } from "@/shared/ui/modal";
import { Button } from "@/shared/ui/ds";
import { useNotificationLog } from "../hooks/useNotificationLog";
import type { NotificationLogItem } from "../api/messages.api";

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
  sms: "SMS",
  alimtalk: "알림톡",
  both: "알림톡 → SMS",
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
  const isMd = size === "md";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: isMd ? "3px 12px" : "2px 9px",
        borderRadius: 999,
        fontSize: isMd ? 13 : 12,
        fontWeight: 600,
        background: success
          ? "color-mix(in srgb, var(--color-success) 12%, transparent)"
          : "color-mix(in srgb, var(--color-error) 12%, transparent)",
        color: success ? "var(--color-success)" : "var(--color-error)",
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: 999,
          background: "currentColor",
          flexShrink: 0,
        }}
      />
      {success ? "성공" : "실패"}
    </span>
  );
}

// ── ModeBadge ──

function ModeBadge({ mode }: { mode?: string }) {
  if (!mode) return null;
  const label = MESSAGE_MODE_LABELS[mode] ?? mode;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "2px 8px",
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 500,
        background: "color-mix(in srgb, var(--color-primary) 8%, transparent)",
        color: "var(--color-primary)",
        letterSpacing: "-0.1px",
      }}
    >
      {label}
    </span>
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
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        width: "100%",
        textAlign: "left",
        padding: "9px 14px",
        borderRadius: 0,
        border: "none",
        borderBottom: "1px solid var(--color-border-divider)",
        background: "transparent",
        cursor: "pointer",
        transition: "background 0.1s",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background =
          "color-mix(in srgb, var(--color-primary) 4%, transparent)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
      }}
    >
      {/* 일시 */}
      <span
        style={{
          flex: "0 0 140px",
          fontSize: 12,
          color: "var(--color-text-muted)",
          fontVariantNumeric: "tabular-nums",
          fontFamily: "var(--font-mono, monospace)",
          whiteSpace: "nowrap",
        }}
      >
        {formatDate(item.sent_at)}
      </span>

      {/* 상태 */}
      <span style={{ flex: "0 0 52px" }}>
        <StatusBadge success={item.success} />
      </span>

      {/* 발송방식 */}
      <span style={{ flex: "0 0 80px" }}>
        <ModeBadge mode={item.message_mode} />
      </span>

      {/* 수신자 */}
      <span
        style={{
          flex: "0 0 120px",
          fontSize: 13,
          fontWeight: 600,
          color: "var(--color-text-primary)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {item.recipient_summary || "—"}
      </span>

      {/* 내용 미리보기 */}
      <span
        style={{
          flex: 1,
          minWidth: 0,
          fontSize: 13,
          color: "var(--color-text-secondary)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {item.template_summary || item.message_body || "—"}
      </span>

      {/* 실패 사유 (짧게) */}
      {item.failure_reason ? (
        <span
          style={{
            flex: "0 0 auto",
            maxWidth: 160,
            fontSize: 11,
            color: "var(--color-error)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {item.failure_reason}
        </span>
      ) : null}

      {/* 차감 */}
      <span
        style={{
          flex: "0 0 70px",
          fontSize: 13,
          fontWeight: 600,
          color: "var(--color-text-secondary)",
          fontVariantNumeric: "tabular-nums",
          textAlign: "right",
        }}
      >
        {item.amount_deducted && Number(item.amount_deducted) > 0
          ? `-${Number(item.amount_deducted).toLocaleString()}원`
          : "—"}
      </span>

      {/* 화살표 */}
      <span style={{ flex: "0 0 16px", color: "var(--color-text-muted)", opacity: 0.4 }}>
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
    <div
      style={{
        display: "flex",
        gap: 12,
        padding: "10px 0",
        borderBottom: "1px solid var(--color-border-divider)",
        alignItems: "flex-start",
      }}
    >
      <span
        style={{
          flex: "0 0 90px",
          fontSize: 12,
          fontWeight: 600,
          color: "var(--color-text-muted)",
          paddingTop: 2,
        }}
      >
        {label}
      </span>
      <span
        style={{
          flex: 1,
          fontSize: 13,
          color: "var(--color-text-primary)",
          lineHeight: 1.5,
          wordBreak: "break-word",
          whiteSpace: "pre-wrap",
          ...(mono ? { fontFamily: "var(--font-mono, monospace)", fontSize: 12.5 } : {}),
        }}
      >
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
        <div style={{ padding: "4px 0" }}>
          {/* 상태 + 차감 요약 */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 16,
              padding: "12px 14px",
              borderRadius: "var(--radius-lg)",
              background: item.success
                ? "color-mix(in srgb, var(--color-success) 6%, transparent)"
                : "color-mix(in srgb, var(--color-error) 6%, transparent)",
              border: `1px solid ${
                item.success
                  ? "color-mix(in srgb, var(--color-success) 18%, transparent)"
                  : "color-mix(in srgb, var(--color-error) 18%, transparent)"
              }`,
            }}
          >
            <StatusBadge success={item.success} size="md" />
            {item.message_mode ? (
              <ModeBadge mode={item.message_mode} />
            ) : null}
            <span style={{ flex: 1 }} />
            <span
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: item.success ? "var(--color-success)" : "var(--color-error)",
                fontVariantNumeric: "tabular-nums",
              }}
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
          <div style={{ marginTop: 16 }}>
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "var(--color-text-muted)",
                marginBottom: 8,
              }}
            >
              발송 내용
            </div>
            {item.message_body ? (
              <div
                style={{
                  padding: "14px 16px",
                  borderRadius: "var(--radius-lg)",
                  border: "1px solid var(--color-border-divider)",
                  background: "var(--color-bg-surface-soft)",
                  fontSize: 13,
                  color: "var(--color-text-primary)",
                  lineHeight: 1.65,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  maxHeight: 280,
                  overflowY: "auto",
                }}
              >
                {item.message_body}
              </div>
            ) : (
              <div
                style={{
                  padding: "24px 16px",
                  borderRadius: "var(--radius-lg)",
                  border: "1px dashed var(--color-border-divider)",
                  textAlign: "center",
                  fontSize: 13,
                  color: "var(--color-text-muted)",
                }}
              >
                본문 정보가 없습니다
              </div>
            )}
          </div>

          {/* 실패 사유 */}
          {item.failure_reason ? (
            <div style={{ marginTop: 16 }}>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "var(--color-error)",
                  marginBottom: 8,
                }}
              >
                실패 사유
              </div>
              <div
                style={{
                  padding: "12px 14px",
                  borderRadius: "var(--radius-lg)",
                  background: "color-mix(in srgb, var(--color-error) 6%, transparent)",
                  border: "1px solid color-mix(in srgb, var(--color-error) 15%, transparent)",
                  fontSize: 13,
                  color: "var(--color-error)",
                  lineHeight: 1.55,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}
              >
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
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 4,
        marginTop: 16,
      }}
    >
      <button
        type="button"
        disabled={currentPage === 1}
        onClick={() => onPageChange(currentPage - 1)}
        style={{
          width: 32,
          height: 32,
          borderRadius: "var(--radius-md)",
          border: "1px solid var(--color-border-divider)",
          background: "transparent",
          cursor: currentPage === 1 ? "default" : "pointer",
          opacity: currentPage === 1 ? 0.35 : 1,
          display: "grid",
          placeItems: "center",
          color: "var(--color-text-secondary)",
          fontSize: 14,
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
      {pages.map((p, i) =>
        p === "..." ? (
          <span key={`dots-${i}`} style={{ width: 32, textAlign: "center", color: "var(--color-text-muted)", fontSize: 13 }}>
            ...
          </span>
        ) : (
          <button
            key={p}
            type="button"
            onClick={() => onPageChange(p)}
            style={{
              width: 32,
              height: 32,
              borderRadius: "var(--radius-md)",
              border: `1px solid ${p === currentPage ? "var(--color-primary)" : "var(--color-border-divider)"}`,
              background: p === currentPage
                ? "color-mix(in srgb, var(--color-primary) 10%, transparent)"
                : "transparent",
              color: p === currentPage ? "var(--color-primary)" : "var(--color-text-secondary)",
              fontWeight: p === currentPage ? 600 : 400,
              fontSize: 13,
              cursor: "pointer",
              transition: "all 0.12s",
            }}
          >
            {p}
          </button>
        )
      )}
      <button
        type="button"
        disabled={currentPage === totalPages}
        onClick={() => onPageChange(currentPage + 1)}
        style={{
          width: 32,
          height: 32,
          borderRadius: "var(--radius-md)",
          border: "1px solid var(--color-border-divider)",
          background: "transparent",
          cursor: currentPage === totalPages ? "default" : "pointer",
          opacity: currentPage === totalPages ? 0.35 : 1,
          display: "grid",
          placeItems: "center",
          color: "var(--color-text-secondary)",
          fontSize: 14,
        }}
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
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedItem, setSelectedItem] = useState<NotificationLogItem | null>(null);
  const { data, isLoading, isError } = useNotificationLog({ page: currentPage, page_size: PAGE_SIZE });
  const results = data?.results ?? [];
  const count = data?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));

  const filtered =
    statusFilter === "all"
      ? results
      : results.filter((r) =>
          statusFilter === "success" ? r.success : !r.success
        );

  const handleFilterChange = (key: StatusFilter) => {
    setStatusFilter(key);
    setCurrentPage(1);
  };

  return (
    <div
      style={{
        borderRadius: "var(--radius-lg)",
        padding: "var(--space-5)",
        border: "1px solid var(--color-border-divider)",
        background: "var(--color-bg-surface)",
      }}
    >
      {/* 헤더 */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: "var(--space-4)",
          marginBottom: 16,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div
            style={{
              fontWeight: 700,
              fontSize: 16,
              color: "var(--color-text-primary)",
              marginBottom: 4,
              letterSpacing: "-0.2px",
            }}
          >
            발송 내역
          </div>
          <div style={{ fontSize: 13, color: "var(--color-text-muted)" }}>
            SMS·알림톡 발송 이력과 성공/실패, 차감 금액을 확인할 수 있습니다.
            {!isLoading && count > 0 ? (
              <span style={{ marginLeft: 8, color: "var(--color-text-secondary)" }}>
                총 {count.toLocaleString()}건
              </span>
            ) : null}
          </div>
        </div>

        {/* 필터 */}
        {!isLoading && results.length > 0 ? (
          <div style={{ display: "flex", gap: 4 }}>
            {FILTER_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => handleFilterChange(opt.key)}
                style={{
                  padding: "5px 14px",
                  borderRadius: 999,
                  border: `1px solid ${
                    statusFilter === opt.key
                      ? "var(--color-primary)"
                      : "var(--color-border-divider)"
                  }`,
                  background:
                    statusFilter === opt.key
                      ? "color-mix(in srgb, var(--color-primary) 10%, transparent)"
                      : "transparent",
                  color:
                    statusFilter === opt.key
                      ? "var(--color-primary)"
                      : "var(--color-text-secondary)",
                  fontSize: 13,
                  fontWeight: statusFilter === opt.key ? 600 : 400,
                  cursor: "pointer",
                  transition: "all 0.12s",
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        ) : null}
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
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div
              key={i}
              style={{
                height: 38,
                borderRadius: "var(--radius-lg)",
                background:
                  "linear-gradient(90deg, var(--color-bg-surface-soft) 25%, color-mix(in srgb, var(--color-border-divider) 60%, var(--color-bg-surface-soft)) 50%, var(--color-bg-surface-soft) 75%)",
                backgroundSize: "200% 100%",
                animation: "shimmer 1.5s ease-in-out infinite",
              }}
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
          <div
            style={{
              borderRadius: "var(--radius-lg)",
              border: "1px solid var(--color-border-divider)",
              overflow: "hidden",
            }}
          >
            {/* 헤더 */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "8px 14px",
                background: "var(--color-bg-surface-soft)",
                borderBottom: "1px solid var(--color-border-divider)",
                fontSize: 11,
                fontWeight: 600,
                color: "var(--color-text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.3px",
              }}
            >
              <span style={{ flex: "0 0 140px" }}>일시</span>
              <span style={{ flex: "0 0 52px" }}>상태</span>
              <span style={{ flex: "0 0 80px" }}>방식</span>
              <span style={{ flex: "0 0 120px" }}>수신자</span>
              <span style={{ flex: 1, minWidth: 0 }}>내용</span>
              <span style={{ flex: "0 0 70px", textAlign: "right" }}>차감</span>
              <span style={{ flex: "0 0 16px" }} />
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
