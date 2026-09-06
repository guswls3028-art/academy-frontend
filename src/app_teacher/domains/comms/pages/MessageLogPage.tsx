/* eslint-disable no-restricted-syntax */
// PATH: src/app_teacher/domains/comms/pages/MessageLogPage.tsx
// 발송 이력 — 메시지 로그 조회 페이지
//
// 보안 (시각 검수 H-11 / H-14 2026-05-12):
//   role=teacher/staff 는 수신자 이름·메시지 본문을 마스킹.
//   role=owner/admin 만 풀 정보 노출. 학원장 발신 메시지 본문에 학생 로그인
//   정보(아이디/비밀번호)가 포함될 수 있으므로 staff 권한자에게는 가림.
import { useNavigate } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { EmptyState , ICON } from "@/shared/ui/ds";
import { AlertTriangle, CheckCircle, ChevronLeft, Clock, RefreshCw, XCircle } from "@teacher/shared/ui/Icons";
import { Card } from "@teacher/shared/ui/Card";
import { Badge } from "@teacher/shared/ui/Badge";
import { EmptyActionButton } from "@teacher/shared/ui/EmptyActionButton";
import useAuth from "@/auth/hooks/useAuth";
import { fetchMessageLog, fetchMessageLogDetail, type MessageLogItem } from "../api";
import { teacherCommsQueryKeys } from "../queryKeys";

/** 한글 이름 마스킹: 박해환 → 박○○, 이연 → 이○. */
function maskName(name: string): string {
  if (!name) return "";
  const first = name.charAt(0);
  return first + "○".repeat(Math.max(name.length - 1, 1));
}

/** 발송 이력 수신 요약 마스킹. e.g. "이서연 0101****" → "이○○ 0101****" */
function maskRecipientSummary(s: string | null | undefined): string {
  if (!s) return "";
  // 한글 이름 토큰만 마스킹. 전화번호는 backend에서 이미 마스킹.
  return s.replace(/[가-힣]{2,}/g, (m) => maskName(m));
}

/** 비밀번호·로그인 정보 포함 본문은 staff 에게 본문 자체를 숨김. */
function isSensitiveBody(body: string | null | undefined): boolean {
  if (!body) return false;
  return /아이디|비밀번호|password|로그인 정보/i.test(body);
}

type LifecyclePresentation = {
  label: string;
  detail: string;
  tone: "success" | "danger" | "warning" | "info" | "neutral";
  icon: typeof CheckCircle;
};

function lifecyclePresentation(item: MessageLogItem): LifecyclePresentation {
  if (item.provider_delivery_status === "delivered") {
    return { label: "최종 전달", detail: "공급사가 최종 전달 완료로 보고했습니다.", tone: "success", icon: CheckCircle };
  }
  if (item.provider_delivery_status === "failed") {
    return { label: "최종 실패", detail: item.provider_delivery_failure_reason || "공급사가 최종 전달 실패로 보고했습니다.", tone: "danger", icon: XCircle };
  }
  switch (item.status) {
    case "processing":
      return { label: "요청됨", detail: "알림톡 발송 순서를 확보하고 있습니다.", tone: "info", icon: Clock };
    case "sending":
      return { label: "공급사 접수 확인 중", detail: "공급사 접수 결과를 확인하고 있습니다.", tone: "info", icon: Clock };
    case "retryable_failed":
      return { label: "재시도 대기", detail: "공급사 호출 전 일시적인 문제로 자동 재시도를 기다립니다.", tone: "warning", icon: RefreshCw };
    case "failed":
      return { label: "최종 실패", detail: item.failure_reason || "발송이 확정적으로 완료되지 않았습니다.", tone: "danger", icon: XCircle };
    case "ambiguous":
      return { label: "결과 확인 필요", detail: "공급사 접수 여부가 불분명해 자동으로 다시 보내지 않습니다.", tone: "warning", icon: AlertTriangle };
    case "sent":
      return { label: "공급사 접수", detail: "공급사가 요청을 접수했습니다. 최종 전달 완료와는 다른 상태입니다.", tone: "info", icon: CheckCircle };
    default:
      return item.success
        ? { label: "공급사 접수", detail: "과거 접수 기록입니다. 최종 전달 완료와는 다른 상태입니다.", tone: "info", icon: CheckCircle }
        : { label: "상태 확인 필요", detail: "정확한 처리 상태가 기록되지 않은 과거 이력입니다.", tone: "warning", icon: AlertTriangle };
  }
}

