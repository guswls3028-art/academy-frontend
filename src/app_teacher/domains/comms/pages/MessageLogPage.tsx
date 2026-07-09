/* eslint-disable no-restricted-syntax */
// PATH: src/app_teacher/domains/comms/pages/MessageLogPage.tsx
// 발송 이력 — 메시지 로그 조회 페이지
//
// 보안 (시각 검수 H-11 / H-14 2026-05-12):
//   role=teacher/staff 는 수신자 이름·메시지 본문을 마스킹.
//   role=owner/admin 만 풀 정보 노출. 학원장 발신 메시지 본문에 학생 로그인
//   정보(아이디/비밀번호)가 포함될 수 있으므로 staff 권한자에게는 가림.
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { EmptyState , ICON } from "@/shared/ui/ds";
import { ChevronLeft, Check, X } from "@teacher/shared/ui/Icons";
import { Card } from "@teacher/shared/ui/Card";
import { Badge } from "@teacher/shared/ui/Badge";
import { EmptyActionButton } from "@teacher/shared/ui/EmptyActionButton";
import useAuth from "@/auth/hooks/useAuth";
import { fetchMessageLog, type MessageLogItem } from "../api";
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

export default function MessageLogPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const role = (user?.tenantRole ?? "").toLowerCase();
  const isPrivileged = role === "owner" || role === "admin";

  const { data, isLoading } = useQuery({
    queryKey: teacherCommsQueryKeys.messageLog,
    queryFn: () => fetchMessageLog(1, 50),
  });

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
      ) : items.length === 0 ? (
        <EmptyState
          scope="panel"
          tone="empty"
          title="발송 내역이 없습니다"
          description="학생을 선택해 알림톡을 보내면 성공·실패 결과가 이곳에 기록됩니다."
          actions={
            <EmptyActionButton onClick={() => navigate("/teacher/students", { state: { startSelectMode: true, preferredMessageTiming: "now" } })}>
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
  const modeLabel = item.message_mode === "alimtalk" ? "알림톡" : "SMS";
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
