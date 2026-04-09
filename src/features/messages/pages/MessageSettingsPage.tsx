// PATH: src/features/messages/pages/MessageSettingsPage.tsx
// 메시지 설정 — KPI 요약 + 공급자 선택 + API 키 + 발신번호 + 연동 테스트

import { useState, useEffect } from "react";
import { Input } from "antd";
import {
  FiCheckCircle,
  FiAlertCircle,
  FiMessageCircle,
  FiPhone,
  FiSettings,
  FiKey,
  FiCopy,
  FiZap,
  FiSend,
  FiShield,
} from "react-icons/fi";
import { Button } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";
import {
  useMessagingInfo,
  useUpdateKakaoPfid,
  useUpdateMessagingInfo,
  useVerifySender,
  useTestCredentials,
} from "../hooks/useMessagingInfo";
import type { TestCredentialsResult } from "../api/messages.api";
import type { MessagingProvider } from "../api/messages.api";

// 메시징 워커 서버 IP (뿌리오 연동 IP 등록용)
const SERVER_IP = "43.201.119.172";

// ─── Sub-components ───

function KpiCard({
  icon,
  label,
  value,
  status,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  status?: "ok" | "warn" | "none";
  color?: string;
}) {
  const statusColor =
    status === "ok" ? "var(--color-success)" : status === "warn" ? "var(--color-status-warning, #d97706)" : "var(--color-text-muted)";
  return (
    <div
      style={{
        flex: "1 1 0",
        minWidth: 160,
        padding: "16px 20px",
        borderRadius: 12,
        background: "var(--color-bg-surface)",
        border: "1px solid var(--color-border-divider)",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            display: "grid",
            placeItems: "center",
            background: `color-mix(in srgb, ${color ?? "var(--color-primary)"} 10%, transparent)`,
            color: color ?? "var(--color-primary)",
          }}
        >
          {icon}
        </div>
        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-muted)" }}>{label}</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 16, fontWeight: 700, color: "var(--color-text-primary)" }}>{value}</span>
        {status && status !== "none" && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 11, fontWeight: 600, color: statusColor }}>
            {status === "ok" ? <FiCheckCircle size={11} /> : <FiAlertCircle size={11} />}
            {status === "ok" ? "연동됨" : "미설정"}
          </span>
        )}
      </div>
    </div>
  );
}

function StatusChip({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "3px 10px",
        borderRadius: 20,
        fontSize: 12,
        fontWeight: 600,
        color: ok ? "var(--color-success)" : "var(--color-status-warning, #d97706)",
        background: ok
          ? "color-mix(in srgb, var(--color-success) 10%, transparent)"
          : "color-mix(in srgb, var(--color-status-warning, #d97706) 10%, transparent)",
      }}
    >
      {ok ? <FiCheckCircle size={12} aria-hidden /> : <FiAlertCircle size={12} aria-hidden />}
      {label}
    </span>
  );
}

function Card({ children, accent }: { children: React.ReactNode; accent?: string }) {
  return (
    <div
      style={{
        borderRadius: 12,
        padding: "20px 24px",
        border: "1px solid var(--color-border-divider)",
        background: "var(--color-bg-surface)",
        borderLeft: accent ? `3px solid ${accent}` : undefined,
      }}
    >
      {children}
    </div>
  );
}

function SectionTitle({ icon, children }: { icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, fontSize: 15, color: "var(--color-text-primary)", marginBottom: 6 }}>
      {icon && <span style={{ color: "var(--color-primary)", display: "flex" }}>{icon}</span>}
      {children}
    </div>
  );
}

function Desc({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: 13, color: "var(--color-text-muted)", marginBottom: 16, lineHeight: 1.5 }}>{children}</p>;
}

function CopyButton({ text }: { text: string }) {
  return (
    <button
      type="button"
      onClick={() => { navigator.clipboard.writeText(text); feedback.success("복사되었습니다."); }}
      style={{
        background: "none",
        border: "1px solid var(--color-border-divider)",
        borderRadius: 4,
        padding: "2px 6px",
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        gap: 3,
        fontSize: 11,
        color: "var(--color-text-muted)",
      }}
      title="복사"
    >
      <FiCopy size={10} /> 복사
    </button>
  );
}

// ─── Main ───

