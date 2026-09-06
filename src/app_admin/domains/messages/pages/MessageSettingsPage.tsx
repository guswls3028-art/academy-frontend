// PATH: src/app_admin/domains/messages/pages/MessageSettingsPage.tsx
// 검증된 우리 학원 채널과 공용 fallback 상태. 공급자 키/PFID 편집은 노출하지 않는다.

import {
  FiAlertCircle,
  FiCheckCircle,
  FiMessageCircle,
  FiSend,
  FiShield,
  FiZap,
} from "react-icons/fi";
import { Button } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";
import { useMessagingInfo, useTestCredentials } from "../hooks/useMessagingInfo";
import type { TestCredentialsResult } from "../api/messages.api";
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
  tone: "provider" | "channel" | "alimtalk" | "policy";
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
    ? "공용 채널이 연결되어 있습니다. 별도 채널 정보나 API 키를 입력할 필요가 없습니다."
    : "공용 채널 연결 상태를 확인해 주세요. 학원에서 직접 연동 정보를 입력하지 않습니다.";
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
          icon={<FiZap size={16} />}
          label="공급자"
          value="공용 솔라피"
          status="ok"
          tone="provider"
        />
        <KpiCard
          icon={<FiMessageCircle size={16} />}
          label="채널"
          value={channelSourceLabel}
          status={customChannelPending || customChannelSuspended ? "warn" : alimtalkAvailable ? "ok" : "warn"}
          tone="channel"
        />
        <KpiCard
          icon={<FiSend size={16} />}
          label="알림톡"
          value={messagingDisabled ? "운영 중지" : alimtalkAvailable ? "사용 가능" : "확인 필요"}
          status={alimtalkAvailable ? "ok" : "warn"}
          tone="alimtalk"
        />
        <KpiCard
          icon={<FiShield size={16} />}
          label="발송 정책"
          value="알림톡 전용"
          status="ok"
          tone="policy"
        />
      </div>

      <Card accent="primary">
        <SectionTitle icon={<FiShield size={15} />}>알림톡 채널 정책</SectionTitle>
        <Desc>
          운영자가 공급자에서 확인한 우리 학원 채널만 전용 채널로 사용합니다.
          검수 전에는 공용 채널이 발송을 이어가며, 과거 PFID·자체 키·문자 발송 경로는 사용하지 않습니다.
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
        <SectionTitle icon={<FiCheckCircle size={15} />}>연동 테스트</SectionTitle>
        <Desc>현재 적용되는 알림톡 채널, 발신번호, 승인 양식 준비 상태를 확인합니다.</Desc>
        <div className={styles.testActions}>
          <Button
            intent="primary"
            onClick={() => {
              setTestResult(null);
              runTest(undefined, {
                onSuccess: (data) => {
                  setTestResult(data);
                  if (data.all_ok) feedback.success("알림톡 연동 상태가 정상입니다.");
                  else feedback.error("일부 설정을 확인해 주세요.");
                },
                onError: () => feedback.error("연동 테스트에 실패했습니다."),
              });
            }}
            disabled={isTesting}
          >
            {isTesting ? "테스트 중…" : "알림톡 연동 테스트"}
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
                <span className={styles.testResultMessage}>{c.message}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
