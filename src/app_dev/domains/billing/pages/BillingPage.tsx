// PATH: src/dev_app/pages/BillingPage.tsx
// Billing admin dashboard — tenant subscription overview + actions

import { useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { CalendarPlus, CreditCard, Search } from "lucide-react";
import {
  useBillingTenants,
  useBillingDashboard,
  useBillingInvoices,
  useExtendSubscription,
  useChangePlan,
  useMarkInvoicePaid,
} from "@dev/domains/billing/hooks/useBilling";
import { useDevToast } from "@dev/shared/components/useDevToast";
import type { TenantSubscriptionDto, InvoiceDto } from "@dev/domains/billing/api/billing.api";
import s from "@dev/layout/DevLayout.module.css";
import b from "./BillingPage.module.css";

// Exempt tenant IDs — 개발/테스트/시스템 (backend BILLING_EXEMPT_TENANT_IDS와 동일)
const EXEMPT_TENANT_IDS = new Set([1, 2, 9999]);

function isExempt(tenantId: number): boolean {
  return EXEMPT_TENANT_IDS.has(tenantId);
}

function getProgramId(t: TenantSubscriptionDto): number {
  return t.program_id ?? t.tenant_id;
}

// ── Helpers ──

function formatDate(d: string | null): string {
  if (!d) return "-";
  return d.replace(/-/g, ". ") + ".";
}

function formatPrice(n: number): string {
  return n.toLocaleString("ko-KR");
}

function formatMoney(n: number): string {
  return `${formatPrice(n)}원`;
}

function parsePositiveInt(value: string): number | null {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseLocalDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getExtensionPreview(expiresAt: string | null, days: number): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const currentExpiry = expiresAt ? parseLocalDate(expiresAt) : today;
  const base = currentExpiry > today ? currentExpiry : today;
  const next = new Date(base);
  next.setDate(next.getDate() + days);
  return formatDate(toIsoDate(next));
}

const STATUS_LABELS: Record<string, string> = {
  active: "정상",
  grace: "유예",
  expired: "만료",
};

const PLAN_LABELS: Record<string, string> = {
  standard: "Standard",
  pro: "Pro",
  max: "Max",
};

const BILLING_MODE_LABELS: Record<string, string> = {
  AUTO_CARD: "카드 자동",
  MANUAL_INVOICE: "수동 청구",
};

type Tab = "tenants" | "invoices";

const EXTEND_PRESETS = [
  { days: 30, label: "+30일", caption: "1개월" },
  { days: 90, label: "+90일", caption: "3개월" },
  { days: 180, label: "+180일", caption: "6개월" },
  { days: 365, label: "+365일", caption: "1년" },
];

const PLAN_OPTIONS = [
  { value: "standard", label: "Standard", price: 99000, caption: "기본 운영" },
  { value: "pro", label: "Pro", price: 198000, caption: "성장형" },
  { value: "max", label: "Max", price: 330000, caption: "대형 학원" },
];

function statusKey(status: string): string {
  return status.toLowerCase().replace(/[^a-z0-9_-]/g, "");
}

// ── Main Component ──

export default function BillingPage() {
  const { toast } = useDevToast();
  const [tab, setTab] = useState<Tab>("tenants");
  const [tenantQuery, setTenantQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [planFilter, setPlanFilter] = useState("");
  const [expiringOnly, setExpiringOnly] = useState(false);
  const [invoiceStatus, setInvoiceStatus] = useState("");

  // Queries
  const { data: tenants, isLoading: tenantsLoading } = useBillingTenants();
  const { data: dashboard } = useBillingDashboard();
  const { data: invoicesData, isLoading: invoicesLoading } = useBillingInvoices(
    invoiceStatus ? { status: invoiceStatus } : undefined,
  );

  // Mutations
  const extendMut = useExtendSubscription();
  const changePlanMut = useChangePlan();
  const markPaidMut = useMarkInvoicePaid();

  // Modal state
  const [extendModal, setExtendModal] = useState<TenantSubscriptionDto | null>(null);
  const [extendDays, setExtendDays] = useState("30");
  const [planModal, setPlanModal] = useState<TenantSubscriptionDto | null>(null);
  const [newPlan, setNewPlan] = useState("");
  const extendDaysNumber = parsePositiveInt(extendDays);
  const extendPreview = extendModal && extendDaysNumber
    ? getExtensionPreview(extendModal.subscription_expires_at, extendDaysNumber)
    : null;
  const selectedPlan = PLAN_OPTIONS.find((p) => p.value === newPlan);

  // Filtered tenants
  const filtered = useMemo(() => {
    if (!tenants) return [];
    let list = tenants;
    const query = tenantQuery.trim().toLowerCase();
    if (query) {
      list = list.filter((t) =>
        t.tenant_code.toLowerCase().includes(query) ||
        (t.tenant_name || "").toLowerCase().includes(query),
      );
    }
    if (statusFilter) list = list.filter((t) => t.subscription_status === statusFilter);
    if (planFilter) list = list.filter((t) => t.plan === planFilter);
    if (expiringOnly) list = list.filter((t) => t.days_remaining !== null && t.days_remaining <= 7);
    return list;
  }, [tenants, tenantQuery, statusFilter, planFilter, expiringOnly]);

  // ── Actions ──

  function openExtendModal(t: TenantSubscriptionDto, days = 30) {
    setExtendModal(t);
    setExtendDays(String(days));
  }

  function openPlanModal(t: TenantSubscriptionDto) {
    setPlanModal(t);
    setNewPlan(t.plan);
  }

  async function handleExtend() {
    if (!extendModal) return;
    const days = parsePositiveInt(extendDays);
    if (!days) {
      toast("1 이상의 일수를 입력하세요.", "error");
      return;
    }
    try {
      const result = await extendMut.mutateAsync({
        programId: getProgramId(extendModal),
        days,
      });
      toast(`${result.tenant_code} ${days}일 연장 완료 (만료일 ${formatDate(result.subscription_expires_at)})`);
      setExtendModal(null);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } };
      toast("연장 실패: " + (err.response?.data?.detail || String(e)), "error");
    }
  }

  async function handleChangePlan() {
    if (!planModal || !newPlan) return;
    try {
      const result = await changePlanMut.mutateAsync({
        programId: getProgramId(planModal),
        plan: newPlan,
      });
      toast(`${result.tenant_code} -> ${result.plan_display} (${formatMoney(result.monthly_price)})`);
      setPlanModal(null);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } };
      toast("플랜 변경 실패: " + (err.response?.data?.detail || String(e)), "error");
    }
  }

  async function handleMarkPaid(inv: InvoiceDto) {
    const liveWarn = !EXEMPT_TENANT_IDS.has(
      tenants?.find((t) => t.tenant_code === inv.tenant_code)?.tenant_id ?? 0
    )
      ? "\n\n[LIVE TENANT] 이 작업은 운영 테넌트의 실제 구독 상태를 변경합니다."
      : "";
    if (!confirm(`${inv.invoice_number} 입금 확인하시겠습니까?\n금액: ${formatMoney(inv.total_amount)}${liveWarn}`)) return;
    try {
      await markPaidMut.mutateAsync(inv.id);
      toast(`${inv.invoice_number} 입금 확인 완료`);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } };
      toast("입금 확인 실패: " + (err.response?.data?.detail || String(e)), "error");
    }
  }

  return (
    <>
      <header className={s.header}>
        <div className={s.headerLeft}>
          <Link to="/dev/dashboard" className={b.breadcrumbLink}>
            대시보드
          </Link>
          <span className={b.breadcrumbSeparator}>/</span>
          <span className={b.breadcrumbCurrent}>결제 관리</span>
        </div>
      </header>

      <div className={s.content}>
        {/* ── Dashboard Summary ── */}
        {dashboard && (
          <div className={b.summaryGrid}>
            <SummaryCard label="월 반복 매출" value={formatMoney(dashboard.mrr)} />
            <SummaryCard label="전체 테넌트" value={String(dashboard.total_tenants)} />
            <SummaryCard label="7일 내 만료" value={String(dashboard.expiring_soon)} warn={dashboard.expiring_soon > 0} />
            <SummaryCard label="연체 인보이스" value={String(dashboard.overdue_invoices)} warn={dashboard.overdue_invoices > 0} />
          </div>
        )}

        {/* ── Tab Bar ── */}
        <div className={b.tabBar}>
          <TabBtn active={tab === "tenants"} onClick={() => setTab("tenants")}>테넌트 구독</TabBtn>
          <TabBtn active={tab === "invoices"} onClick={() => setTab("invoices")}>인보이스</TabBtn>
        </div>

        {/* ── Tenants Tab ── */}
        {tab === "tenants" && (
          <>
            {/* Filters */}
            <div className={b.controlBar}>
              <label className={b.searchWrap}>
                <Search className={b.searchIcon} size={16} strokeWidth={1.8} />
                <input
                  className={`${s.input} ${b.searchInput}`}
                  value={tenantQuery}
                  onChange={(e) => setTenantQuery(e.target.value)}
                  placeholder="테넌트명 또는 코드 검색"
                />
              </label>
              <div className={b.filters}>
                <select className={`${s.input} ${b.filterSelect}`}
                  value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                  <option value="">전체 상태</option>
                  <option value="active">정상</option>
                  <option value="grace">유예</option>
                  <option value="expired">만료</option>
                </select>
                <select className={`${s.input} ${b.filterSelect}`}
                  value={planFilter} onChange={(e) => setPlanFilter(e.target.value)}>
                  <option value="">전체 요금제</option>
                  <option value="standard">Standard</option>
                  <option value="pro">Pro</option>
                  <option value="max">Max</option>
                </select>
                <label className={b.checkboxLabel}>
                  <input type="checkbox" checked={expiringOnly} onChange={(e) => setExpiringOnly(e.target.checked)} />
                  7일 내 만료
                </label>
              </div>
            </div>

            <div className={`${s.card} ${b.desktopTableCard}`}>
              {tenantsLoading ? (
                <div className={`${s.skeleton} ${b.loadingSkeleton}`} />
              ) : (
                <div className={b.tableScroller}>
                  <table className={s.table}>
                    <thead>
                      <tr>
                        <th>테넌트</th>
                        <th>요금제</th>
                        <th>상태</th>
                        <th>만료일</th>
                        <th>잔여</th>
                        <th>다음 결제</th>
                        <th>방식</th>
                        <th>월 금액</th>
                        <th>조작</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((t) => (
                        <tr key={t.tenant_id} className={isExempt(t.tenant_id) ? b.exemptRow : undefined}>
                          <td className={b.tenantCell}>
                            <span className={b.tenantNameLine}>
                              {t.tenant_name || t.tenant_code}
                              <TenantTypeBadge exempt={isExempt(t.tenant_id)} />
                            </span>
                            <div className={b.tenantCode}>{t.tenant_code}</div>
                          </td>
                          <td>{PLAN_LABELS[t.plan] || t.plan}</td>
                          <td>
                            <StatusBadge status={t.subscription_status} />
                            {t.cancel_at_period_end && (
                              <span className={b.cancelNotice}>
                                Cancel scheduled
                              </span>
                            )}
                          </td>
                          <td className={b.dateCell}>{formatDate(t.subscription_expires_at)}</td>
                          <td>
                            <DaysCell days={t.days_remaining} />
                          </td>
                          <td className={b.dateCell}>{formatDate(t.next_billing_at)}</td>
                          <td className={b.billingModeCell}>
                            {BILLING_MODE_LABELS[t.billing_mode] || t.billing_mode}
                          </td>
                          <td className={b.numericCell}>
                            {formatMoney(t.monthly_price)}
                          </td>
                          <td>
                            <div className={b.rowActions}>
                              <button className={`${s.btn} ${s.btnSm}`}
                                onClick={() => openExtendModal(t, 365)}>
                                <CalendarPlus size={13} strokeWidth={1.8} />
                                1년
                              </button>
                              <button className={`${s.btn} ${s.btnSm}`}
                                onClick={() => openExtendModal(t)}>
                                연장
                              </button>
                              <button className={`${s.btn} ${s.btnSm}`}
                                onClick={() => openPlanModal(t)}>
                                <CreditCard size={13} strokeWidth={1.8} />
                                요금제
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {filtered.length === 0 && (
                        <tr><td colSpan={9} className={b.emptyCell}>
                          조건에 맞는 테넌트가 없습니다.
                        </td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {tenantsLoading && (
              <div className={b.mobileTenantList}>
                <div className={`${s.skeleton} ${b.loadingSkeleton}`} />
              </div>
            )}

            {!tenantsLoading && (
              <div className={b.mobileTenantList}>
                {filtered.map((t) => (
                  <article key={t.tenant_id} className={b.mobileTenantCard}>
                    <div className={b.mobileTenantHeader}>
                      <div>
                        <div className={b.mobileTenantName}>
                          {t.tenant_name || t.tenant_code}
                          <TenantTypeBadge exempt={isExempt(t.tenant_id)} />
                        </div>
                        <div className={b.tenantCode}>{t.tenant_code}</div>
                      </div>
                      <StatusBadge status={t.subscription_status} />
                    </div>
                    <div className={b.mobileMetricGrid}>
                      <Metric label="요금제" value={PLAN_LABELS[t.plan] || t.plan} />
                      <Metric label="만료일" value={formatDate(t.subscription_expires_at)} />
                      <Metric label="잔여" value={t.days_remaining === null ? "제한 없음" : `${t.days_remaining}일`} tone={t.days_remaining !== null && t.days_remaining <= 7 ? "warn" : undefined} />
                      <Metric label="다음 결제" value={formatDate(t.next_billing_at)} />
                      <Metric label="방식" value={BILLING_MODE_LABELS[t.billing_mode] || t.billing_mode} />
                      <Metric label="월 금액" value={formatMoney(t.monthly_price)} />
                    </div>
                    <div className={b.mobileActions}>
                      <button className={`${s.btn} ${s.btnPrimary}`}
                        onClick={() => openExtendModal(t, 365)}>
                        <CalendarPlus size={16} strokeWidth={1.8} />
                        1년 연장
                      </button>
                      <button className={`${s.btn} ${s.btnSecondary}`}
                        onClick={() => openExtendModal(t)}>
                        기간 설정
                      </button>
                      <button className={`${s.btn} ${s.btnSecondary}`}
                        onClick={() => openPlanModal(t)}>
                        <CreditCard size={16} strokeWidth={1.8} />
                        요금제
                      </button>
                    </div>
                  </article>
                ))}
                {filtered.length === 0 && (
                  <div className={b.mobileEmpty}>
                    조건에 맞는 테넌트가 없습니다.
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* ── Invoices Tab ── */}
        {tab === "invoices" && (
          <>
            <div className={b.filters}>
              <select className={`${s.input} ${b.filterSelect}`}
                value={invoiceStatus} onChange={(e) => setInvoiceStatus(e.target.value)}>
                <option value="">전체 상태</option>
                <option value="SCHEDULED">예정</option>
                <option value="PENDING">대기</option>
                <option value="PAID">입금 완료</option>
                <option value="FAILED">실패</option>
                <option value="OVERDUE">연체</option>
                <option value="VOID">무효</option>
              </select>
            </div>

            <div className={s.card}>
              {invoicesLoading ? (
                <div className={`${s.skeleton} ${b.loadingSkeleton}`} />
              ) : (
                <div className={b.tableScroller}>
                  <table className={s.table}>
                    <thead>
                      <tr>
                        <th>인보이스</th>
                        <th>테넌트</th>
                        <th>금액</th>
                        <th>기간</th>
                        <th>납기</th>
                        <th>상태</th>
                        <th>입금일</th>
                        <th>조작</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoicesData?.results.map((inv) => (
                        <tr key={inv.id}>
                          <td className={b.invoiceNumberCell}>{inv.invoice_number}</td>
                          <td>{inv.tenant_code}</td>
                          <td className={b.numericCell}>{formatMoney(inv.total_amount)}</td>
                          <td className={b.periodCell}>{inv.period_start} ~ {inv.period_end}</td>
                          <td className={b.dateCell}>{inv.due_date}</td>
                          <td><InvoiceStatusBadge status={inv.status} /></td>
                          <td className={b.mutedSmallCell}>
                            {inv.paid_at ? inv.paid_at.split("T")[0] : "-"}
                          </td>
                          <td>
                            {["PENDING", "OVERDUE", "FAILED"].includes(inv.status) && (
                              <button
                                className={`${s.btn} ${s.btnSm} ${s.btnPrimary}`}
                                onClick={() => handleMarkPaid(inv)}
                                disabled={markPaidMut.isPending}
                              >
                                입금 확인
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                      {(!invoicesData?.results || invoicesData.results.length === 0) && (
                        <tr><td colSpan={8} className={b.emptyCell}>
                          인보이스가 없습니다.
                        </td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── Extend Modal ── */}
      {extendModal && (
        <div className={s.overlay} onClick={() => setExtendModal(null)}>
          <div className={s.modal} onClick={(e) => e.stopPropagation()}>
            <div className={s.modalHeader}>
              <h2 className={s.modalTitle}>구독 기간 연장</h2>
              <p className={s.modalSub}>프리셋을 고르거나 필요한 일수를 직접 입력하세요.</p>
            </div>
            <div className={s.modalBody}>
              <p className={b.modalIntro}>
                <strong>{extendModal.tenant_name || extendModal.tenant_code}</strong>
                {" "}<TenantTypeBadge exempt={isExempt(extendModal.tenant_id)} />
                <br />
                <span className={b.modalMeta}>
                  현재 {STATUS_LABELS[extendModal.subscription_status] || extendModal.subscription_status}
                  {" / "}만료일 {formatDate(extendModal.subscription_expires_at)}
                  {extendModal.days_remaining !== null && ` (${extendModal.days_remaining}일 남음)`}
                </span>
              </p>
              {!isExempt(extendModal.tenant_id) && <LiveWarning action="extend" />}
              <div className={b.presetGrid} role="group" aria-label="연장 기간 프리셋">
                {EXTEND_PRESETS.map((preset) => (
                  <button
                    key={preset.days}
                    type="button"
                    className={b.presetButton}
                    data-active={extendDays === String(preset.days) ? "true" : undefined}
                    onClick={() => setExtendDays(String(preset.days))}
                  >
                    <span>{preset.label}</span>
                    <small>{preset.caption}</small>
                  </button>
                ))}
              </div>
              <label className={s.inputLabel}>직접 입력</label>
              <div className={b.daysInputRow}>
                <input className={s.input} type="number" min="1" max="3650"
                  value={extendDays} onChange={(e) => setExtendDays(e.target.value)}
                  autoFocus
                />
                <span>일</span>
              </div>
              <div className={b.previewBox}>
                <div>
                  <span>현재 만료일</span>
                  <strong>{formatDate(extendModal.subscription_expires_at)}</strong>
                </div>
                <div>
                  <span>변경 후 예상</span>
                  <strong>{extendPreview || "-"}</strong>
                </div>
              </div>
            </div>
            <div className={s.modalFooter}>
              <button className={`${s.btn} ${s.btnSecondary}`} onClick={() => setExtendModal(null)}>취소</button>
              <button className={`${s.btn} ${!isExempt(extendModal.tenant_id) ? s.btnDanger : s.btnPrimary}`}
                onClick={handleExtend} disabled={extendMut.isPending}>
                {extendMut.isPending ? "연장 중..." : "운영에 적용"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Plan Change Modal ── */}
      {planModal && (
        <div className={s.overlay} onClick={() => setPlanModal(null)}>
          <div className={s.modal} onClick={(e) => e.stopPropagation()}>
            <div className={s.modalHeader}>
              <h2 className={s.modalTitle}>요금제 변경</h2>
              <p className={s.modalSub}>월 금액이 실제 운영 테넌트에 바로 반영됩니다.</p>
            </div>
            <div className={s.modalBody}>
              <p className={b.modalIntro}>
                <strong>{planModal.tenant_name || planModal.tenant_code}</strong>
                {" "}<TenantTypeBadge exempt={isExempt(planModal.tenant_id)} />
                <br />
                <span className={b.modalMeta}>
                  현재 {planModal.plan_display} ({formatMoney(planModal.monthly_price)})
                </span>
              </p>
              {!isExempt(planModal.tenant_id) && <LiveWarning action="change plan" />}
              <label className={s.inputLabel}>변경할 요금제</label>
              <div className={b.planGrid} role="radiogroup" aria-label="요금제 선택">
                {PLAN_OPTIONS.map((plan) => (
                  <button
                    key={plan.value}
                    type="button"
                    className={b.planButton}
                    data-active={newPlan === plan.value ? "true" : undefined}
                    aria-pressed={newPlan === plan.value}
                    onClick={() => setNewPlan(plan.value)}
                  >
                    <span>{plan.label}</span>
                    <strong>{formatMoney(plan.price)}</strong>
                    <small>{plan.caption}</small>
                  </button>
                ))}
              </div>
              <div className={b.previewBox}>
                <div>
                  <span>현재</span>
                  <strong>{planModal.plan_display} · {formatMoney(planModal.monthly_price)}</strong>
                </div>
                <div>
                  <span>변경 후</span>
                  <strong>{selectedPlan ? `${selectedPlan.label} · ${formatMoney(selectedPlan.price)}` : "-"}</strong>
                </div>
              </div>
            </div>
            <div className={s.modalFooter}>
              <button className={`${s.btn} ${s.btnSecondary}`} onClick={() => setPlanModal(null)}>취소</button>
              <button className={`${s.btn} ${!isExempt(planModal.tenant_id) ? s.btnDanger : s.btnPrimary}`}
                onClick={handleChangePlan} disabled={changePlanMut.isPending}>
                {changePlanMut.isPending ? "변경 중..." : "운영에 적용"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Sub Components ──

function SummaryCard({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className={b.summaryCard}>
      <div className={b.summaryLabel}>
        {label}
      </div>
      <div className={b.summaryValue} data-warn={warn ? "true" : undefined}>
        {value}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={b.statusBadge} data-status={statusKey(status)}>
      {STATUS_LABELS[status] || status}
    </span>
  );
}

function InvoiceStatusBadge({ status }: { status: string }) {
  const labels: Record<string, string> = {
    SCHEDULED: "예정",
    PENDING: "대기",
    PAID: "입금 완료",
    FAILED: "실패",
    OVERDUE: "연체",
    VOID: "무효",
  };
  return (
    <span className={b.invoiceStatusBadge} data-status={statusKey(status)}>
      {labels[status] || status}
    </span>
  );
}

function DaysCell({ days }: { days: number | null }) {
  if (days === null) return <span className={b.daysCell} data-tone="muted">제한 없음</span>;
  const tone = days <= 3 ? "danger" : days <= 7 ? "warning" : "default";
  return <span className={b.daysCell} data-tone={tone}>{days}일</span>;
}

function TenantTypeBadge({ exempt }: { exempt: boolean }) {
  return (
    <span className={b.tenantTypeBadge} data-kind={exempt ? "dev" : "live"}>
      {exempt ? "개발" : "운영"}
    </span>
  );
}

function LiveWarning({ action }: { action: string }) {
  return (
    <div className={b.liveWarning}>
      <strong>운영 테넌트</strong> - 이 작업은 실제 구독 상태를 변경합니다.
      {action === "extend" && " 구독 만료일이 실제로 연장됩니다."}
      {action === "change plan" && " 요금제와 월 결제액이 실제로 변경됩니다."}
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: "warn" }) {
  return (
    <div className={b.metric}>
      <span>{label}</span>
      <strong data-tone={tone}>{value}</strong>
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      className={b.tabButton}
      data-active={active ? "true" : undefined}
      aria-pressed={active}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
