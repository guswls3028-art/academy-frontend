// PATH: src/features/messages/pages/MessageLogPage.tsx
// 발송 내역 — 성공/실패 여부, 차감 금액 리스트

import { Table } from "antd";
import type { ColumnsType } from "antd/es/table";
import { Section, SectionHeader, EmptyState } from "@/shared/ui/ds";
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

export default function MessageLogPage() {
  const { data, isLoading } = useNotificationLog({ page: 1, page_size: 50 });
  const results = data?.results ?? [];
  const count = data?.count ?? 0;

  const columns: ColumnsType<NotificationLogItem> = [
    {
      title: "발송 일시",
      dataIndex: "sent_at",
      key: "sent_at",
      width: 160,
      render: (v: string) => formatDate(v),
    },
    {
      title: "수신자 / 요약",
      key: "recipient",
      ellipsis: true,
      render: (_, r) => r.recipient_summary ?? "—",
    },
    {
      title: "템플릿",
      dataIndex: "template_summary",
      key: "template_summary",
      ellipsis: true,
      render: (v: string | undefined) => v ?? "—",
    },
    {
      title: "결과",
      dataIndex: "success",
      key: "success",
      width: 90,
      render: (success: boolean) => (
        <span
          style={{
            display: "inline-block",
            padding: "2px 8px",
            borderRadius: "var(--radius-md)",
            fontSize: 12,
            fontWeight: 600,
            background: success
              ? "color-mix(in srgb, var(--color-success) 14%, transparent)"
              : "color-mix(in srgb, var(--color-error) 14%, transparent)",
            color: success ? "var(--color-success)" : "var(--color-error)",
          }}
        >
          {success ? "성공" : "실패"}
        </span>
      ),
    },
    {
      title: "차감 금액",
      dataIndex: "amount_deducted",
      key: "amount_deducted",
      width: 100,
      align: "right",
      render: (v: string) =>
        v ? `${Number(v).toLocaleString()}원` : "—",
    },
    {
      title: "비고",
      dataIndex: "failure_reason",
      key: "failure_reason",
      render: (v: string | null | undefined) =>
        v ? (
          <span
            style={{
              color: "var(--color-error)",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {v}
          </span>
        ) : (
          "—"
        ),
    },
  ];

  return (
    <Section>
      <SectionHeader
        title="발송 내역"
        description="알림톡 발송 이력과 성공/실패, 차감 금액을 확인할 수 있습니다."
      />
      {isLoading ? (
        <div className="p-8 text-center text-[var(--color-text-muted)] text-sm">
          불러오는 중…
        </div>
      ) : results.length === 0 ? (
        <EmptyState
          title="발송 내역이 없습니다"
          description="알림톡을 발송하면 이곳에 기록됩니다."
          tone="empty"
          scope="panel"
        />
      ) : (
        <Table
          rowKey="id"
          columns={columns}
          dataSource={results}
          pagination={
            count <= (data?.results?.length ?? 0)
              ? false
              : { total: count, pageSize: 50, showSizeChanger: false }
          }
          size="small"
          style={{ marginTop: 8 }}
        />
      )}
    </Section>
  );
}
