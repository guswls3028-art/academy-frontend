// PATH: src/features/messages/pages/MessageLogPage.tsx
// 발송 내역 — 성공/실패 여부, 차감 금액 리스트 + 상태 필터

import { useState } from "react";
import { Table } from "antd";
import type { ColumnsType } from "antd/es/table";
import { Panel, EmptyState } from "@/shared/ui/ds";
import { useNotificationLog } from "../hooks/useNotificationLog";
import type { NotificationLogItem } from "../api/messages.api";

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

type StatusFilter = "all" | "success" | "failure";

const FILTER_OPTIONS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "success", label: "성공" },
  { key: "failure", label: "실패" },
];

function StatusBadge({ success }: { success: boolean }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "2px 9px",
        borderRadius: "var(--radius-md)",
        fontSize: 12,
        fontWeight: 600,
        background: success
          ? "color-mix(in srgb, var(--color-success) 12%, transparent)"
          : "color-mix(in srgb, var(--color-error) 12%, transparent)",
        color: success ? "var(--color-success)" : "var(--color-error)",
      }}
    >
      {success ? "성공" : "실패"}
    </span>
  );
}

export default function MessageLogPage() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const { data, isLoading } = useNotificationLog({ page: 1, page_size: 50 });
  const results = data?.results ?? [];
  const count = data?.count ?? 0;

  const filtered =
    statusFilter === "all"
      ? results
      : results.filter((r) =>
          statusFilter === "success" ? r.success : !r.success
        );

  const columns: ColumnsType<NotificationLogItem> = [
    {
      title: "발송 일시",
      dataIndex: "sent_at",
      key: "sent_at",
      width: 158,
      render: (v: string) => (
        <span style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>
          {formatDate(v)}
        </span>
      ),
    },
    {
      title: "수신자",
      key: "recipient",
      ellipsis: true,
      render: (_: unknown, r: NotificationLogItem) => (
        <span style={{ fontSize: 13, color: "var(--color-text-primary)" }}>
          {r.recipient_summary ?? "—"}
        </span>
      ),
    },
    {
      title: "템플릿",
      dataIndex: "template_summary",
      key: "template_summary",
      ellipsis: true,
      render: (v: string | undefined) => (
        <span style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>
          {v ?? "—"}
        </span>
      ),
    },
    {
      title: "결과",
      dataIndex: "success",
      key: "success",
      width: 82,
      render: (success: boolean) => <StatusBadge success={success} />,
    },
    {
      title: "차감",
      dataIndex: "amount_deducted",
      key: "amount_deducted",
      width: 90,
      align: "right" as const,
      render: (v: string) => (
        <span style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>
          {v ? `${Number(v).toLocaleString()}원` : "—"}
        </span>
      ),
    },
    {
      title: "비고",
      dataIndex: "failure_reason",
      key: "failure_reason",
      width: 320,
      render: (v: string | null | undefined) =>
        v ? (
          <span
            style={{
              fontSize: 12,
              color: "var(--color-error)",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {v}
          </span>
        ) : (
          <span style={{ color: "var(--color-text-muted)", fontSize: 13 }}>—</span>
        ),
    },
  ];

  const filterBar = (
    <div style={{ display: "flex", gap: 4 }}>
      {FILTER_OPTIONS.map((opt) => (
        <button
          key={opt.key}
          type="button"
          onClick={() => setStatusFilter(opt.key)}
          style={{
            padding: "4px 12px",
            borderRadius: "var(--radius-md)",
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
  );

  return (
    <Panel
      variant="primary"
      title="발송 내역"
      description="SMS·알림톡 발송 이력과 성공/실패, 차감 금액을 확인할 수 있습니다."
      right={!isLoading && results.length > 0 ? filterBar : undefined}
    >
      {isLoading ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-2)",
          }}
        >
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              style={{
                height: 44,
                borderRadius: "var(--radius-md)",
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
        <Table
          rowKey="id"
          columns={columns}
          dataSource={filtered}
          pagination={
            count <= (data?.results?.length ?? 0)
              ? false
              : { total: count, pageSize: 50, showSizeChanger: false }
          }
          size="small"
          style={{ marginTop: 4 }}
        />
      )}
    </Panel>
  );
}
