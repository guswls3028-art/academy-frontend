// PATH: src/features/messages/pages/MessageSendPage.tsx
// 발송 — 메시징 상태 요약 + 발송 모달 진입점

import { useNavigate } from "react-router-dom";
import { FiAlertCircle, FiCheckCircle, FiSend, FiUsers } from "react-icons/fi";
import { Button } from "@/shared/ui/ds";
import { useSendMessageModal } from "../context/SendMessageModalContext";
import { useMessagingInfo } from "../hooks/useMessagingInfo";

function StatusChip({
  ok,
  label,
}: {
  ok: boolean;
  label: string;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "2px 8px",
        borderRadius: "var(--radius-md)",
        fontSize: 12,
        fontWeight: 600,
        color: ok ? "var(--color-success)" : "var(--color-status-warning, #d97706)",
        background: ok
          ? "color-mix(in srgb, var(--color-success) 10%, transparent)"
          : "color-mix(in srgb, var(--color-status-warning, #d97706) 10%, transparent)",
      }}
    >
      {ok ? (
        <FiCheckCircle size={12} aria-hidden />
      ) : (
        <FiAlertCircle size={12} aria-hidden />
      )}
      {label}
    </span>
  );
}

export default function MessageSendPage() {
  const navigate = useNavigate();
  const { openSendMessageModal } = useSendMessageModal();
  const { data: info } = useMessagingInfo();

  const creditBalance = info?.credit_balance
    ? `${Number(info.credit_balance).toLocaleString()}원`
    : "—";
  const hasSender = !!(info?.messaging_sender);
  const hasPfid = !!(info?.kakao_pfid);
  const isActive = info?.is_active ?? false;

  return (
    <div className="flex flex-col gap-5">
      {/* 상태 요약 카드 */}
      {info && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: "var(--space-3)",
          }}
        >
          {/* 크레딧 잔액 */}
          <div
            style={{
              borderRadius: "var(--radius-lg)",
              border: "1px solid var(--color-border-divider)",
              background: "var(--color-bg-surface)",
              padding: "var(--space-4) var(--space-5)",
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "var(--color-text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                marginBottom: 6,
              }}
            >
              크레딧 잔액
            </div>
            <div
              style={{
                fontSize: 22,
                fontWeight: 700,
                color: "var(--color-text-primary)",
                letterSpacing: "-0.5px",
              }}
            >
              {creditBalance}
            </div>
          </div>

          {/* 발신번호 */}
          <div
            style={{
              borderRadius: "var(--radius-lg)",
              border: "1px solid var(--color-border-divider)",
              background: "var(--color-bg-surface)",
              padding: "var(--space-4) var(--space-5)",
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "var(--color-text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                marginBottom: 6,
              }}
            >
              발신번호
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: "var(--color-text-primary)",
                }}
              >
                {info.messaging_sender ?? "미등록"}
              </span>
              <StatusChip ok={hasSender} label={hasSender ? "등록됨" : "미등록"} />
            </div>
          </div>

          {/* 알림톡 채널 */}
          <div
            style={{
              borderRadius: "var(--radius-lg)",
              border: "1px solid var(--color-border-divider)",
              background: "var(--color-bg-surface)",
              padding: "var(--space-4) var(--space-5)",
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "var(--color-text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                marginBottom: 6,
              }}
            >
              알림톡 채널
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: "var(--color-text-primary)",
                }}
              >
                {info.channel_source === "tenant_override" ? "자체 채널" : "기본 채널"}
              </span>
              <StatusChip ok={hasPfid} label={hasPfid ? "연동됨" : "미연동"} />
            </div>
          </div>

          {/* 서비스 상태 */}
          <div
            style={{
              borderRadius: "var(--radius-lg)",
              border: "1px solid var(--color-border-divider)",
              background: "var(--color-bg-surface)",
              padding: "var(--space-4) var(--space-5)",
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "var(--color-text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                marginBottom: 6,
              }}
            >
              서비스 상태
            </div>
            <StatusChip ok={isActive} label={isActive ? "활성화" : "비활성화"} />
          </div>
        </div>
      )}

      {/* 발송 패널 — 발송 방법과 동일한 카드 스타일 */}
      <div
        style={{
          borderRadius: "var(--radius-lg)",
          padding: "var(--space-5)",
          border: "1px solid var(--color-border-divider)",
          background: "var(--color-bg-surface)",
          fontSize: 14,
          color: "var(--color-text-secondary)",
        }}
      >
        <div
          style={{
            fontWeight: 600,
            color: "var(--color-text-primary)",
            marginBottom: 10,
          }}
        >
          메시지 발송
        </div>
        <p style={{ marginBottom: 12, lineHeight: 1.6 }}>
          학생·학부모에게 SMS 또는 알림톡을 발송합니다.
        </p>
        <p className="text-sm text-[var(--color-text-secondary)]" style={{ marginBottom: 16, lineHeight: 1.6 }}>
          수신자를 선택한 뒤 발송 버튼을 눌러 메시지를 보낼 수 있습니다.
          학생·강의·출결 페이지에서 수신자를 선택하거나, 아래에서 직접 발송 모달을 열 수 있습니다.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button
            intent="primary"
            onClick={() =>
              openSendMessageModal({ studentIds: [], recipientLabel: "수신자 없음" })
            }
          >
            <FiSend size={14} style={{ marginRight: 6 }} aria-hidden />
            메시지 발송
          </Button>
          <Button
            intent="secondary"
            onClick={() => navigate("/admin/students")}
          >
            <FiUsers size={14} style={{ marginRight: 6 }} aria-hidden />
            학생 목록으로 이동
          </Button>
        </div>
      </div>

      {/* 사용 방법 */}
      <div
        style={{
          borderRadius: "var(--radius-lg)",
          padding: "var(--space-5)",
          border: "1px solid var(--color-border-divider)",
          background: "var(--color-bg-surface)",
          fontSize: 14,
          color: "var(--color-text-secondary)",
        }}
      >
        <div
          style={{
            fontWeight: 600,
            color: "var(--color-text-primary)",
            marginBottom: 10,
          }}
        >
          발송 방법
        </div>
        <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.9 }}>
          <li>학생·강의·출결 페이지에서 수신자를 선택한 뒤 「메시지 발송」 버튼을 누르세요.</li>
          <li>발송 유형(SMS만 / 알림톡만 / 알림톡→SMS 폴백)을 선택할 수 있습니다.</li>
          <li>템플릿을 불러오거나 직접 내용을 입력하여 발송할 수 있습니다.</li>
          <li>
            발신번호·알림톡 채널이 미설정이면{" "}
            <button
              type="button"
              onClick={() => navigate("/admin/message/settings")}
              style={{
                background: "none",
                border: "none",
                padding: 0,
                color: "var(--color-primary)",
                fontWeight: 600,
                cursor: "pointer",
                textDecoration: "underline",
                fontSize: "inherit",
              }}
            >
              설정 탭
            </button>
            에서 먼저 연동하세요.
          </li>
        </ul>
      </div>
    </div>
  );
}
