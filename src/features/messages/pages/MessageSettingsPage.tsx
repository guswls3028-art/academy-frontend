// PATH: src/features/messages/pages/MessageSettingsPage.tsx
// 설정 — 카카오 연동 + 메시지 연동 + Solapi 가이드

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "antd";
import {
  FiCheckCircle,
  FiAlertCircle,
  FiMessageCircle,
  FiPhone,
  FiExternalLink,
  FiPlusCircle,
  FiSettings,
} from "react-icons/fi";
import { Button } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";
import {
  useMessagingInfo,
  useUpdateKakaoPfid,
  useChargeCredits,
  useUpdateMessagingInfo,
} from "../hooks/useMessagingInfo";
import type { MessagingProvider } from "../api/messages.api";

/** KPI용 상태 칩 (크레딧/발신번호/채널/서비스 상태) */
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
      {ok ? (
        <FiCheckCircle size={12} aria-hidden />
      ) : (
        <FiAlertCircle size={12} aria-hidden />
      )}
      {label}
    </span>
  );
}

/** 설정 상태 행 — label + value + status chip */
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
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "var(--color-text-primary)",
            }}
          >
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
          {ok ? (
            <FiCheckCircle size={11} aria-hidden />
          ) : (
            <FiAlertCircle size={11} aria-hidden />
          )}
          {ok ? (okLabel ?? "연동됨") : (ngLabel ?? "미설정")}
        </span>
      </div>
    </div>
  );
}

/** 가이드 단계 번호 + 내용 */
function GuideStep({
  step,
  children,
}: {
  step: number;
  children: React.ReactNode;
}) {
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
      <div
        style={{
          fontSize: 13,
          color: "var(--color-text-secondary)",
          lineHeight: 1.6,
          paddingTop: 3,
        }}
      >
        {children}
      </div>
    </div>
  );
}

