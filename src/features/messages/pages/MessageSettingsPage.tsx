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
} from "react-icons/fi";
import { Button } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";
import { useMessagingInfo, useUpdateKakaoPfid, useChargeCredits } from "../hooks/useMessagingInfo";

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
  const [pfid, setPfid] = useState("");
  const [chargeAmount, setChargeAmount] = useState("");

  useEffect(() => {
    if (info?.kakao_pfid != null) setPfid(info.kakao_pfid);
  }, [info?.kakao_pfid]);

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
              서비스 상태
            </div>
            <StatusChip ok={isActive} label={isActive ? "활성화" : "비활성화"} />
          </div>
        </div>
      )}

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

      {/* 카카오 알림톡 연동 */}
      <div
        style={{
          borderRadius: "var(--radius-lg)",
          padding: "var(--space-5)",
          border: "1px solid var(--color-border-divider)",
          background: "var(--color-bg-surface)",
        }}
      >
        <div style={{ fontWeight: 600, color: "var(--color-text-primary)", marginBottom: 4 }}>
          카카오 알림톡 연동
        </div>
        <p style={{ fontSize: 13, color: "var(--color-text-muted)", marginBottom: 12 }}>
          학원 전용 PFID를 설정하면 학원 채널로 알림톡을 발송할 수 있습니다.
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
          SMS·알림톡 발송 시 사용할 발신번호입니다. 솔라피에 등록된 번호만 사용 가능합니다.
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

      {/* Solapi 연동 가이드 */}
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
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <GuideStep step={1}>
            <strong>카카오 비즈니스 채널 개설</strong> — 카카오 비즈니스 관리자 센터에 접속해
            학원 채널을 개설합니다.
          </GuideStep>
          <GuideStep step={2}>
            <strong>파트너 등록</strong> — 채널 관리 → 파트너 관리에서 운영 파트너 계정을
            등록합니다. 파트너 등록 후 PFID(프로필 ID)를 발급받습니다.
          </GuideStep>
          <GuideStep step={3}>
            <strong>PFID 저장</strong> — 위 「카카오 알림톡 연동」 입력란에 발급받은 PFID를
            입력하고 저장합니다.
          </GuideStep>
          <GuideStep step={4}>
            <strong>발신번호 등록</strong> — 설정 &gt; 내 정보에서 솔라피에 등록된 발신번호를
            입력하고 인증합니다.
          </GuideStep>
          <GuideStep step={5}>
            <strong>템플릿 작성 및 검수 신청</strong> — 「템플릿 저장」 탭에서 알림톡 양식을
            작성하고 검수 신청합니다. 카카오 검수 승인 후 알림톡 발송이 가능합니다.
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
