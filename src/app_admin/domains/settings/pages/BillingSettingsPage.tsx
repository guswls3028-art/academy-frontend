// PATH: src/app_admin/domains/settings/pages/BillingSettingsPage.tsx
// 결제/구독 설정 페이지 — 요금제, 구독 상태, 남은 일수, 프로모션 할인, 해지 예약

import { useQuery } from "@tanstack/react-query";
import api from "@/shared/api/axios";
import { formatBillingDate as formatDate, formatKRW as formatPrice } from "@/shared/product/fees/feesFormat";
import { resolveBillingAmounts } from "@/shared/product/billingAmounts";
import CardManagementSection from "../components/CardManagementSection";
import { adminSettingsQueryKeys } from "../queryKeys";
import styles from "./BillingSettingsPage.module.css";

type SubscriptionInfo = {
  plan: string;
  plan_display: string;
  monthly_price: number;
  monthly_supply_amount?: number;
  monthly_tax_amount?: number;
  monthly_total_amount?: number;
  monthly_price_includes_tax?: boolean;
  vat_rate_percent?: number;
  original_price: number;
  list_monthly_total_amount?: number;
  is_promo: boolean;
  discount_rate: number;
  subscription_status: string;
  subscription_status_display: string;
  subscription_started_at: string | null;
  subscription_expires_at: string | null;
  service_access_expires_at?: string | null;
  grace_period_days?: number;
  grace_expires_at?: string | null;
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

const BILLING_MODE_LABELS: Record<string, string> = {
  AUTO_CARD: "카드 자동결제",
  INVOICE_REQUEST: "세금계산서 청구",
};

export default function BillingSettingsPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: adminSettingsQueryKeys.subscriptionInfo,
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
  const isGrace = data.subscription_status === "grace";
  const amounts = resolveBillingAmounts(data);
  const listTotalAmount = data.list_monthly_total_amount
    ?? resolveBillingAmounts({ monthly_price: data.original_price }).totalAmount;

  return (
    <div className={styles.root}>
      <h2 className={styles.title}>결제 / 구독</h2>
      <p className={styles.subtitle}>현재 요금제와 구독 상태를 확인합니다.</p>

      {/* Plan Badge */}
      <div className={styles.planSection}>
        <div className={styles.planBadge} data-plan={data.plan}>
          {data.plan_display}
        </div>
        <span className={styles.planPrice}>
          {data.is_promo ? (
            <>
              <span className={styles.originalPrice}>
                월 {formatPrice(listTotalAmount)}
              </span>
              <span className={styles.discountedPrice}>
                월 {formatPrice(amounts.totalAmount)}
              </span>
              <span className={styles.discountBadge}>
                {data.discount_rate}% 할인
              </span>
            </>
          ) : (
            <>월 {formatPrice(amounts.totalAmount)}</>
          )}
        </span>
      </div>

      {/* Status Card */}
      <div className={styles.card}>
        <div className={styles.cardRow}>
          <span className={styles.cardLabel}>월 공급가</span>
          <span className={styles.cardValue}>{formatPrice(amounts.supplyAmount)}</span>
        </div>

        <div className={styles.cardRow}>
          <span className={styles.cardLabel}>부가가치세 ({amounts.vatRatePercent}%)</span>
          <span className={styles.cardValue}>{formatPrice(amounts.taxAmount)}</span>
        </div>

        <div className={styles.cardRow}>
          <span className={styles.cardLabel}>월 결제 총액 (VAT 포함)</span>
          <strong className={styles.cardValue}>{formatPrice(amounts.totalAmount)}</strong>
        </div>

        <div className={styles.cardRow}>
          <span className={styles.cardLabel}>구독 상태</span>
          <span
            className={styles.statusBadge}
            data-status={data.subscription_status}
            aria-label={`구독 상태: ${data.subscription_status_display}`}
          >
            {data.subscription_status_display}
          </span>
        </div>

        {data.cancel_at_period_end && !isExpired && (
          <div className={styles.cardRow}>
            <span className={styles.cardLabel} />
            <span className={styles.cancelNotice}>
              현재 기간 종료 후 자동 해지 예정
            </span>
          </div>
        )}

        <div className={styles.cardRow}>
          <span className={styles.cardLabel}>구독 시작일</span>
          <span className={styles.cardValue}>{formatDate(data.subscription_started_at)}</span>
        </div>

        <div className={styles.cardRow}>
          <span className={styles.cardLabel}>구독 만료일</span>
          <span className={styles.cardValue}>{formatDate(data.subscription_expires_at)}</span>
        </div>

        {isGrace && (
          <div className={styles.cardRow}>
            <span className={styles.cardLabel}>
              유예 이용 종료일{data.grace_period_days != null ? ` (${data.grace_period_days}일)` : ""}
            </span>
            <span className={styles.cardValue}>
              {formatDate(data.grace_expires_at ?? data.service_access_expires_at ?? data.subscription_expires_at)}
            </span>
          </div>
        )}

        <div className={styles.cardRow}>
          <span className={styles.cardLabel}>남은 이용일</span>
          <span
            className={`${styles.cardValue} ${styles.remainingDays} ${isExpired ? styles.remainingDaysExpired : ""}`}
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
          <p>서비스 이용을 계속하시려면 학원플러스 운영팀에 문의하거나 구독을 갱신해 주세요.</p>
        </div>
      )}

      {/* Info */}
      <div className={styles.infoSection}>
        <p className={styles.infoText}>
          결제 및 구독 관련 문의는 학원플러스 운영팀에 연락해 주세요.
        </p>
      </div>
    </div>
  );
}