export default function MessageSettingsPage() {
  const { data: info } = useMessagingInfo();
  const { mutate: updatePfid, isPending } = useUpdateKakaoPfid();
  const { mutate: updateInfo, isPending: isUpdatingInfo } = useUpdateMessagingInfo();
  const { mutate: verify, isPending: isVerifying } = useVerifySender();
  const { mutate: runTest, isPending: isTesting } = useTestCredentials();

  const [pfid, setPfid] = useState("");
  const [testResult, setTestResult] = useState<TestCredentialsResult | null>(null);
  const [provider, setProvider] = useState<MessagingProvider>("solapi");

  const [sender, setSender] = useState("");
  const [verifyResult, setVerifyResult] = useState<{ verified: boolean; message: string } | null>(null);

  const [ownSolapiKey, setOwnSolapiKey] = useState("");
  const [ownSolapiSecret, setOwnSolapiSecret] = useState("");
  const [ownPpurioKey, setOwnPpurioKey] = useState("");
  const [ownPpurioAccount, setOwnPpurioAccount] = useState("");

  useEffect(() => { if (info?.kakao_pfid != null) setPfid(info.kakao_pfid); }, [info?.kakao_pfid]);
  useEffect(() => { if (info?.messaging_provider) setProvider(info.messaging_provider); }, [info?.messaging_provider]);
  useEffect(() => { setSender(info?.messaging_sender ?? ""); }, [info?.messaging_sender]);
  useEffect(() => { setOwnPpurioAccount(info?.own_ppurio_account ?? ""); }, [info?.own_ppurio_account]);

  const handleSavePfid = () => {
    const value = pfid.trim();
    if (!value) return;
    updatePfid(value);
  };

  const handleVerifySender = () => {
    const value = sender.replace(/-/g, "").trim();
    if (!value) { setVerifyResult({ verified: false, message: "발신번호를 입력해 주세요." }); return; }
    setVerifyResult(null);
    verify(value, {
      onSuccess: (data) => setVerifyResult({ verified: data.verified, message: data.message }),
      onError: (err: { response?: { data?: { detail?: string; message?: string } }; message?: string }) => {
        const d = err?.response?.data;
        setVerifyResult({ verified: false, message: (typeof d?.detail === "string" ? d.detail : null) || d?.message || err?.message || "인증 확인에 실패했습니다." });
      },
    });
  };

  const handleSaveSender = () => {
    updateInfo(
      { messaging_sender: sender.replace(/-/g, "").trim() },
      {
        onSuccess: () => { feedback.success("발신번호가 저장되었습니다."); setVerifyResult(null); },
        onError: () => feedback.error("발신번호 저장에 실패했습니다."),
      },
    );
  };

  const handleSaveOwnCredentials = () => {
    const payload: Record<string, string> = {};
    if (provider === "solapi") {
      if (ownSolapiKey) payload.own_solapi_api_key = ownSolapiKey;
      if (ownSolapiSecret) payload.own_solapi_api_secret = ownSolapiSecret;
    } else {
      if (ownPpurioKey) payload.own_ppurio_api_key = ownPpurioKey;
      if (ownPpurioAccount) payload.own_ppurio_account = ownPpurioAccount;
    }
    if (Object.keys(payload).length === 0) { feedback.error("입력값을 확인해 주세요."); return; }
    updateInfo(payload, {
      onSuccess: () => { feedback.success("연동 정보가 저장되었습니다."); setOwnSolapiKey(""); setOwnSolapiSecret(""); setOwnPpurioKey(""); },
      onError: () => feedback.error("저장에 실패했습니다."),
    });
  };

  const handleClearOwnCredentials = () => {
    updateInfo(
      { own_solapi_api_key: "", own_solapi_api_secret: "", own_ppurio_api_key: "", own_ppurio_account: "" },
      {
        onSuccess: () => { feedback.success("연동 정보가 초기화되었습니다."); setOwnSolapiKey(""); setOwnSolapiSecret(""); setOwnPpurioKey(""); setOwnPpurioAccount(""); },
        onError: () => feedback.error("초기화에 실패했습니다."),
      },
    );
  };

  const hasPfid = !!(info?.kakao_pfid);
  const hasSender = !!(info?.messaging_sender);
  const hasOwnCreds = info?.has_own_credentials ?? false;
  const canSend = !!(info?.sms_allowed) || hasOwnCreds;  // 시스템 기본 키 또는 자체 키
  const providerLabel = provider === "ppurio" ? "뿌리오" : "솔라피";

  const setupSteps = [
    { done: canSend, label: "API 연동" },
    { done: hasSender, label: "발신번호" },
  ];
  const allSetupDone = setupSteps.every((s) => s.done);

  return (
    <div className="flex flex-col gap-5" style={{ maxWidth: 720 }}>

      {/* ─── 설정 완료 안내 ─── */}
      {!allSetupDone && info && (
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "12px 16px", borderRadius: 12,
          background: "color-mix(in srgb, var(--color-status-warning, #d97706) 6%, var(--color-bg-surface))",
          border: "1px solid color-mix(in srgb, var(--color-status-warning, #d97706) 18%, var(--color-border-divider))",
        }}>
          <FiAlertCircle size={16} style={{ color: "var(--color-status-warning, #d97706)", flexShrink: 0 }} />
          <div style={{ fontSize: 13, color: "var(--color-text-secondary)", lineHeight: 1.5 }}>
            <strong style={{ color: "var(--color-text-primary)" }}>메시지 발송 설정을 완료해 주세요.</strong>
            <span style={{ marginLeft: 8 }}>
              {setupSteps.filter((s) => !s.done).map((s) => s.label).join(", ")} 설정이 필요합니다.
            </span>
          </div>
        </div>
      )}

      {/* ─── KPI 요약 ─── */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <KpiCard
          icon={<FiZap size={16} />}
          label="공급자"
          value={providerLabel}
          status={canSend ? "ok" : "warn"}
          color="#6366f1"
        />
        <KpiCard
          icon={<FiPhone size={16} />}
          label="발신번호"
          value={info?.messaging_sender || "미등록"}
          status={hasSender ? "ok" : "warn"}
          color="#0ea5e9"
        />
        <KpiCard
          icon={<FiSend size={16} />}
          label="알림톡"
          value={hasPfid ? "사용 가능" : "미설정"}
          status={hasPfid ? "ok" : "none"}
          color="#f59e0b"
        />
        <KpiCard
          icon={<FiShield size={16} />}
          label="SMS"
          value={info?.sms_allowed ? "사용 가능" : "미설정"}
          status={info?.sms_allowed ? "ok" : "warn"}
          color="#10b981"
        />
      </div>

      {/* ─── ① 공급자 선택 ─── */}
      <Card accent="var(--color-primary)">
        <SectionTitle icon={<FiSettings size={15} />}>메시징 공급자</SectionTitle>
        <Desc>SMS·알림톡 발송에 사용할 공급자를 선택하세요.</Desc>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 0, borderRadius: 8, overflow: "hidden", border: "1px solid var(--color-border-divider)" }}>
            {([
              { key: "solapi" as const, label: "솔라피(Solapi)" },
              { key: "ppurio" as const, label: "뿌리오(Ppurio)" },
            ]).map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => {
                  if (opt.key === provider) return;
                  if (!window.confirm(`메시징 공급자를 ${opt.label}(으)로 변경하시겠습니까?`)) return;
                  setProvider(opt.key);
                  updateInfo({ messaging_provider: opt.key }, {
                    onSuccess: () => feedback.success(`${opt.label}(으)로 변경되었습니다.`),
                    onError: () => feedback.error("변경에 실패했습니다."),
                  });
                }}
                disabled={isUpdatingInfo}
                style={{
                  padding: "8px 20px",
                  fontSize: 13,
                  fontWeight: 700,
                  border: "none",
                  cursor: isUpdatingInfo ? "not-allowed" : "pointer",
                  color: provider === opt.key ? "#fff" : "var(--color-text-secondary)",
                  background: provider === opt.key ? "var(--color-primary)" : "var(--color-bg-surface-soft)",
                  transition: "background 0.15s, color 0.15s",
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* ─── ② API 키 등록 ─── */}
      <Card>
        <SectionTitle icon={<FiKey size={15} />}>API 연동 설정</SectionTitle>

        {provider === "solapi" ? (
          <>
            <Desc>
              <a href="https://console.solapi.com" target="_blank" rel="noopener noreferrer" style={{ color: "var(--color-primary)" }}>솔라피 콘솔</a>에서
              API Key와 API Secret을 발급받아 입력하세요.
            </Desc>
            <div className="flex flex-col gap-3">
              <Input placeholder={info?.own_solapi_api_key ? `현재: ${info.own_solapi_api_key}` : "API Key"} value={ownSolapiKey} onChange={(e) => setOwnSolapiKey(e.target.value)} style={{ maxWidth: 380 }} />
              <Input placeholder={info?.own_solapi_api_secret ? `현재: ${info.own_solapi_api_secret}` : "API Secret"} value={ownSolapiSecret} onChange={(e) => setOwnSolapiSecret(e.target.value)} type="password" style={{ maxWidth: 380 }} />
            </div>
          </>
        ) : (
          <>
            <Desc>
              <a href="https://www.ppurio.com" target="_blank" rel="noopener noreferrer" style={{ color: "var(--color-primary)" }}>뿌리오</a> 계정 정보를 입력하세요.
              처음이라면 아래 가이드를 따라 진행하세요.
            </Desc>

            <details style={{ marginBottom: 16 }}>
              <summary style={{ fontSize: 13, fontWeight: 600, color: "var(--color-primary)", cursor: "pointer", marginBottom: 8 }}>
                뿌리오 연동 가이드 (처음이라면 펼쳐보세요)
              </summary>
              <div style={{ fontSize: 12, color: "var(--color-text-muted)", padding: "14px 16px", background: "var(--color-bg-surface-soft)", borderRadius: 8, lineHeight: 2 }}>
                <strong>1. 회원가입</strong> — <a href="https://www.ppurio.com" target="_blank" rel="noopener noreferrer" style={{ color: "var(--color-primary)" }}>ppurio.com</a> → 기업 회원 가입 (사업자등록증 필요, 1~2영업일 승인)<br />
                <strong>2. 인증키 확인</strong> — 로그인 → <strong>[연동] → [연동개발(API)]</strong> → 인증키 복사<br />
                <strong>3. 연동 IP 등록</strong> — <strong>[연동] → [연동관리]</strong> → 연동IP 등록에 아래 IP 추가:<br />
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", background: "var(--color-bg-surface)", borderRadius: 4, fontFamily: "monospace", fontWeight: 700, fontSize: 13, margin: "4px 0" }}>
                  {SERVER_IP} <CopyButton text={SERVER_IP} />
                </span><br />
                <strong>4. 발신번호 등록</strong> — [문자 발신번호] → 학원 전화번호 등록 + 서류 인증<br />
                <strong>5. 아래에 입력</strong> — 계정 ID + 인증키(API Key) 입력 후 [저장]
              </div>
            </details>

            <div className="flex flex-col gap-3">
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-muted)", marginBottom: 4, display: "block" }}>계정 ID (뿌리오 로그인 아이디)</label>
                <Input
                  placeholder={info?.own_ppurio_account ? `현재: ${info.own_ppurio_account}` : "예: myacademy"}
                  value={ownPpurioAccount}
                  onChange={(e) => setOwnPpurioAccount(e.target.value)}
                  style={{ maxWidth: 380 }}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-muted)", marginBottom: 4, display: "block" }}>API 인증키 (연동개발 메뉴에서 복사)</label>
                <Input
                  placeholder={info?.own_ppurio_api_key ? "현재 인증키가 저장되어 있습니다" : "뿌리오 연동개발 API 인증키"}
                  value={ownPpurioKey}
                  onChange={(e) => setOwnPpurioKey(e.target.value)}
                  type="password"
                  style={{ maxWidth: 380 }}
                />
              </div>
            </div>
          </>
        )}

        <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap", alignItems: "center" }}>
          <Button intent="primary" onClick={handleSaveOwnCredentials} disabled={isUpdatingInfo}>
            {isUpdatingInfo ? "저장 중…" : "저장"}
          </Button>
          {hasOwnCreds && (
            <Button intent="secondary" onClick={handleClearOwnCredentials} disabled={isUpdatingInfo}>
              초기화
            </Button>
          )}
          {hasOwnCreds && <StatusChip ok label="연동됨" />}
        </div>
      </Card>

      {/* ─── ③ 발신번호 ─── */}
      <Card>
        <SectionTitle icon={<FiPhone size={15} />}>발신번호</SectionTitle>
        <Desc>{providerLabel}에 등록된 발신번호를 입력하세요.</Desc>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <input
            type="tel"
            className="ds-input"
            placeholder="예: 01012345678"
            value={sender}
            onChange={(e) => { setSender(e.target.value); setVerifyResult(null); }}
            disabled={isUpdatingInfo || isVerifying}
            style={{ maxWidth: 200, fontSize: 15 }}
          />
          {provider === "solapi" && (
            <Button intent="secondary" size="md" onClick={handleVerifySender} disabled={!sender.trim() || isVerifying}>
              {isVerifying ? "확인 중…" : "인증"}
            </Button>
          )}
          <Button intent="primary" size="md" onClick={handleSaveSender} disabled={!sender.trim() || isUpdatingInfo}>
            {isUpdatingInfo ? "저장 중…" : "저장"}
          </Button>
        </div>
        {verifyResult && (
          <p style={{ fontSize: 13, fontWeight: 600, color: verifyResult.verified ? "var(--color-success)" : "var(--color-error)", display: "flex", alignItems: "center", gap: 4, margin: "8px 0 0" }}>
            {verifyResult.verified ? <FiCheckCircle size={13} /> : <FiAlertCircle size={13} />}
            {verifyResult.message}
          </p>
        )}
      </Card>

      {/* ─── ④ 카카오 알림톡 (선택) ─── */}
      <Card>
        <SectionTitle icon={<FiMessageCircle size={15} />}>카카오 알림톡 채널 <span style={{ fontSize: 12, fontWeight: 400, color: "var(--color-text-muted)" }}>선택</span></SectionTitle>
        <Desc>
          {hasPfid
            ? "카카오 알림톡 채널이 연동되어 있습니다. 알림톡 템플릿을 통해 카카오톡으로 알림을 발송할 수 있습니다."
            : "SMS만 사용한다면 이 항목은 건너뛰세요. 알림톡을 사용하려면 카카오 비즈니스 채널 PFID를 입력합니다."}
        </Desc>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <Input
            placeholder="예: @yourChannel"
            value={pfid}
            onChange={(e) => setPfid(e.target.value)}
            disabled={isPending}
            style={{ maxWidth: 300 }}
            onPressEnter={handleSavePfid}
          />
          <Button intent="primary" onClick={handleSavePfid} disabled={!pfid.trim() || isPending}>
            {isPending ? "저장 중…" : "저장"}
          </Button>
          {hasPfid && <StatusChip ok label="연동됨" />}
        </div>
        {hasPfid && (
          <p style={{ fontSize: 12, color: "var(--color-text-muted)", margin: "8px 0 0" }}>
            현재 PFID: <code style={{ fontSize: 11, padding: "1px 4px", borderRadius: 3, background: "var(--color-bg-surface-soft)" }}>{info?.kakao_pfid}</code>
          </p>
        )}
      </Card>

      {/* ─── ⑤ 연동 테스트 ─── */}
      <Card accent="var(--color-success)">
        <SectionTitle icon={<FiCheckCircle size={15} />}>연동 테스트</SectionTitle>
        <Desc>설정이 완료되면 아래 버튼으로 연동 상태를 확인하세요.</Desc>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <Button
            intent="primary"
            onClick={() => {
              setTestResult(null);
              runTest(undefined, {
                onSuccess: (data) => {
                  setTestResult(data);
                  if (data.all_ok) feedback.success("모든 연동이 정상입니다!");
                  else feedback.error("일부 설정을 확인해 주세요.");
                },
                onError: () => feedback.error("연동 테스트에 실패했습니다."),
              });
            }}
            disabled={isTesting}
          >
            {isTesting ? "테스트 중…" : "연동 상태 테스트"}
          </Button>
          {testResult && <StatusChip ok={testResult.all_ok} label={testResult.all_ok ? "모두 정상" : "확인 필요"} />}
        </div>
        {testResult && (
          <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
            {testResult.checks.map((c, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 8,
                  padding: "10px 14px",
                  borderRadius: 8,
                  background: c.ok
                    ? "color-mix(in srgb, var(--color-success) 6%, transparent)"
                    : "color-mix(in srgb, var(--color-error) 6%, transparent)",
                  border: `1px solid ${c.ok ? "color-mix(in srgb, var(--color-success) 15%, transparent)" : "color-mix(in srgb, var(--color-error) 15%, transparent)"}`,
                }}
              >
                {c.ok ? (
                  <FiCheckCircle size={14} style={{ color: "var(--color-success)", marginTop: 2, flexShrink: 0 }} />
                ) : (
                  <FiAlertCircle size={14} style={{ color: "var(--color-error)", marginTop: 2, flexShrink: 0 }} />
                )}
                <span style={{ fontSize: 13, color: "var(--color-text-primary)", lineHeight: 1.5 }}>
                  {c.message}
                </span>
              </div>
            ))}
            {provider === "ppurio" && testResult.checks.some((c) => !c.ok && c.message.includes("토큰")) && (
              <div style={{ fontSize: 12, color: "var(--color-text-muted)", padding: "8px 14px", background: "var(--color-bg-surface-soft)", borderRadius: 8, lineHeight: 1.6 }}>
                <strong>참고:</strong> 뿌리오 토큰 테스트는 API 서버에서 실행됩니다. 실제 문자 발송은 메시징 워커(IP: {SERVER_IP})를 통해 이루어지므로, 워커 IP가 뿌리오에 등록되어 있으면 발송은 정상 작동합니다.
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