export default function MessageSettingsPage() {
  const navigate = useNavigate();
  const { data: info } = useMessagingInfo();
  const { mutate: updatePfid, isPending } = useUpdateKakaoPfid();
  const { mutate: chargeCredits, isPending: isCharging } = useChargeCredits();
  const { mutate: updateInfo, isPending: isUpdatingInfo } = useUpdateMessagingInfo();
  const [pfid, setPfid] = useState("");
  const [chargeAmount, setChargeAmount] = useState("");
  const [provider, setProvider] = useState<MessagingProvider>("solapi");

  useEffect(() => {
    if (info?.kakao_pfid != null) setPfid(info.kakao_pfid);
  }, [info?.kakao_pfid]);

  useEffect(() => {
    if (info?.messaging_provider) setProvider(info.messaging_provider);
  }, [info?.messaging_provider]);

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

  const hasPfid = !!(info?.kakao_pfid);
  const hasSender = !!(info?.messaging_sender);
  const smsAllowed = info?.sms_allowed ?? false;

  const creditBalance = info?.credit_balance
    ? `${Number(info.credit_balance).toLocaleString()}원`
    : "0원";
  const isActive = info?.is_active ?? false;

  return (
    <div className="flex flex-col gap-6">
      {/* KPI: 크레딧 잔액 · 발신번호 · 알림톡 채널 · 서비스 상태 */}
      {info && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: "var(--space-3)",
          }}
        >
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
              공급자
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: "var(--color-text-primary)",
                }}
              >
                {(info.messaging_provider ?? "solapi") === "ppurio" ? "뿌리오" : "솔라피"}
              </span>
            </div>
          </div>
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

      {/* 메시징 공급자 선택 */}
      <div
        style={{
          borderRadius: "var(--radius-lg)",
          padding: "var(--space-5)",
          border: "1px solid var(--color-border-divider)",
          background: "var(--color-bg-surface)",
        }}
      >
        <div style={{ fontWeight: 600, color: "var(--color-text-primary)", marginBottom: 4 }}>
          메시징 공급자
        </div>
        <p style={{ fontSize: 13, color: "var(--color-text-muted)", marginBottom: 12 }}>
          SMS·알림톡 발송에 사용할 공급자를 선택합니다. 솔라피와 뿌리오 모두 플랫폼에서 연동되어 있으므로 선택만 하면 됩니다.
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <FiSettings size={16} style={{ color: "var(--color-primary)" }} aria-hidden />
          <div style={{ display: "flex", gap: 0, borderRadius: "var(--radius-md)", overflow: "hidden", border: "1px solid var(--color-border-divider)" }}>
            {(
              [
                { key: "solapi" as const, label: "솔라피(Solapi)" },
                { key: "ppurio" as const, label: "뿌리오(Ppurio)" },
              ] as const
            ).map((opt) => (
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
                  background:
                    provider === opt.key
                      ? "var(--color-primary)"
                      : "var(--color-bg-surface-soft)",
                  transition: "background 0.15s, color 0.15s",
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <span
            style={{
              fontSize: 12,
              color: "var(--color-text-muted)",
              marginLeft: 4,
            }}
          >
            현재:{" "}
            <strong style={{ color: "var(--color-text-primary)" }}>
              {provider === "ppurio" ? "뿌리오" : "솔라피"}
            </strong>
          </span>
        </div>
      </div>

      {/* 크레딧 충전 */}
      <div
        style={{
          borderRadius: "var(--radius-lg)",
          padding: "var(--space-5)",
          border: "1px solid var(--color-border-divider)",
          background: "var(--color-bg-surface)",
        }}
      >
        <div style={{ fontWeight: 600, color: "var(--color-text-primary)", marginBottom: 4 }}>
          크레딧 충전
        </div>
        <p style={{ fontSize: 13, color: "var(--color-text-muted)", marginBottom: 12 }}>
          메시지 발송에 사용할 크레딧을 충전합니다. 현재 잔액:{" "}
          <strong style={{ color: "var(--color-text-primary)" }}>{creditBalance}</strong>
        </p>
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
          <Button
            intent="primary"
            onClick={handleCharge}
            disabled={!chargeAmount.trim() || isCharging}
          >
            {isCharging ? "충전 중…" : "충전 요청"}
          </Button>
        </div>
        <p style={{ fontSize: 12, color: "var(--color-text-muted)", marginTop: 8 }}>
          충전 후 잔액은 자동으로 업데이트됩니다. 실제 결제는 운영자 확인 후 처리됩니다.
        </p>
      </div>

      {/* 연동 상태 */}
      <div
        style={{
          borderRadius: "var(--radius-lg)",
          padding: "var(--space-5)",
          border: "1px solid var(--color-border-divider)",
          background: "var(--color-bg-surface)",
        }}
      >
        <div style={{ fontWeight: 600, color: "var(--color-text-primary)", marginBottom: 4 }}>
          연동 상태
        </div>
        <p style={{ fontSize: 13, color: "var(--color-text-muted)", marginBottom: 12 }}>
          현재 이 학원의 메시징 설정 상태입니다.
        </p>
        <div>
          <StatusRow
            label="알림톡 채널"
            value={
              info?.channel_source === "tenant_override"
                ? "자체 채널 사용 중"
                : "기본 채널 사용 중"
            }
            ok={hasPfid}
            okLabel="PFID 연동됨"
            ngLabel="PFID 미설정"
          />
          <StatusRow
            label="카카오 PFID"
            value={info?.kakao_pfid ?? "미설정"}
            ok={hasPfid}
            okLabel="등록됨"
            ngLabel="미등록"
          />
          <StatusRow
            label="발신번호"
            value={info?.messaging_sender ?? "미등록"}
            ok={hasSender}
            okLabel="등록됨"
            ngLabel="미등록"
          />
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px 0",
            }}
          >
            <span style={{ fontSize: 13, color: "var(--color-text-muted)" }}>
              문자(SMS) 발송
            </span>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                padding: "2px 8px",
                borderRadius: "var(--radius-md)",
                fontSize: 11,
                fontWeight: 600,
                color: smsAllowed
                  ? "var(--color-success)"
                  : "var(--color-text-muted)",
                background: smsAllowed
                  ? "color-mix(in srgb, var(--color-success) 10%, transparent)"
                  : "var(--color-bg-surface-soft)",
              }}
            >
              {smsAllowed ? <FiCheckCircle size={11} aria-hidden /> : null}
              {smsAllowed ? "사용 가능" : "이 학원은 사용 불가"}
            </span>
          </div>
        </div>
      </div>

      {/* 카카오 알림톡 채널 설정 */}
      <div
        style={{
          borderRadius: "var(--radius-lg)",
          padding: "var(--space-5)",
          border: "1px solid var(--color-border-divider)",
          background: "var(--color-bg-surface)",
        }}
      >
        <div style={{ fontWeight: 600, color: "var(--color-text-primary)", marginBottom: 4 }}>
          카카오 알림톡 채널
        </div>
        <p style={{ fontSize: 13, color: "var(--color-text-muted)", marginBottom: 4 }}>
          기본적으로 <strong style={{ color: "var(--color-text-primary)" }}>플랫폼 기본 채널</strong>로 알림톡이 발송됩니다.
          학원 자체 카카오 비즈니스 채널을 사용하려면 아래에 PFID를 입력하세요.
        </p>
        <p style={{ fontSize: 12, color: "var(--color-text-muted)", marginBottom: 12 }}>
          PFID 미설정 시 플랫폼에서 제공하는 기본 채널로 발송됩니다. 자체 채널 설정은 선택 사항입니다.
        </p>
        <div className="flex flex-col gap-4">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <FiMessageCircle
              size={16}
              style={{ color: "var(--color-primary)" }}
              aria-hidden
            />
            <span
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "var(--color-text-primary)",
              }}
            >
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
            <Button
              intent="primary"
              onClick={handleSavePfid}
              disabled={!pfid.trim() || isPending}
            >
              {isPending ? "저장 중…" : "저장"}
            </Button>
          </div>
          {hasPfid && (
            <p
              style={{
                fontSize: 12,
                color: "var(--color-text-muted)",
                margin: 0,
                display: "flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              <FiCheckCircle
                size={12}
                style={{ color: "var(--color-success)" }}
                aria-hidden
              />
              현재 연동된 PFID: {info?.kakao_pfid}
            </p>
          )}
        </div>
      </div>

      {/* 발신번호 설정 */}
      <div
        style={{
          borderRadius: "var(--radius-lg)",
          padding: "var(--space-5)",
          border: "1px solid var(--color-border-divider)",
          background: "var(--color-bg-surface)",
        }}
      >
        <div style={{ fontWeight: 600, color: "var(--color-text-primary)", marginBottom: 4 }}>
          발신번호
        </div>
        <p style={{ fontSize: 13, color: "var(--color-text-muted)", marginBottom: 12 }}>
          SMS·알림톡 발송 시 표시되는 발신번호입니다.
          선택한 공급자({provider === "ppurio" ? "뿌리오" : "솔라피"})에 사전 등록·인증된 번호만 사용할 수 있습니다.
        </p>
        <div className="flex flex-col gap-3">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <FiPhone
              size={16}
              style={{ color: "var(--color-primary)" }}
              aria-hidden
            />
            <span
              style={{
                fontSize: 13,
                color: "var(--color-text-secondary)",
              }}
            >
              발신번호는{" "}
              <strong style={{ color: "var(--color-text-primary)" }}>
                설정 &gt; 내 정보
              </strong>
              에서 등록·인증할 수 있습니다.
            </span>
          </div>
          <Button
            intent="secondary"
            size="sm"
            onClick={() => navigate("/admin/settings/account")}
            style={{ alignSelf: "flex-start" }}
          >
            <FiExternalLink size={13} style={{ marginRight: 5 }} aria-hidden />
            설정 &gt; 내 정보로 이동
          </Button>
        </div>
      </div>

      {/* 연동 가이드 */}
      <div
        style={{
          borderRadius: "var(--radius-lg)",
          padding: "var(--space-5)",
          border: "1px solid var(--color-border-divider)",
          background: "var(--color-bg-surface)",
        }}
      >
        <div style={{ fontWeight: 600, color: "var(--color-text-primary)", marginBottom: 4 }}>
          연동 가이드
        </div>
        <p style={{ fontSize: 13, color: "var(--color-text-muted)", marginBottom: 12 }}>
          처음 연동하는 경우 아래 순서대로 진행하세요.
          자체 카카오 채널 없이도 플랫폼 기본 채널로 알림톡 발송이 가능합니다.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <GuideStep step={1}>
            <strong>메시징 공급자 선택</strong> — 위에서{" "}
            <strong>솔라피(Solapi)</strong> 또는 <strong>뿌리오(Ppurio)</strong>를 선택합니다.
            두 공급자 모두 플랫폼에서 연동되어 있으므로 별도 API 키 입력 없이 바로 사용 가능합니다.
          </GuideStep>
          <GuideStep step={2}>
            <strong>발신번호 등록</strong> — 설정 &gt; 내 정보에서 발신번호를 입력하고 인증합니다.
            발신번호는 선택한 공급자({provider === "ppurio" ? "뿌리오" : "솔라피"})에 사전 등록된 번호여야 합니다.
          </GuideStep>
          <GuideStep step={3}>
            <strong>알림톡 채널 설정 (선택)</strong> — 학원 자체 카카오 비즈니스 채널이 있으면
            PFID를 등록하세요. <strong>설정하지 않아도 플랫폼 기본 채널로 알림톡이 발송됩니다.</strong>
          </GuideStep>
          <GuideStep step={4}>
            <strong>템플릿 작성 및 검수 신청</strong> — 「템플릿 저장」 탭에서 알림톡 양식을
            작성하고 검수 신청합니다. 카카오 검수 승인(영업일 1~3일) 후 알림톡 발송이 가능합니다.
          </GuideStep>
          <GuideStep step={5}>
            <strong>자동발송 설정</strong> — 「자동발송」 탭에서 구간별 트리거를 활성화하고
            템플릿·발송 방식·발송 시점을 설정합니다.
          </GuideStep>

          <div
            style={{
              marginTop: 4,
              paddingTop: 14,
              borderTop: "1px solid var(--color-border-divider)",
              fontSize: 12,
              color: "var(--color-text-muted)",
            }}
          >
            궁금한 점이 있으면 운영자에게 문의하세요. 가이드 이미지나 상세 매뉴얼은 필요 시
            이 영역에 추가할 수 있습니다.
          </div>
        </div>
      </div>
    </div>
  );
}
