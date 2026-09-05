/* eslint-disable no-restricted-syntax */
// PATH: src/app_teacher/domains/comms/pages/MessageLogPage.tsx
// 발송 이력 — 메시지 로그 조회 페이지
//
// 현재 tenant의 모든 직원은 실제 수신자와 공급사 접수 증거를 확인한다.
// 계정/인증 비밀과 공급사 오류 원문은 backend 저장·투영 단계에서 제거된다.
import { useNavigate } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { EmptyState , ICON } from "@/shared/ui/ds";
import { ChevronLeft, Check, X } from "@teacher/shared/ui/Icons";
import { Card } from "@teacher/shared/ui/Card";
import { Badge } from "@teacher/shared/ui/Badge";
import { EmptyActionButton } from "@teacher/shared/ui/EmptyActionButton";
import { fetchMessageLog, type MessageLogItem } from "../api";
import { teacherCommsQueryKeys } from "../queryKeys";

export default function MessageLogPage() {
  const navigate = useNavigate();

  const logQ = useQuery({
    queryKey: teacherCommsQueryKeys.messageLog,
    queryFn: () => fetchMessageLog(1, 50),
  });
  const data = logQ.data;
  const isLoading = logQ.isLoading;

  const items = data?.results ?? [];

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center gap-2 py-0.5">
        <button onClick={() => navigate(-1)} className="flex p-1 cursor-pointer"
          style={{ background: "none", border: "none", color: "var(--tc-text-secondary)" }}>
          <ChevronLeft size={ICON.lg} />
        </button>
        <h1 className="text-[17px] font-bold" style={{ color: "var(--tc-text)" }}>발송 내역</h1>
        <span className="text-[12px]" style={{ color: "var(--tc-text-muted)" }}>
          {data ? `${data.count}건` : ""}
        </span>
      </div>

      {isLoading ? (
        <EmptyState scope="panel" tone="loading" title="불러오는 중…" />
      ) : logQ.isError ? (
        <EmptyState scope="panel" tone="error" title="발송 내역을 불러오지 못했습니다" description="발송 내역이 없는 것으로 표시하지 않았습니다." actions={<EmptyActionButton onClick={() => void logQ.refetch()}>다시 시도</EmptyActionButton>} />
      ) : items.length === 0 ? (
        <EmptyState
          scope="panel"
          tone="empty"
          title="발송 내역이 없습니다"
          description="학생을 선택해 알림톡을 보내면 성공·실패 결과가 이곳에 기록됩니다."
          actions={
            <EmptyActionButton onClick={() => navigate("/workspace/mobile/students", { state: { startSelectMode: true, preferredMessageTiming: "now" } })}>
              학생 선택 발송
            </EmptyActionButton>
          }
        />
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
  const modeLabel = item.message_mode === "alimtalk"
    ? "알림톡"
    : item.message_mode === "sms"
      ? "문자 발송 차단(레거시)"
      : "알 수 없는 발송 방식";
  const sentDate = new Date(item.sent_at);

  return (
    <Card style={{ padding: "var(--tc-space-3) var(--tc-space-4)" }}>
      <div className="flex items-start gap-2">
        <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
          style={{ background: item.success ? "var(--tc-success-bg)" : "var(--tc-danger-bg)" }}>
          {item.success
            ? <Check size={ICON.md} style={{ color: "var(--tc-success)" }} />
            : <X size={ICON.md} style={{ color: "var(--tc-danger)" }} />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <Badge tone={item.success ? "success" : "danger"} size="xs">{item.success ? "성공" : "실패"}</Badge>
            <Badge tone="neutral" size="xs">{modeLabel}</Badge>
            {Number(item.amount_deducted ?? 0) > 0 && (
              <span className="text-[10px]" style={{ color: "var(--tc-text-muted)" }}>-{Number(item.amount_deducted).toLocaleString()}원</span>
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
          {item.provider_evidence && (
            <div className="text-[11px] mt-1" style={{ color: "var(--tc-text-muted)" }}>
              공급사 증거: {item.provider_message_id || "접수 식별자 확인됨"}
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
