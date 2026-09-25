// PATH: src/app_admin/domains/messages/pages/MessageSettingsPage.tsx
// 검증된 우리 학원 채널과 공용 fallback 상태. 공급자 키/PFID 편집은 노출하지 않는다.

import {
  FiAlertCircle,
  FiCheckCircle,
  FiMessageCircle,
  FiSend,
  FiShield,
} from "react-icons/fi";
import { Button } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";
import { useMessagingInfo, useTestCredentials } from "../hooks/useMessagingInfo";
import type { TestCredentialsCheck, TestCredentialsResult } from "../api/messages.api";
import { useState, type ReactNode } from "react";
import styles from "./MessageSettingsPage.module.css";

function KpiCard({
  icon,
  label,
  value,
  status,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  status?: "ok" | "warn" | "none";
  tone: "channel" | "alimtalk" | "policy";
}) {
  return (
    <div className={styles.kpiCard}>
      <div className={styles.kpiHeader}>
        <div className={styles.kpiIcon} data-tone={tone}>
          {icon}
        </div>
        <span className={styles.kpiLabel}>{label}</span>
      </div>
      <div className={styles.kpiValueRow}>
        <span className={styles.kpiValue}>{value}</span>
        {status && status !== "none" && (
          <span className={styles.kpiStatus} data-status={status}>
            {status === "ok" ? <FiCheckCircle size={11} /> : <FiAlertCircle size={11} />}
            {status === "ok" ? "정상" : "확인 필요"}
          </span>
        )}
      </div>
    </div>
  );
}

function StatusChip({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={styles.statusChip} data-ok={ok}>
      {ok ? <FiCheckCircle size={12} aria-hidden /> : <FiAlertCircle size={12} aria-hidden />}
      {label}
    </span>
  );
}

function Card({ children, accent }: { children: ReactNode; accent?: "primary" | "success" }) {
  return (
    <div className={styles.card} data-accent={accent}>
      {children}
    </div>
  );
}

function SectionTitle({ icon, children }: { icon?: ReactNode; children: ReactNode }) {
  return (
    <div className={styles.sectionTitle}>
      {icon && <span className={styles.sectionIcon}>{icon}</span>}
      {children}
    </div>
  );
}

function Desc({ children }: { children: ReactNode }) {
  return <p className={styles.description}>{children}</p>;
}

function checkMessage(check: TestCredentialsCheck): string {
  switch (check.test) {
    case "operational_policy":
      return check.ok ? "알림톡 발송이 켜져 있습니다." : check.message;
    case "api_credentials":
      return check.ok
        ? "알림톡 발송 서비스가 연결되어 있습니다."
        : "알림톡 발송 서비스 연결을 확인하지 못했습니다. 계속되면 운영자에게 문의하세요.";
    case "sender_number":
      return check.ok ? "발신번호가 준비되어 있습니다." : "발신번호가 준비되지 않았습니다. 운영자에게 문의하세요.";
    case "alimtalk_channel":
      return check.ok ? "카카오 채널이 연결되어 있습니다." : check.message.replace("미연동", "연결되지 않았습니다");
    case "approved_templates":
      return check.message.replace("검수 승인된 공용 양식", "보낼 수 있는 공용 양식").replace("우리 학원 승인 양식", "우리 학원 발송 양식");
    default:
      return check.message;
  }
}

