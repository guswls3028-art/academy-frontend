// PATH: src/features/messages/pages/MessageSettingsPage.tsx
// 설정 — 두 가지 모드(대행요청 / 직접연동) + 발신번호 인라인 + 카카오 채널

import { useState, useEffect } from "react";
import { Input } from "antd";
import {
  FiCheckCircle,
  FiAlertCircle,
  FiMessageCircle,
  FiPhone,
  FiPlusCircle,
  FiSettings,
  FiKey,
  FiShield,
} from "react-icons/fi";
import { Button } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";
import {
  useMessagingInfo,
  useUpdateKakaoPfid,
  useChargeCredits,
  useUpdateMessagingInfo,
  useVerifySender,
  useTestCredentials,
} from "../hooks/useMessagingInfo";
import type { TestCredentialsResult } from "../api/messages.api";
import type { MessagingProvider } from "../api/messages.api";

type IntegrationMode = "agency" | "self";

/** KPI용 상태 칩 */
function StatusChip({ ok, label }: { ok: boolean; label: string }) {
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
      {ok ? <FiCheckCircle size={12} aria-hidden /> : <FiAlertCircle size={12} aria-hidden />}
      {label}
    </span>
  );
}

/** 설정 상태 행 */
function StatusRow({
  label,
  value,
  ok,
  okLabel,
  ngLabel,
}: {
  label: string;
  value?: string;
  ok: boolean;
  okLabel?: string;
  ngLabel?: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "12px 0",
        borderBottom: "1px solid var(--color-border-divider)",
      }}
    >
      <span style={{ fontSize: 13, color: "var(--color-text-muted)" }}>{label}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {value && (
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-primary)" }}>
            {value}
          </span>
        )}
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            padding: "2px 8px",
            borderRadius: "var(--radius-md)",
            fontSize: 11,
            fontWeight: 600,
            color: ok ? "var(--color-success)" : "var(--color-status-warning, #d97706)",
            background: ok
              ? "color-mix(in srgb, var(--color-success) 10%, transparent)"
              : "color-mix(in srgb, var(--color-status-warning, #d97706) 10%, transparent)",
          }}
        >
          {ok ? <FiCheckCircle size={11} aria-hidden /> : <FiAlertCircle size={11} aria-hidden />}
          {ok ? (okLabel ?? "연동됨") : (ngLabel ?? "미설정")}
        </span>
      </div>
    </div>
  );
}

/** 가이드 단계 */
function GuideStep({ step, children }: { step: number; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
      <div
        style={{
          flexShrink: 0,
          width: 24,
          height: 24,
          borderRadius: "50%",
          background: "color-mix(in srgb, var(--color-primary) 12%, transparent)",
          color: "var(--color-primary)",
          fontWeight: 700,
          fontSize: 12,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {step}
      </div>
      <div style={{ fontSize: 13, color: "var(--color-text-secondary)", lineHeight: 1.6, paddingTop: 3 }}>
        {children}
      </div>
    </div>
  );
}

/** 카드 섹션 컨테이너 */
function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        borderRadius: "var(--radius-lg)",
        padding: "var(--space-5)",
        border: "1px solid var(--color-border-divider)",
        background: "var(--color-bg-surface)",
      }}
    >
      {children}
    </div>
  );
}

/** 섹션 헤더 */
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontWeight: 600, color: "var(--color-text-primary)", marginBottom: 4 }}>{children}</div>
  );
}

/** 설명 텍스트 */
function Desc({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: 13, color: "var(--color-text-muted)", marginBottom: 12 }}>{children}</p>;
}