export default function MessageLogPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const role = (user?.tenantRole ?? "").toLowerCase();
  const isPrivileged = role === "owner" || role === "admin";

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
        <button
          type="button"
          onClick={() => void logQ.refetch()}
          disabled={logQ.isFetching}
          className="ml-auto min-h-9 px-3 rounded-lg flex items-center gap-1.5 text-[12px] font-bold cursor-pointer disabled:opacity-50"
          style={{ border: "1px solid var(--tc-border)", background: "var(--tc-surface)", color: "var(--tc-text-secondary)" }}
        >
          <RefreshCw size={ICON.sm} aria-hidden />
          {logQ.isFetching ? "불러오는 중" : "다시 불러오기"}
        </button>
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
          description="학생을 선택해 알림톡을 보내면 요청·공급사 접수·최종 전달 상태가 이곳에 기록됩니다."
          actions={
            <EmptyActionButton onClick={() => navigate("/workspace/mobile/students", { state: { startSelectMode: true, preferredMessageTiming: "now" } })}>
              학생 선택 발송
            </EmptyActionButton>
          }
        />
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((item) => (
            <LogCard key={item.id} item={item} isPrivileged={isPrivileged} />
          ))}
        </div>
      )}
    </div>
  );
}

function LogCard({ item, isPrivileged }: { item: MessageLogItem; isPrivileged: boolean }) {
  const providerQ = useQuery({
    queryKey: teacherCommsQueryKeys.messageLogProviderDelivery(item.id),
    queryFn: () => fetchMessageLogDetail(item.id, true),
    enabled: false,
    retry: false,
  });
  const detail = providerQ.data ?? item;
  const lifecycle = lifecyclePresentation(detail);
  const StateIcon = lifecycle.icon;
  const modeLabel = item.message_mode === "alimtalk"
    ? "알림톡"
    : item.message_mode === "sms"
      ? "문자 발송 차단(레거시)"
      : "알 수 없는 발송 방식";
  const sentDate = new Date(item.sent_at);
  const canVerifyFinal = Boolean(detail.provider_evidence)
    || detail.status === "sent"
    || detail.provider_delivery_status === "provider_accepted";
  const iconColor = lifecycle.tone === "success"
    ? "var(--tc-success)"
    : lifecycle.tone === "danger"
      ? "var(--tc-danger)"
      : lifecycle.tone === "warning"
        ? "var(--tc-warn)"
        : "var(--tc-primary)";
  const iconBackground = lifecycle.tone === "success"
    ? "var(--tc-success-bg)"
    : lifecycle.tone === "danger"
      ? "var(--tc-danger-bg)"
      : lifecycle.tone === "warning"
        ? "var(--tc-warn-bg)"
        : "var(--tc-primary-bg)";

  return (
    <Card style={{ padding: "var(--tc-space-3) var(--tc-space-4)" }}>
      <div className="flex items-start gap-2">
        <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
          style={{ background: iconBackground }}>
          <StateIcon size={ICON.md} style={{ color: iconColor }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <Badge tone={lifecycle.tone} size="xs">{lifecycle.label}</Badge>
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
              수신: {isPrivileged ? item.recipient_summary : maskRecipientSummary(item.recipient_summary)}
            </div>
          )}
          {item.message_body && (
            isPrivileged ? (
              <div className="text-[12px] mt-1 line-clamp-2" style={{ color: "var(--tc-text-muted)" }}>
                {item.message_body}
              </div>
            ) : isSensitiveBody(item.message_body) ? (
              <div className="text-[12px] mt-1 italic" style={{ color: "var(--tc-text-muted)" }}>
                로그인 정보가 포함된 메시지는 학원장만 볼 수 있어요.
              </div>
            ) : (
              <div className="text-[12px] mt-1 line-clamp-2" style={{ color: "var(--tc-text-muted)" }}>
                {item.message_body}
              </div>
            )
          )}
          <div className="text-[11px] mt-1" style={{ color: "var(--tc-text-secondary)" }}>
            {lifecycle.detail}
          </div>
          {lifecycle.tone === "danger" && detail.failure_reason && (
            <div className="text-[11px] mt-1" style={{ color: "var(--tc-danger)" }}>
              사유: {detail.failure_reason}
            </div>
          )}
          {providerQ.isError && (
            <div className="text-[11px] mt-1" role="alert" style={{ color: "var(--tc-danger)" }}>
              최종 상태를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.
            </div>
          )}
          {canVerifyFinal && (
            <button
              type="button"
              onClick={() => void providerQ.refetch()}
              disabled={providerQ.isFetching}
              className="mt-2 min-h-8 px-2.5 rounded-lg inline-flex items-center gap-1 text-[11px] font-bold cursor-pointer disabled:opacity-50"
              style={{ border: "1px solid var(--tc-border)", background: "var(--tc-surface-soft)", color: "var(--tc-text-secondary)" }}
            >
              <RefreshCw size={ICON.xs} aria-hidden />
              {providerQ.isFetching ? "확인 중" : providerQ.data ? "최종 상태 다시 확인" : "최종 상태 확인"}
            </button>
          )}
          <div className="text-[11px] mt-1" style={{ color: "var(--tc-text-muted)" }}>
            {sentDate.toLocaleDateString("ko-KR")} {sentDate.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
          </div>
        </div>
      </div>
    </Card>
  );
}
