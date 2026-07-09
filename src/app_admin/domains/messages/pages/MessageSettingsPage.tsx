// PATH: src/app_admin/domains/messages/pages/MessageSettingsPage.tsx
// 공용 알림톡 설정 상태 — 테넌트별 문자/공급자 직접 연동 UI는 노출하지 않는다.

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
  const { data: info } = useMessagingInfo();
  const { mutate: runTest, isPending: isTesting } = useTestCredentials();
  const [testResult, setTestResult] = useState<TestCredentialsResult | null>(null);

  const channelSourceLabel = "공용 채널";
  const alimtalkAvailable = Boolean(info?.alimtalk_available);
  const setupSteps = [{ done: alimtalkAvailable, label: "알림톡 발송 준비" }];
  const allSetupDone = setupSteps.every((s) => s.done);

  return (
    <div className={styles.root}>
      {!allSetupDone && info && (
        <div className={styles.setupAlert}>
          <FiAlertCircle size={16} className={styles.setupAlertIcon} />
          <div className={styles.setupAlertText}>
            <strong className={styles.setupAlertTitle}>알림톡 연동 상태를 확인해 주세요.</strong>
            <span className={styles.setupMissing}>
              {setupSteps.filter((s) => !s.done).map((s) => s.label).join(", ")} 설정이 필요합니다.
            </span>
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
          status={alimtalkAvailable ? "ok" : "warn"}
          tone="channel"
        />
        <KpiCard
          icon={<FiSend size={16} />}
          label="알림톡"
          value={alimtalkAvailable ? "사용 가능" : "확인 필요"}
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
        <SectionTitle icon={<FiShield size={15} />}>공용 알림톡 정책</SectionTitle>
        <Desc>
          학생·학부모 안내는 공용 카카오 알림톡 채널로 발송됩니다.
          테넌트별 공급자/API 키 직접 연동과 문자 발송은 사용하지 않습니다.
        </Desc>
      </Card>

      <Card>
        <SectionTitle icon={<FiMessageCircle size={15} />}>카카오 알림톡 채널</SectionTitle>
        <Desc>
          현재 채널 출처: <code className={styles.inlineCode}>{channelSourceLabel}</code>
        </Desc>
        {info?.resolved_pf_id && (
          <p className={styles.pfidCurrent}>
            공용 PFID: <code className={styles.inlineCode}>{info.resolved_pf_id}</code>
          </p>
        )}
      </Card>

      <Card accent="success">
        <SectionTitle icon={<FiCheckCircle size={15} />}>연동 테스트</SectionTitle>
        <Desc>공용 알림톡 채널, 발신번호, 발송 준비 상태를 확인합니다.</Desc>
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