export default function MessageSettingsPage() {
  const { data: info } = useMessagingInfo();
  const { mutate: updatePfid, isPending } = useUpdateKakaoPfid();
  const { mutate: chargeCredits, isPending: isCharging } = useChargeCredits();
  const { mutate: updateInfo, isPending: isUpdatingInfo } = useUpdateMessagingInfo();
  const { mutate: verify, isPending: isVerifying } = useVerifySender();
  const { mutate: runTest, isPending: isTesting } = useTestCredentials();

  const [pfid, setPfid] = useState("");
  const [testResult, setTestResult] = useState<TestCredentialsResult | null>(null);
  const [chargeAmount, setChargeAmount] = useState("");
  const [provider, setProvider] = useState<MessagingProvider>("solapi");
  const [mode, setMode] = useState<IntegrationMode>("agency");

  // 발신번호 인라인
  const [sender, setSender] = useState("");
  const [verifyResult, setVerifyResult] = useState<{ verified: boolean; message: string } | null>(null);

  // 자체 연동 키
  const [ownSolapiKey, setOwnSolapiKey] = useState("");
  const [ownSolapiSecret, setOwnSolapiSecret] = useState("");
  const [ownPpurioKey, setOwnPpurioKey] = useState("");
  const [ownPpurioAccount, setOwnPpurioAccount] = useState("");

  useEffect(() => {
    if (info?.kakao_pfid != null) setPfid(info.kakao_pfid);
  }, [info?.kakao_pfid]);

  useEffect(() => {
    if (info?.messaging_provider) setProvider(info.messaging_provider);
  }, [info?.messaging_provider]);

  useEffect(() => {
    setSender(info?.messaging_sender ?? "");
  }, [info?.messaging_sender]);

  useEffect(() => {
    if (info?.has_own_credentials) {
      setMode("self");
    }
  }, [info?.has_own_credentials]);

  // 자체 키 필드는 마스킹된 값을 placeholder처럼 사용 (입력 시 새 값)
  useEffect(() => {
    setOwnPpurioAccount(info?.own_ppurio_account ?? "");
  }, [info?.own_ppurio_account]);

  const handleSavePfid = () => {
    const value = pfid.trim();
    if (!value) return;
    updatePfid(value);
  };

  const handleCharge = () => {
    const amt = chargeAmount.replace(/,/g, "").trim();
    if (!amt || isNaN(Number(amt)) || Number(amt) <= 0) {
      feedback.error("올바른 충전 금액을 입력하세요.");
      return;
    }
    chargeCredits(amt, {
      onSuccess: () => {
        feedback.success(`${Number(amt).toLocaleString()}원 충전 요청이 완료되었습니다.`);
        setChargeAmount("");
      },
      onError: (err: unknown) => {
        const msg =
          err && typeof err === "object" && "response" in err
            ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
            : null;
        feedback.error(msg || "충전에 실패했습니다.");
      },
    });
  };

  const handleVerifySender = () => {
    const value = sender.replace(/-/g, "").trim();
    if (!value) {
      setVerifyResult({ verified: false, message: "발신번호를 입력해 주세요." });
      return;
    }
    setVerifyResult(null);
    verify(value, {
      onSuccess: (data) => setVerifyResult({ verified: data.verified, message: data.message }),
      onError: (err: { response?: { data?: { detail?: string; message?: string } }; message?: string }) => {
        const d = err?.response?.data;
        const msg =
          (typeof d?.detail === "string" ? d.detail : null) || d?.message || err?.message || "인증 확인에 실패했습니다.";
        setVerifyResult({ verified: false, message: msg });
      },
    });
  };

  const handleSaveSender = () => {
    updateInfo(
      { messaging_sender: sender.replace(/-/g, "").trim() },
      {
        onSuccess: () => {
          feedback.success("발신번호가 저장되었습니다.");
          setVerifyResult(null);
        },
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
    if (Object.keys(payload).length === 0) {
      feedback.error("API 키를 입력해 주세요.");
      return;
    }
    updateInfo(payload, {
      onSuccess: () => {
        feedback.success("자체 연동 키가 저장되었습니다.");
        setOwnSolapiKey("");
        setOwnSolapiSecret("");
        setOwnPpurioKey("");
      },
      onError: () => feedback.error("저장에 실패했습니다."),
    });
  };

  const handleClearOwnCredentials = () => {
    const payload: Record<string, string> = {
      own_solapi_api_key: "",
      own_solapi_api_secret: "",
      own_ppurio_api_key: "",
      own_ppurio_account: "",
    };
    updateInfo(payload, {
      onSuccess: () => {
        feedback.success("자체 연동 키가 해제되었습니다. 플랫폼 기본 키를 사용합니다.");
        setOwnSolapiKey("");
        setOwnSolapiSecret("");
        setOwnPpurioKey("");
        setOwnPpurioAccount("");
      },
      onError: () => feedback.error("해제에 실패했습니다."),
    });
  };

  const hasPfid = !!(info?.kakao_pfid);
  const hasSender = !!(info?.messaging_sender);
  const smsAllowed = info?.sms_allowed ?? false;
  const creditBalance = info?.credit_balance ? `${Number(info.credit_balance).toLocaleString()}원` : "0원";
  const isActive = info?.is_active ?? false;
  const hasOwnCreds = info?.has_own_credentials ?? false;

  return (
    <div className="flex flex-col gap-6">
      {/* KPI Cards */}
      {info && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: "var(--space-3)",
          }}
        >
          {[
            { label: "크레딧 잔액", content: <span style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.5px" }}>{creditBalance}</span> },
            {
              label: "발신번호",
              content: (
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{info.messaging_sender ?? "미등록"}</span>
                  <StatusChip ok={hasSender} label={hasSender ? "등록됨" : "미등록"} />
                </div>
              ),
            },
            {
              label: "알림톡 채널",
              content: (
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>
                    {info.channel_source === "tenant_override" ? "자체 채널" : "기본 채널"}
                  </span>
                  <StatusChip ok={hasPfid} label={hasPfid ? "연동됨" : "미연동"} />
                </div>
              ),
            },
            {
              label: "공급자",
              content: (
                <span style={{ fontSize: 14, fontWeight: 600 }}>
                  {(info.messaging_provider ?? "solapi") === "ppurio" ? "비즈뿌리오" : "솔라피"}
                </span>
              ),
            },
            {
              label: "연동 방식",
              content: (
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>
                    {hasOwnCreds ? "직접 연동" : "대행 (플랫폼)"}
                  </span>
                  <StatusChip ok={true} label={hasOwnCreds ? "자체 키" : "기본 키"} />
                </div>
              ),
            },
            { label: "서비스 상태", content: <StatusChip ok={isActive} label={isActive ? "활성화" : "비활성화"} /> },
          ].map(({ label, content }) => (
            <div
              key={label}
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
                {label}
              </div>
              <div style={{ color: "var(--color-text-primary)" }}>{content}</div>
            </div>
          ))}
        </div>
      )}

      {/* 연동 방식 선택 (대행요청 vs 직접연동) */}
      <Card>
        <SectionTitle>연동 방식</SectionTitle>
        <Desc>
          메시지 발송에 사용할 API 연동 방식을 선택하세요.
        </Desc>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {(
            [
              {
                key: "agency" as const,
                icon: FiShield,
                title: "대행 요청 (플랫폼 기본)",
                desc: "별도 API 키 없이 플랫폼이 제공하는 기본 연동을 사용합니다. 발신번호·채널만 설정하면 바로 사용 가능합니다.",
              },
              {
                key: "self" as const,
                icon: FiKey,
                title: "직접 연동 (본인 계정)",
                desc: "기존에 사용하던 솔라피/뿌리오 계정이 있다면 API 키를 등록하여 직접 발송합니다.",
              },
            ] as const
          ).map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => setMode(opt.key)}
              style={{
                flex: "1 1 240px",
                padding: "16px 20px",
                borderRadius: "var(--radius-lg)",
                border: `2px solid ${mode === opt.key ? "var(--color-primary)" : "var(--color-border-divider)"}`,
                background:
                  mode === opt.key
                    ? "color-mix(in srgb, var(--color-primary) 6%, var(--color-bg-surface))"
                    : "var(--color-bg-surface)",
                cursor: "pointer",
                textAlign: "left",
                transition: "border-color 0.15s, background 0.15s",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <opt.icon
                  size={16}
                  style={{
                    color: mode === opt.key ? "var(--color-primary)" : "var(--color-text-muted)",
                  }}
                />
                <span
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: mode === opt.key ? "var(--color-primary)" : "var(--color-text-primary)",
                  }}
                >
                  {opt.title}
                </span>
              </div>
              <div style={{ fontSize: 12, color: "var(--color-text-muted)", lineHeight: 1.5 }}>{opt.desc}</div>
            </button>
          ))}
        </div>
      </Card>

      {/* 메시징 공급자 선택 */}
      <Card>
        <SectionTitle>메시징 공급자</SectionTitle>
        <Desc>
          SMS·알림톡 발송에 사용할 공급자입니다.
          {mode === "agency"
            ? " 일반적으로 운영자가 지정하며, 변경이 필요하면 운영자에게 문의하세요."
            : " 직접 연동 시 본인 계정의 공급자를 선택하세요."}
        </Desc>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <FiSettings size={16} style={{ color: "var(--color-primary)" }} aria-hidden />
          <div
            style={{
              display: "flex",
              gap: 0,
              borderRadius: "var(--radius-md)",
              overflow: "hidden",
              border: "1px solid var(--color-border-divider)",
            }}
          >
            {([
              { key: "solapi" as const, label: "솔라피(Solapi)" },
              { key: "ppurio" as const, label: "비즈뿌리오(BizPpurio)" },
            ]).map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => {
                  setProvider(opt.key);
                  updateInfo(
                    { messaging_provider: opt.key },
                    {
                      onSuccess: () => feedback.success(`메시징 공급자가 ${opt.label}(으)로 변경되었습니다.`),
                      onError: () => feedback.error("공급자 변경에 실패했습니다."),
                    },
                  );
                }}
                disabled={isUpdatingInfo}
                style={{
                  padding: "8px 18px",
                  fontSize: 13,
                  fontWeight: 600,
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
          <span style={{ fontSize: 12, color: "var(--color-text-muted)", marginLeft: 4 }}>
            현재: <strong style={{ color: "var(--color-text-primary)" }}>{provider === "ppurio" ? "비즈뿌리오" : "솔라피"}</strong>
          </span>
        </div>
      </Card>

      {/* 직접 연동 모드: 자체 API 키 입력 */}
      {mode === "self" && (
        <Card>
          <SectionTitle>
            <FiKey size={14} style={{ marginRight: 6, verticalAlign: "middle" }} />
            자체 API 키 등록
          </SectionTitle>
          <Desc>
            {provider === "solapi"
              ? "솔라피(Solapi) 콘솔에서 발급받은 API Key와 API Secret을 입력하세요. 저장 후 이 학원의 메시지는 입력한 계정으로 발송됩니다."
              : "비즈뿌리오(BizPpurio) 연동 페이지에서 발급받은 계정 ID와 API Key를 입력하세요. 저장 후 이 학원의 메시지는 비즈뿌리오를 통해 발송됩니다."}
          </Desc>

          {provider === "solapi" ? (
            <div className="flex flex-col gap-3">
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <Input
                  placeholder={info?.own_solapi_api_key ? `현재: ${info.own_solapi_api_key}` : "Solapi API Key"}
                  value={ownSolapiKey}
                  onChange={(e) => setOwnSolapiKey(e.target.value)}
                  style={{ maxWidth: 300 }}
                />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <Input
                  placeholder={info?.own_solapi_api_secret ? `현재: ${info.own_solapi_api_secret}` : "Solapi API Secret"}
                  value={ownSolapiSecret}
                  onChange={(e) => setOwnSolapiSecret(e.target.value)}
                  type="password"
                  style={{ maxWidth: 300 }}
                />
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div style={{ fontSize: 12, color: "var(--color-text-muted)", padding: "8px 12px", background: "var(--color-bg-surface-soft)", borderRadius: "var(--radius-md)", lineHeight: 1.6 }}>
                <strong>비즈뿌리오 연동 방법:</strong><br />
                1. <a href="https://bizppurio.com" target="_blank" rel="noopener noreferrer" style={{ color: "var(--color-primary)", textDecoration: "underline" }}>bizppurio.com</a> 에서 기업 회원 가입 (사업자등록증 필요)<br />
                2. 로그인 후 <strong>[환경설정 → 연동 관리]</strong>에서 API Key 발급<br />
                3. 아래에 <strong>계정 ID</strong>(로그인 아이디)와 <strong>API Key</strong>를 입력<br />
                4. 발신번호는 비즈뿌리오에서 별도로 등록·인증해야 합니다<br />
                5. 알림톡 사용 시: 카카오비즈니스 채널 개설 → 비즈뿌리오에서 발신프로필 등록 → 템플릿 승인 필요
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <Input
                  placeholder={info?.own_ppurio_account ? `현재: ${info.own_ppurio_account}` : "비즈뿌리오 계정 ID (로그인 아이디)"}
                  value={ownPpurioAccount}
                  onChange={(e) => setOwnPpurioAccount(e.target.value)}
                  style={{ maxWidth: 300 }}
                />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <Input
                  placeholder={info?.own_ppurio_api_key ? `현재: ${info.own_ppurio_api_key}` : "비즈뿌리오 API Key"}
                  value={ownPpurioKey}
                  onChange={(e) => setOwnPpurioKey(e.target.value)}
                  type="password"
                  style={{ maxWidth: 300 }}
                />
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
            <Button intent="primary" onClick={handleSaveOwnCredentials} disabled={isUpdatingInfo}>
              {isUpdatingInfo ? "저장 중…" : "API 키 저장"}
            </Button>
            {hasOwnCreds && (
              <Button intent="secondary" onClick={handleClearOwnCredentials} disabled={isUpdatingInfo}>
                자체 키 해제 (플랫폼 기본으로 전환)
              </Button>
            )}
          </div>

          {hasOwnCreds && (
            <p style={{ fontSize: 12, color: "var(--color-success)", marginTop: 8, display: "flex", alignItems: "center", gap: 4 }}>
              <FiCheckCircle size={12} />
              자체 API 키가 등록되어 있습니다. 이 학원의 메시지는 등록된 계정으로 발송됩니다.
            </p>
          )}
        </Card>
      )}

      {/* 대행 모드 안내 */}
      {mode === "agency" && (
        <Card>
          <SectionTitle>
            <FiShield size={14} style={{ marginRight: 6, verticalAlign: "middle" }} />
            플랫폼 대행 안내
          </SectionTitle>
          <Desc>
            별도 API 키 입력 없이 플랫폼에서 연동된 기본 계정으로 메시지가 발송됩니다.
            발신번호와 알림톡 채널만 설정하면 바로 사용할 수 있습니다.
          </Desc>
          <p style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
            발신번호 등록, 알림톡 채널 파트너 등록 등은 운영자가 처리합니다.
            궁금한 점이 있으면 운영자에게 문의하세요.
          </p>
        </Card>
      )}

      {/* 발신번호 설정 (인라인) */}
      <Card>
        <SectionTitle>발신번호</SectionTitle>
        <Desc>
          SMS·알림톡 발송 시 수신자에게 표시되는 학원 발신번호입니다.
          {mode === "agency"
            ? " 학원 전화번호를 사용하려면 운영자에게 해당 번호의 등록을 요청한 뒤 아래에 입력하세요."
            : " 직접 연동 계정에 등록된 발신번호를 입력하세요."}
        </Desc>
        <div className="flex flex-col gap-3">
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <FiPhone size={16} style={{ color: "var(--color-primary)" }} aria-hidden />
            <input
              type="tel"
              className="ds-input"
              placeholder="예: 01031217466"
              value={sender}
              onChange={(e) => {
                setSender(e.target.value);
                setVerifyResult(null);
              }}
              disabled={isUpdatingInfo || isVerifying}
              style={{ maxWidth: 200, fontSize: 15 }}
              aria-label="발신번호"
            />
            <Button
              intent="secondary"
              size="md"
              onClick={handleVerifySender}
              disabled={!sender.trim() || isVerifying || isUpdatingInfo}
            >
              {isVerifying ? "확인 중…" : "인증"}
            </Button>
            <Button
              intent="primary"
              size="md"
              onClick={handleSaveSender}
              disabled={!sender.trim() || isUpdatingInfo || isVerifying}
            >
              {isUpdatingInfo ? "저장 중…" : "저장"}
            </Button>
          </div>
          {verifyResult && (
            <p
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: verifyResult.verified ? "var(--color-success)" : "var(--color-error)",
                display: "flex",
                alignItems: "center",
                gap: 4,
                margin: 0,
              }}
            >
              {verifyResult.verified ? <FiCheckCircle size={13} /> : <FiAlertCircle size={13} />}
              {verifyResult.message}
            </p>
          )}
          <p style={{ fontSize: 12, color: "var(--color-text-muted)", margin: 0 }}>
            미설정 시 플랫폼 기본 번호로 발송됩니다.
            {mode === "agency" && " 발신번호 등록은 운영자에게 요청해 주세요."}
          </p>
        </div>
      </Card>

      {/* 크레딧 충전 */}
      <Card>
        <SectionTitle>크레딧 충전</SectionTitle>
        <Desc>
          메시지 발송에 사용할 크레딧을 충전합니다. 현재 잔액:{" "}
          <strong style={{ color: "var(--color-text-primary)" }}>{creditBalance}</strong>
        </Desc>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <FiPlusCircle size={16} style={{ color: "var(--color-primary)" }} aria-hidden />
          <Input
            placeholder="충전 금액 입력 (예: 10000)"
            value={chargeAmount}
            onChange={(e) => setChargeAmount(e.target.value.replace(/[^0-9]/g, ""))}
            onPressEnter={handleCharge}
            disabled={isCharging}
            style={{ maxWidth: 200 }}
            suffix="원"
          />
          <Button intent="primary" onClick={handleCharge} disabled={!chargeAmount.trim() || isCharging}>
            {isCharging ? "충전 중…" : "충전 요청"}
          </Button>
        </div>
        <p style={{ fontSize: 12, color: "var(--color-text-muted)", marginTop: 8 }}>
          충전 후 잔액은 자동으로 업데이트됩니다. 실제 결제는 운영자 확인 후 처리됩니다.
        </p>
      </Card>

      {/* 연동 테스트 */}
      <Card>
        <SectionTitle>연동 테스트</SectionTitle>
        <Desc>현재 설정된 API 키, 발신번호, 알림톡 채널이 정상 작동하는지 한 번에 확인합니다.</Desc>
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
          {testResult && (
            <span
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: testResult.all_ok ? "var(--color-success)" : "var(--color-error)",
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              {testResult.all_ok ? <FiCheckCircle size={13} /> : <FiAlertCircle size={13} />}
              {testResult.summary}
            </span>
          )}
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
                  padding: "8px 12px",
                  borderRadius: "var(--radius-md)",
                  background: c.ok
                    ? "color-mix(in srgb, var(--color-success) 6%, transparent)"
                    : "color-mix(in srgb, var(--color-error) 6%, transparent)",
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
          </div>
        )}
      </Card>

      {/* 연동 상태 */}
      <Card>
        <SectionTitle>연동 상태</SectionTitle>
        <Desc>현재 이 학원의 메시징 설정 상태입니다.</Desc>
        <div>
          <StatusRow
            label="연동 방식"
            value={hasOwnCreds ? "직접 연동 (본인 계정)" : "대행 (플랫폼 기본)"}
            ok={true}
            okLabel={hasOwnCreds ? "자체 키" : "기본 키"}
          />
          <StatusRow
            label="알림톡 채널"
            value={info?.channel_source === "tenant_override" ? "자체 채널 사용 중" : "기본 채널 사용 중"}
            ok={hasPfid}
            okLabel="PFID 연동됨"
            ngLabel="PFID 미설정"
          />
          <StatusRow label="카카오 PFID" value={info?.kakao_pfid ?? "미설정"} ok={hasPfid} okLabel="등록됨" ngLabel="미등록" />
          <StatusRow label="발신번호" value={info?.messaging_sender ?? "미등록"} ok={hasSender} okLabel="등록됨" ngLabel="미등록" />
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px 0",
            }}
          >
            <span style={{ fontSize: 13, color: "var(--color-text-muted)" }}>문자(SMS) 발송</span>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                padding: "2px 8px",
                borderRadius: "var(--radius-md)",
                fontSize: 11,
                fontWeight: 600,
                color: smsAllowed ? "var(--color-success)" : "var(--color-text-muted)",
                background: smsAllowed
                  ? "color-mix(in srgb, var(--color-success) 10%, transparent)"
                  : "var(--color-bg-surface-soft)",
              }}
            >
              {smsAllowed ? <FiCheckCircle size={11} aria-hidden /> : null}
              {smsAllowed ? "사용 가능" : "SMS 미연동"}
            </span>
          </div>
        </div>
      </Card>

      {/* 카카오 알림톡 채널 설정 */}
      <Card>
        <SectionTitle>카카오 알림톡 채널</SectionTitle>
        <p style={{ fontSize: 13, color: "var(--color-text-muted)", marginBottom: 4 }}>
          알림톡은 기본적으로 <strong style={{ color: "var(--color-text-primary)" }}>플랫폼 기본 채널</strong>로 발송됩니다.
          별도 설정 없이도 바로 알림톡을 사용할 수 있습니다.
        </p>
        <Desc>
          학원 이름으로 발송하고 싶다면, 카카오 비즈니스 채널을 개설한 뒤{" "}
          <strong style={{ color: "var(--color-text-primary)" }}>운영자에게 파트너 등록을 요청</strong>하세요.
          등록이 완료되면 발급받은 PFID를 아래에 입력하면 됩니다. (선택 사항)
        </Desc>
        <div className="flex flex-col gap-4">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <FiMessageCircle size={16} style={{ color: "var(--color-primary)" }} aria-hidden />
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-primary)" }}>
              카카오 PFID (프로필 ID)
            </span>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <Input
              placeholder="예: @xxxxx"
              value={pfid}
              onChange={(e) => setPfid(e.target.value)}
              disabled={isPending}
              style={{ maxWidth: 280 }}
              onPressEnter={handleSavePfid}
            />
            <Button intent="primary" onClick={handleSavePfid} disabled={!pfid.trim() || isPending}>
              {isPending ? "저장 중…" : "저장"}
            </Button>
          </div>
          {hasPfid && (
            <p style={{ fontSize: 12, color: "var(--color-text-muted)", margin: 0, display: "flex", alignItems: "center", gap: 5 }}>
              <FiCheckCircle size={12} style={{ color: "var(--color-success)" }} aria-hidden />
              현재 연동된 PFID: {info?.kakao_pfid}
            </p>
          )}
        </div>
      </Card>

      {/* 연동 가이드 — 모드에 따라 다른 가이드 */}
      <Card>
        <SectionTitle>연동 가이드</SectionTitle>
        {mode === "agency" ? (
          <>
            <Desc>
              처음 사용하시는 경우 아래 순서대로 진행하세요.
              별도 설정 없이도 플랫폼 기본 번호·채널로 바로 발송할 수 있습니다.
            </Desc>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <GuideStep step={1}>
                <strong>바로 시작하기</strong> — 설정 없이도 플랫폼 기본 발신번호와 기본 알림톡 채널로 메시지를 발송할 수 있습니다.
                「자동발송」 탭에서 트리거를 활성화하면 바로 동작합니다.
              </GuideStep>
              <GuideStep step={2}>
                <strong>학원 발신번호 사용하기 (선택)</strong> — 학원 전화번호로 발송하고 싶다면,
                운영자에게 번호 등록을 요청하세요. 등록 완료 후 위 발신번호란에서 해당 번호를 입력·저장하면 적용됩니다.
              </GuideStep>
              <GuideStep step={3}>
                <strong>학원 알림톡 채널 사용하기 (선택)</strong> — 학원 이름으로 알림톡을 보내고 싶다면:
                <br />① 카카오 비즈니스 센터에서 학원 채널을 개설합니다.
                <br />② 운영자에게 해당 채널의 파트너 등록을 요청합니다.
                <br />③ 등록 완료 후 발급받은 PFID를 위 입력란에 저장합니다.
              </GuideStep>
              <GuideStep step={4}>
                <strong>템플릿 작성</strong> — 「템플릿 저장」 탭에서 알림톡 양식을 작성하고 검수 신청합니다.
                카카오 검수 승인(영업일 1~3일) 후 알림톡 발송이 가능합니다.
              </GuideStep>
              <GuideStep step={5}>
                <strong>자동발송 설정</strong> — 「자동발송」 탭에서 구간별 트리거를 활성화하고,
                템플릿·발송 방식(알림톡/SMS/모두)·발송 시점을 설정합니다.
              </GuideStep>
            </div>
          </>
        ) : (
          <>
            <Desc>
              기존에 사용하던 {provider === "ppurio" ? "비즈뿌리오(BizPpurio)" : "솔라피(Solapi)"} 계정이 있다면 아래 순서로 연동하세요.
            </Desc>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <GuideStep step={1}>
                <strong>공급자 선택</strong> — 위에서 사용 중인 메시징 공급자({provider === "ppurio" ? "비즈뿌리오" : "솔라피"})를 선택합니다.
              </GuideStep>
              <GuideStep step={2}>
                <strong>API 키 등록</strong> —{" "}
                {provider === "solapi" ? (
                  <>
                    솔라피 콘솔(<code>console.solapi.com</code>) → 설정 → API Key에서
                    API Key와 API Secret을 복사하여 위에 입력합니다.
                    <br />※ 허용 IP에 서버 IP를 추가해야 발송이 정상 동작합니다.
                  </>
                ) : (
                  <>
                    비즈뿌리오(<code>bizppurio.com</code>) → 로그인 → [환경설정 → 연동 관리]에서 API Key를 확인하고, 계정 ID(로그인 아이디)와 함께 위에 입력합니다.
                    <br />※ 비즈뿌리오에서 발신번호를 별도로 등록·인증해야 합니다.
                  </>
                )}
              </GuideStep>
              <GuideStep step={3}>
                <strong>발신번호 등록</strong> — {provider === "solapi" ? "솔라피" : "비즈뿌리오"} 계정에 등록된 발신번호를
                위 발신번호란에 입력합니다. 등록되지 않은 번호로는 발송이 실패합니다.
              </GuideStep>
              <GuideStep step={4}>
                <strong>알림톡 채널 (선택)</strong> — 알림톡을 사용하려면 카카오 비즈니스 채널 PFID를 등록합니다.
                SMS만 사용한다면 이 단계는 생략해도 됩니다.
              </GuideStep>
              <GuideStep step={5}>
                <strong>템플릿·자동발송 설정</strong> — 「템플릿 저장」 탭에서 양식을 작성하고,
                「자동발송」 탭에서 트리거를 활성화합니다.
              </GuideStep>
            </div>
          </>
        )}
        <div
          style={{
            marginTop: 16,
            paddingTop: 14,
            borderTop: "1px solid var(--color-border-divider)",
            fontSize: 12,
            color: "var(--color-text-muted)",
          }}
        >
          {mode === "agency"
            ? "발신번호 등록, 알림톡 채널 파트너 등록 등은 운영자가 처리합니다. 궁금한 점이 있으면 운영자에게 문의하세요."
            : "직접 연동 시 API 키 관리, 발신번호 등록, 비용 청구 등은 본인 계정에서 직접 관리합니다."}
        </div>
      </Card>
    </div>
  );
}
