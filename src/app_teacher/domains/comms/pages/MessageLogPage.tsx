// PATH: src/app_teacher/domains/comms/pages/MessageLogPage.tsx
// 발송 이력 — 메시지 로그 조회 페이지
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { EmptyState } from "@/shared/ui/ds";
import { ChevronLeft, Check, X, MessageSquare } from "@teacher/shared/ui/Icons";
import { Card } from "@teacher/shared/ui/Card";
import { Badge } from "@teacher/shared/ui/Badge";
import { fetchMessageLog, type MessageLogItem } from "../api";

export default function MessageLogPage() {
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ["teacher-message-log"],
    queryFn: () => fetchMessageLog(1, 50),
  });

  const items = data?.results ?? [];

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center gap-2 py-0.5">
        <button onClick={() => navigate(-1)} className="flex p-1 cursor-pointer"
          style={{ background: "none", border: "none", color: "var(--tc-text-secondary)" }}>
          <ChevronLeft size={20} />
        </button>
        <h1 className="text-[17px] font-bold" style={{ color: "var(--tc-text)" }}>발송 이력</h1>
        <span className="text-[12px]" style={{ color: "var(--tc-text-muted)" }}>
          {data ? `${data.count}건` : ""}
        </span>
      </div>

      {isLoading ? (
        <EmptyState scope="panel" tone="loading" title="불러오는 중…" />
      ) : items.length === 0 ? (
        <EmptyState scope="panel" tone="empty" title="발송 이력이 없습니다" />
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((item) => (
            <LogCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

function LogCard({ item }: { item: MessageLogItem }) {
  const modeLabel = item.message_mode === "alimtalk" ? "알림톡" : "SMS";
  const sentDate = new Date(item.sent_at);

  return (
    <Card style={{ padding: "var(--tc-space-3) var(--tc-space-4)" }}>
      <div className="flex items-start gap-2">
        <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
          style={{ background: item.success ? "var(--tc-success-bg)" : "var(--tc-danger-bg)" }}>
          {item.success
            ? <Check size={14} style={{ color: "var(--tc-success)" }} />
            : <X size={14} style={{ color: "var(--tc-danger)" }} />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <Badge tone={item.success ? "success" : "danger"} size="xs">{item.success ? "성공" : "실패"}</Badge>
            <Badge tone="neutral" size="xs">{modeLabel}</Badge>
            {item.amount_deducted && item.amount_deducted !== "0" && (
              <span className="text-[10px]" style={{ color: "var(--tc-text-muted)" }}>-{item.amount_deducted}원</span>
            )}
          </div>
          <div className="text-sm font-medium truncate" style={{ color: "var(--tc-text)" }}>
            {item.template_summary || item.recipient_summary || "메시지"}
          </div>
          {item.recipient_summary && item.template_summary && (
            <div className="text-[12px] truncate" style={{ color: "var(--tc-text-secondary)" }}>
              수신: {item.recipient_summary}
            </div>
          )}
          {item.message_body && (
            <div className="text-[12px] mt-1 line-clamp-2" style={{ color: "var(--tc-text-muted)" }}>
              {item.message_body}
            </div>
          )}
          {!item.success && item.failure_reason && (
            <div className="text-[11px] mt-1" style={{ color: "var(--tc-danger)" }}>
              사유: {item.failure_reason}
            </div>
          )}
          <div className="text-[11px] mt-1" style={{ color: "var(--tc-text-muted)" }}>
            {sentDate.toLocaleDateString("ko-KR")} {sentDate.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
          </div>
        </div>
      </div>
    </Card>
  );
}
