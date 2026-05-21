// PATH: src/shared/ui/SubscriptionExpiredOverlay.tsx
// 구독 만료 시 전체 화면 차단 오버레이 — 402 이벤트 수신

import { useState, useEffect } from "react";
import { AlertTriangle, LogIn } from "lucide-react";
import { clearTokens } from "@/shared/api/axios";
import { getTenantBranding, getTenantIdFromCode, resolveTenantCode } from "@/shared/tenant";
import styles from "./SubscriptionExpiredOverlay.module.css";

type ExpiredDetail = {
  detail?: string;
  code?: string;
  plan?: string;
  expires_at?: string | null;
};

const PLAN_LABELS: Record<string, string> = {
  standard: "Standard",
  pro: "Pro",
  max: "Max",
};

export default function SubscriptionExpiredOverlay() {
  const [expired, setExpired] = useState<ExpiredDetail | null>(null);

  useEffect(() => {
    function handleExpired(e: Event) {
      const detail = (e as CustomEvent).detail ?? {};
      setExpired(detail);
    }
    window.addEventListener("subscription-expired", handleExpired);
    return () => window.removeEventListener("subscription-expired", handleExpired);
  }, []);

  if (!expired) return null;

  const tenantResult = resolveTenantCode();
  const tenantCode = tenantResult.ok ? tenantResult.code : "hakwonplus";
  const tenantId = getTenantIdFromCode(tenantCode);
  const branding = tenantId ? getTenantBranding(tenantId) : null;
  const tenantName = branding?.loginTitle || "학원플러스";
  const logoUrl = branding?.headerLogoUrl || branding?.logoUrl || null;
  const planLabel = expired.plan ? (PLAN_LABELS[expired.plan] ?? expired.plan) : null;

  return (
    <div
      className={styles.overlay}
      data-tenant={tenantCode}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="subscription-expired-title"
    >
      <div className={styles.panel}>
        <div className={styles.brandRow}>
          <span className={styles.brandMark} aria-hidden>
            {logoUrl ? <img src={logoUrl} alt="" /> : tenantName.slice(0, 1)}
          </span>
          <span className={styles.brandName}>{tenantName}</span>
        </div>

        <div className={styles.statusPill}>
          <AlertTriangle className={styles.statusIcon} aria-hidden />
          이용 연장 필요
        </div>

        <h2 id="subscription-expired-title" className={styles.title}>
          서비스 이용이 잠시 멈췄습니다
        </h2>

        <p className={styles.description}>
          학습 데이터는 그대로 보관되어 있습니다. 계속 이용하려면 학원 관리자에게 구독 갱신을 요청해 주세요.
        </p>

        {(planLabel || expired.expires_at) && (
          <dl className={styles.metaGrid}>
            {planLabel && (
              <div>
                <dt>요금제</dt>
                <dd>{planLabel}</dd>
              </div>
            )}
            {expired.expires_at && (
              <div>
                <dt>만료일</dt>
                <dd>{expired.expires_at}</dd>
              </div>
            )}
          </dl>
        )}

        <button
          onClick={() => {
            clearTokens();
            window.location.href = "/login";
          }}
          className={styles.actionButton}
        >
          <LogIn className={styles.actionIcon} aria-hidden />
          로그인 페이지로 이동
        </button>
      </div>
    </div>
  );
}
