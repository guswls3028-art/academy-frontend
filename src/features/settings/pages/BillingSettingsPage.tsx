// PATH: src/features/settings/pages/BillingSettingsPage.tsx
// 결제/구독 설정 페이지 — 요금제, 구독 상태, 남은 일수, 프로모션 할인, 해지 예약

import { useQuery } from "@tanstack/react-query";
import api from "@/shared/api/axios";
import CardManagementSection from "../components/CardManagementSection";
import styles from "./BillingSettingsPage.module.css";

type SubscriptionInfo = {
  plan: string;
  plan_display: string;
  monthly_price: number;
  original_price: number;
  is_promo: boolean;
  discount_rate: number;
  subscription_status: string;
  subscription_status_display: string;
  subscription_started_at: string | null;
  subscription_expires_at: string | null;
  is_subscription_active: boolean;
  days_remaining: number | null;
  billing_email: string;
  billing_mode: string;
  next_billing_at: string | null;
  cancel_at_period_end: boolean;
  canceled_at: string | null;
  tenant_code: string;
  tenant_name: string;
};

async function fetchSubscription(): Promise<SubscriptionInfo> {
  const res = await api.get<SubscriptionInfo>("/core/subscription/");
  return res.data;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "-";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.`;
  } catch {
    return dateStr;
  }
}

function formatPrice(price: number): string {
  return price.toLocaleString("ko-KR") + "원";
}

const STATUS_COLORS: Record<string, string> = {
  active: "var(--color-semantic-success, #22c55e)",
  grace: "var(--color-semantic-warning, #f59e0b)",
  expired: "var(--color-semantic-danger, #ef4444)",
};

const PLAN_COLORS: Record<string, string> = {
  standard: "#64748b",
  pro: "var(--color-primary, #6366f1)",
  max: "#f59e0b",
};

const BILLING_MODE_LABELS: Record<string, string> = {
  AUTO_CARD: "카드 자동결제",
  INVOICE_REQUEST: "세금계산서 청구",
};

export default function BillingSettingsPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["subscription-info"],
    queryFn: fetchSubscription,
    staleTime: 30_000,
    retry: 1,
  });

  if (isLoading) {
    return (
      <div className={styles.root}>
        <div className={styles.skeleton} />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className={styles.root}>
        <p className={styles.error}>구독 정보를 불러오지 못했습니다.</p>
      </div>
    );
  }

  const isExpired = !data.is_subscription_active;
  const statusColor = STATUS_COLORS[data.subscription_status] ?? "#9ca3af";
  const planColor = PLAN_COLORS[data.plan] ?? "var(--color-primary)";

  return (
    <div className={styles.root}>
      <h2 className={styles.title}>결제 / 구독</h2>
      <p className={styles.subtitle}>현재 요금제와 구독 상태를 확인합니다.</p>

      {/* Plan Badge */}
      <div className={styles.planSection}>
        <div className={styles.planBadge} style={{ background: planColor }}>
          {data.plan_display}
        </div>
        <span className={styles.planPrice}>
          {data.is_promo ? (
            <>
              <span style={{ textDecoration: "line-through", color: "var(--color-text-muted)", fontSize: "0.85em", marginRight: 6 }}>
                월 {formatPrice(data.original_price)}
              </span>
              <span style={{ fontWeight: 700 }}>
                월 {formatPrice(data.monthly_price)}
              </span>
              <span style={{
                marginLeft: 8,
                padding: "2px 8px",
                borderRadius: 12,
                background: "var(--color-semantic-danger, #ef4444)",
                color: "#fff",
                fontSize: "0.75em",
                fontWeight: 700,
              }}>
                {data.discount_rate}% 할인
              </span>
            </>
          ) : (
            <>월 {formatPrice(data.monthly_price)}</>
          )}
        </span>
      </div>

      {/* Status Card */}
      <div className={styles.card}>
        <div className={styles.cardRow}>
          <span className={styles.cardLabel}>구독 상태</span>
          <span className={styles.statusBadge} style={{ color: statusColor, borderColor: statusColor }}>
            {data.subscription_status_display}
          </span>
        </div>

        {data.cancel_at_period_end && !isExpired && (
          <div className={styles.cardRow}>
            <span className={styles.cardLabel} />
            <span style={{ fontSize: "0.85em", color: "var(--color-semantic-warning, #f59e0b)" }}>
              현재 기간 종료 후 자동 해지 예정
            </span>
          </div>
        )}

        <div className={styles.cardRow}>
          <span className={styles.cardLabel}>구독 시작일</span>
          <span className={styles.cardValue}>{formatDate(data.subscription_started_at)}</span>
        </div>

        <div className={styles.cardRow}>
          <span className={styles.cardLabel}>만료일</span>
          <span className={styles.cardValue}>{formatDate(data.subscription_expires_at)}</span>
        </div>

        <div className={styles.cardRow}>
          <span className={styles.cardLabel}>남은 이용일</span>
          <span
            className={styles.cardValue}
            style={{ fontWeight: 700, color: isExpired ? "var(--color-semantic-danger, #ef4444)" : undefined }}
          >
            {data.days_remaining != null
              ? isExpired
                ? "만료됨"
                : `${data.days_remaining.toLocaleString()}일`
              : "무제한"}
          </span>
        </div>

        <div className={styles.cardRow}>
          <span className={styles.cardLabel}>결제 방식</span>
          <span className={styles.cardValue}>
            {BILLING_MODE_LABELS[data.billing_mode] ?? data.billing_mode}
          </span>
        </div>

        {data.next_billing_at && (
          <div className={styles.cardRow}>
            <span className={styles.cardLabel}>다음 결제 예정일</span>
            <span className={styles.cardValue}>{formatDate(data.next_billing_at)}</span>
          </div>
        )}

        {data.billing_email && (
          <div className={styles.cardRow}>
            <span className={styles.cardLabel}>결제 이메일</span>
            <span className={styles.cardValue}>{data.billing_email}</span>
          </div>
        )}
      </div>

      {/* Card Management */}
      <CardManagementSection />

      {/* Expired Warning */}
      {isExpired && (
        <div className={styles.expiredBanner}>
          <strong>구독이 만료되었습니다.</strong>
          <p>서비스 이용을 계속하시려면 관리자에게 문의하거나 구독을 갱신해 주세요.</p>
        </div>
      )}

      {/* Info */}
      <div className={styles.infoSection}>
        <p className={styles.infoText}>
          결제 및 구독 관련 문의는 관리자에게 연락해 주세요.
        </p>
      </div>
    </div>
  );
}
