// PATH: src/app_teacher/domains/profile/pages/BillingPage.tsx
// 요금제/구독 조회 — 현재 요금제, 상태, 남은 일수, 결제 예정일
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { EmptyState } from "@/shared/ui/ds";
import { ChevronLeft, AlertCircle, CheckCircle, Award } from "@teacher/shared/ui/Icons";
import { Card } from "@teacher/shared/ui/Card";
import { Badge } from "@teacher/shared/ui/Badge";
import api from "@/shared/api/axios";

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

type BillingCard = {
  id: number;
  card_company?: string;       // 실제 백엔드 필드
  card_number_masked?: string; // 실제 백엔드 필드
  is_active?: boolean;
  created_at?: string;
};

async function fetchSubscription(): Promise<SubscriptionInfo> {
  const res = await api.get("/core/subscription/");
  return res.data;
}

async function fetchCards(): Promise<BillingCard[]> {
  try {
    const res = await api.get("/billing/cards/");
    return Array.isArray(res.data?.results) ? res.data.results : Array.isArray(res.data) ? res.data : [];
  } catch {
    return [];
  }
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

const BILLING_MODE_LABELS: Record<string, string> = {
  AUTO_CARD: "카드 자동결제",
  INVOICE_REQUEST: "세금계산서 청구",
};

export default function BillingPage() {
  const navigate = useNavigate();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["teacher-subscription"],
    queryFn: fetchSubscription,
    staleTime: 30_000,
    retry: 1,
  });

  const { data: cards } = useQuery({
    queryKey: ["teacher-billing-cards"],
    queryFn: fetchCards,
    staleTime: 60_000,
  });

  if (isLoading) return <EmptyState scope="panel" tone="loading" title="불러오는 중…" />;
  if (isError || !data) return <EmptyState scope="panel" tone="error" title="구독 정보를 불러오지 못했습니다." />;

  const isExpired = !data.is_subscription_active;
  const daysLeft = data.days_remaining;
  const statusTone: "success" | "warning" | "danger" =
    data.subscription_status === "active" ? "success" :
    data.subscription_status === "grace" ? "warning" : "danger";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 py-0.5">
        <button onClick={() => navigate(-1)} className="flex p-1 cursor-pointer"
          style={{ background: "none", border: "none", color: "var(--tc-text-secondary)" }}>
          <ChevronLeft size={20} />
        </button>
        <h1 className="text-[17px] font-bold flex-1" style={{ color: "var(--tc-text)" }}>결제 / 구독</h1>
      </div>

      {/* Expiry alert */}
      {isExpired && (
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "10px 12px", borderRadius: "var(--tc-radius)",
          background: "var(--tc-danger-bg)", border: "1px solid var(--tc-danger)",
        }}>
          <AlertCircle size={15} style={{ color: "var(--tc-danger)", flexShrink: 0 }} />
          <div className="text-[12px]" style={{ color: "var(--tc-text)", lineHeight: 1.5 }}>
            <strong>구독이 만료되었습니다.</strong> PC에서 결제 정보를 확인해 주세요.
          </div>
        </div>
      )}

      {/* Cancel reservation alert */}
      {data.cancel_at_period_end && !isExpired && (
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "10px 12px", borderRadius: "var(--tc-radius)",
          background: "var(--tc-warn-bg)", border: "1px solid var(--tc-warn)",
        }}>
          <AlertCircle size={15} style={{ color: "var(--tc-warn)", flexShrink: 0 }} />
          <div className="text-[12px]" style={{ color: "var(--tc-text)", lineHeight: 1.5 }}>
            <strong>해지 예약됨.</strong> {formatDate(data.subscription_expires_at)}에 구독이 종료됩니다.
          </div>
        </div>
      )}

      {/* Plan card */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Award size={18} style={{ color: "var(--tc-primary)" }} />
            <span className="text-[18px] font-bold" style={{ color: "var(--tc-text)" }}>{data.plan_display}</span>
          </div>
          <Badge tone={statusTone}>{data.subscription_status_display}</Badge>
        </div>

        <div className="mb-3">
          {data.is_promo ? (
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-[13px]" style={{ color: "var(--tc-text-muted)", textDecoration: "line-through" }}>
                월 {formatPrice(data.original_price)}
              </span>
              <span className="text-[20px] font-bold" style={{ color: "var(--tc-text)" }}>
                월 {formatPrice(data.monthly_price)}
              </span>
              <Badge tone="danger" size="xs">{data.discount_rate}% 할인</Badge>
            </div>
          ) : (
            <span className="text-[20px] font-bold" style={{ color: "var(--tc-text)" }}>
              월 {formatPrice(data.monthly_price)}
            </span>
          )}
        </div>

        <div className="flex flex-col gap-1.5" style={{ borderTop: "1px solid var(--tc-border-subtle)", paddingTop: 10 }}>
          <Row label="구독 시작" value={formatDate(data.subscription_started_at)} />
          <Row label="만료일" value={formatDate(data.subscription_expires_at)}
            valueColor={isExpired ? "var(--tc-danger)" : undefined} />
          {daysLeft != null && (
            <Row label="남은 일수" value={`${daysLeft}일`}
              valueColor={daysLeft < 7 ? "var(--tc-warn)" : daysLeft < 30 ? "var(--tc-text)" : "var(--tc-success)"} />
          )}
          <Row label="결제 방식" value={BILLING_MODE_LABELS[data.billing_mode] ?? data.billing_mode} />
          {data.next_billing_at && <Row label="다음 결제" value={formatDate(data.next_billing_at)} />}
        </div>
      </Card>

      {/* Cards */}
      <Card>
        <div className="text-sm font-bold mb-2" style={{ color: "var(--tc-text)" }}>등록된 카드</div>
        {cards && cards.length > 0 ? (
          <div className="flex flex-col gap-1.5">
            {cards.map((c) => (
              <div key={c.id} className="flex items-center justify-between"
                style={{ padding: "10px 12px", borderRadius: "var(--tc-radius-sm)", background: "var(--tc-surface-soft)" }}>
                <div className="flex items-center gap-2">
                  <CheckCircle size={14} style={{ color: c.is_active ? "var(--tc-success)" : "var(--tc-text-muted)" }} />
                  <div>
                    <div className="text-[13px] font-semibold" style={{ color: "var(--tc-text)" }}>
                      {c.card_company ?? "카드"}
                    </div>
                    {c.card_number_masked && (
                      <div className="text-[11px]" style={{ color: "var(--tc-text-muted)" }}>{c.card_number_masked}</div>
                    )}
                  </div>
                </div>
                {c.is_active ? <Badge tone="success" size="xs">활성</Badge> : <Badge tone="neutral" size="xs">비활성</Badge>}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-[12px] text-center py-3"
            style={{ color: "var(--tc-text-muted)", background: "var(--tc-surface-soft)", borderRadius: "var(--tc-radius-sm)" }}>
            등록된 카드가 없습니다.
          </div>
        )}
        <p className="text-[11px] mt-2" style={{ color: "var(--tc-text-muted)" }}>
          카드 등록/삭제는 PC 어드민 {">"} 설정 {">"} 결제에서 진행합니다.
        </p>
      </Card>

      {/* Tenant */}
      <Card>
        <div className="text-sm font-bold mb-2" style={{ color: "var(--tc-text)" }}>학원 정보</div>
        <div className="flex flex-col gap-1.5">
          <Row label="학원명" value={data.tenant_name} />
          <Row label="테넌트 코드" value={data.tenant_code} />
          <Row label="결제 이메일" value={data.billing_email || "-"} />
        </div>
      </Card>
    </div>
  );
}

function Row({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[12px]" style={{ color: "var(--tc-text-muted)" }}>{label}</span>
      <span className="text-[13px] font-semibold" style={{ color: valueColor ?? "var(--tc-text)" }}>{value}</span>
    </div>
  );
}