export default function MessageSettingsPage() {
  const { data: info, isError, refetch } = useMessagingInfo();
  const { mutate: runTest, isPending: isTesting } = useTestCredentials();
  const [testResult, setTestResult] = useState<TestCredentialsResult | null>(null);

  const alimtalkAvailable = Boolean(info?.alimtalk_available);
  const messagingDisabled = Boolean(info?.messaging_disabled);
  const customChannelRegistered = Boolean(info?.custom_channel_registered);
  const customChannelActive = info?.custom_channel_status === "active";
  const customChannelPending = info?.custom_channel_status === "pending_templates";
  const customChannelSuspended = info?.custom_channel_status === "suspended";
  let channelSourceLabel = "공용 채널";
  if (customChannelActive) channelSourceLabel = "우리 학원 채널";
  if (customChannelPending) channelSourceLabel = "우리 학원 채널 준비 중";
  if (customChannelSuspended) channelSourceLabel = "우리 학원 채널 사용 중지";

  const setupSteps = [
    { done: alimtalkAvailable, label: "알림톡 발송 준비" },
    ...(customChannelRegistered
      ? [{ done: customChannelActive, label: "우리 학원 채널 승인 양식" }]
      : []),
  ];
  const allSetupDone = setupSteps.every((s) => s.done);

  let setupAlertTitle = "알림톡 연동 상태를 확인해 주세요.";
  let setupAlertMessage = `${setupSteps.filter((step) => !step.done).map((step) => step.label).join(", ")} 설정이 필요합니다.`;
  if (customChannelPending) {
    setupAlertTitle = "우리 학원 채널 양식을 검수 중입니다.";
    setupAlertMessage = "승인 전에는 공용 채널로 정상 발송됩니다.";
  }
  if (customChannelSuspended) {
    setupAlertTitle = "우리 학원 채널 발송을 확인해 주세요.";
    setupAlertMessage = "승인 양식 상태가 달라 전용 채널 발송을 안전하게 막았습니다.";
  }
  if (messagingDisabled) {
    setupAlertTitle = "알림톡 발송이 운영 중지되었습니다.";
    setupAlertMessage = info?.messaging_disabled_reason || "운영 중지 상태입니다.";
  }

  let channelDescription = alimtalkAvailable
    ? "공용 카카오 채널로 알림톡을 보낼 수 있습니다. 보낼 내용은 발송 전 미리보기에서 확인하세요."
    : "현재 알림톡을 보낼 수 없습니다. 아래 발송 상태 확인에서 원인을 확인해 주세요.";
  if (customChannelPending) {
    channelDescription = `${info?.custom_channel_reference || "우리 학원 채널"} 확인 완료 · 승인 양식 ${info?.custom_channel_approved_templates ?? 0}/${info?.custom_channel_required_templates ?? 0}개를 준비하고 있습니다. 완료 전에는 공용 채널로 정상 발송됩니다.`;
  }
  if (customChannelSuspended) {
    channelDescription = `${info?.custom_channel_reference || "우리 학원 채널"} 발송 중지 · 승인 양식 ${info?.custom_channel_approved_templates ?? 0}/${info?.custom_channel_required_templates ?? 0}개를 확인하고 있습니다.`;
  }
  if (customChannelActive) {
    channelDescription = `${info?.custom_channel_reference || "우리 학원 채널"} 연결 완료 · 승인 양식 ${info?.custom_channel_approved_templates ?? 0}/${info?.custom_channel_required_templates ?? 0}개`;
  }
  if (messagingDisabled) {
    channelDescription = info?.messaging_disabled_reason || "운영 중지 상태입니다.";
  }

  return (
    <div className={styles.root}>
      {isError && (
        <Card>
          <SectionTitle icon={<FiAlertCircle size={15} />}>설정을 불러오지 못했습니다</SectionTitle>
          <Desc>연결 상태를 확인한 뒤 다시 시도해 주세요.</Desc>
          <Button intent="secondary" onClick={() => void refetch()}>다시 시도</Button>
        </Card>
      )}
      {!allSetupDone && info && (
        <div className={styles.setupAlert}>
          <FiAlertCircle size={16} className={styles.setupAlertIcon} />
          <div className={styles.setupAlertText}>
            <strong className={styles.setupAlertTitle}>{setupAlertTitle}</strong>
            <span className={styles.setupMissing}>{setupAlertMessage}</span>
          </div>
        </div>
      )}

      <div className={styles.kpiGrid}>
        <KpiCard
          icon={<FiMessageCircle size={16} />}
          label="보내는 채널"
          value={channelSourceLabel}
          status={customChannelPending || customChannelSuspended ? "warn" : alimtalkAvailable ? "ok" : "warn"}
          tone="channel"
        />
        <KpiCard
          icon={<FiSend size={16} />}
          label="발송 상태"
          value={messagingDisabled ? "운영 중지" : alimtalkAvailable ? "사용 가능" : "확인 필요"}
          status={alimtalkAvailable ? "ok" : "warn"}
          tone="alimtalk"
        />
        <KpiCard
          icon={<FiShield size={16} />}
          label="안내 방식"
          value="카카오 알림톡"
          status="ok"
          tone="policy"
        />
      </div>

      <Card accent="primary">
        <SectionTitle icon={<FiShield size={15} />}>안전하게 보내기</SectionTitle>
        <Desc>
          발송 전에 받는 사람과 실제로 보낼 내용을 확인할 수 있습니다.
          카카오에서 승인된 양식으로만 보내며, 준비되지 않은 알림톡은 발송되지 않습니다.
        </Desc>
      </Card>

      <Card>
        <SectionTitle icon={<FiMessageCircle size={15} />}>카카오 알림톡 채널</SectionTitle>
        <Desc>{channelDescription}</Desc>
        {customChannelRegistered && info?.custom_channel_last_test_status && (
          <p className={styles.pfidCurrent}>
            최근 전용 채널 테스트: {info.custom_channel_last_test_status === "sent" ? "발송 접수 확인" : info.custom_channel_last_test_status === "ambiguous" ? "결과 확인 필요" : "실패"}
          </p>
        )}
      </Card>

      <Card accent="success">
        <SectionTitle icon={<FiCheckCircle size={15} />}>발송 상태 확인</SectionTitle>
        <Desc>카카오 채널과 발신번호, 보낼 양식이 준비됐는지 확인합니다. 실제 알림톡은 보내지 않습니다.</Desc>
        <div className={styles.testActions}>
          <Button
            intent="primary"
            onClick={() => {
              setTestResult(null);
              runTest(undefined, {
                onSuccess: (data) => {
                  setTestResult(data);
                  if (data.all_ok) feedback.success("알림톡을 보낼 준비가 되었습니다.");
                  else feedback.warning("아래 발송 상태를 확인해 주세요.");
                },
                onError: () => feedback.error("발송 상태를 확인하지 못했습니다. 다시 시도해 주세요."),
              });
            }}
            disabled={isTesting}
          >
            {isTesting ? "확인 중…" : "발송 상태 확인"}
          </Button>
          {testResult && <StatusChip ok={testResult.all_ok} label={testResult.all_ok ? "정상" : "확인 필요"} />}
        </div>
        {testResult && (
          <div className={styles.testResultList}>
            {testResult.checks.map((c, i) => (
              <div
                key={i}
                className={styles.testResultItem}
                data-ok={c.ok}
              >
                {c.ok ? (
                  <FiCheckCircle size={14} className={styles.testResultIcon} data-ok={c.ok} />
                ) : (
                  <FiAlertCircle size={14} className={styles.testResultIcon} data-ok={c.ok} />
                )}
                <span className={styles.testResultMessage}>{checkMessage(c)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
