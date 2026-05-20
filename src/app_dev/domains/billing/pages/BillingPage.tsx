// PATH: src/dev_app/pages/BillingPage.tsx
// Billing admin dashboard — tenant subscription overview + actions

import { useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  useBillingTenants,
  useBillingDashboard,
  useBillingInvoices,
  useExtendSubscription,
  useChangePlan,
  useMarkInvoicePaid,
} from "@dev/domains/billing/hooks/useBilling";
import { useDevToast } from "@dev/shared/components/DevToast";
import type { TenantSubscriptionDto, InvoiceDto } from "@dev/domains/billing/api/billing.api";
import s from "@dev/layout/DevLayout.module.css";
import b from "./BillingPage.module.css";

// Exempt tenant IDs — 개발/테스트/시스템 (backend BILLING_EXEMPT_TENANT_IDS와 동일)
const EXEMPT_TENANT_IDS = new Set([1, 2, 9999]);

function isExempt(tenantId: number): boolean {
  return EXEMPT_TENANT_IDS.has(tenantId);
}

// ── Helpers ──

function formatDate(d: string | null): string {
  if (!d) return "-";
  return d.replace(/-/g, ". ") + ".";
}

function formatPrice(n: number): string {
  return n.toLocaleString("ko-KR");
}

const STATUS_LABELS: Record<string, string> = {
  active: "Active",
  grace: "Grace",
  expired: "Expired",
};

const PLAN_LABELS: Record<string, string> = {
  standard: "Standard",
  pro: "Pro",
  max: "Max",
};

type Tab = "tenants" | "invoices";

function statusKey(status: string): string {
  return status.toLowerCase().replace(/[^a-z0-9_-]/g, "");
}

// ── Main Component ──

export default function BillingPage() {
  const { toast } = useDevToast();
  const [tab, setTab] = useState<Tab>("tenants");
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

  // Filtered tenants
  const filtered = useMemo(() => {
    if (!tenants) return [];
    let list = tenants;
    if (statusFilter) list = list.filter((t) => t.subscription_status === statusFilter);
    if (planFilter) list = list.filter((t) => t.plan === planFilter);
    if (expiringOnly) list = list.filter((t) => t.days_remaining !== null && t.days_remaining <= 7);
    return list;
  }, [tenants, statusFilter, planFilter, expiringOnly]);

  // ── Actions ──

  async function handleExtend() {
    if (!extendModal) return;
    const days = parseInt(extendDays, 10);
    if (!days || days <= 0) {
      toast("1 이상의 일수를 입력하세요.", "error");
      return;
    }
    try {
      const result = await extendMut.mutateAsync({
        programId: extendModal.tenant_id,
        days,
      });
      toast(`${result.tenant_code} ${days}일 연장 완료 (-> ${result.subscription_expires_at})`);
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
        programId: planModal.tenant_id,
        plan: newPlan,
      });
      toast(`${result.tenant_code} -> ${result.plan_display} (${formatPrice(result.monthly_price)}won)`);
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
    if (!confirm(`${inv.invoice_number} 입금 확인하시겠습니까?\n금액: ${formatPrice(inv.total_amount)}won${liveWarn}`)) return;
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
            Dashboard
          </Link>
          <span className={b.breadcrumbSeparator}>/</span>
          <span className={b.breadcrumbCurrent}>Billing</span>
        </div>
      </header>

      <div className={s.content}>
        {/* ── Dashboard Summary ── */}
        {dashboard && (
          <div className={b.summaryGrid}>
            <SummaryCard label="MRR" value={`${formatPrice(dashboard.mrr)}won`} />
            <SummaryCard label="Total Tenants" value={String(dashboard.total_tenants)} />
            <SummaryCard label="Expiring Soon" value={String(dashboard.expiring_soon)} warn={dashboard.expiring_soon > 0} />
            <SummaryCard label="Overdue" value={String(dashboard.overdue_invoices)} warn={dashboard.overdue_invoices > 0} />
          </div>
        )}

        {/* ── Tab Bar ── */}
        <div className={b.tabBar}>
          <TabBtn active={tab === "tenants"} onClick={() => setTab("tenants")}>Tenants</TabBtn>
          <TabBtn active={tab === "invoices"} onClick={() => setTab("invoices")}>Invoices</TabBtn>
        </div>

        {/* ── Tenants Tab ── */}
        {tab === "tenants" && (
          <>
            {/* Filters */}
            <div className={b.filters}>
              <select className={`${s.input} ${b.filterSelect}`}
                value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="">All Status</option>
                <option value="active">Active</option>
                <option value="grace">Grace</option>
                <option value="expired">Expired</option>
              </select>
              <select className={`${s.input} ${b.filterSelect}`}
                value={planFilter} onChange={(e) => setPlanFilter(e.target.value)}>
                <option value="">All Plans</option>
                <option value="standard">Standard</option>
                <option value="pro">Pro</option>
                <option value="max">Max</option>
              </select>
              <label className={b.checkboxLabel}>
                <input type="checkbox" checked={expiringOnly} onChange={(e) => setExpiringOnly(e.target.checked)} />
                Expiring 7d
              </label>
            </div>

            <div className={s.card}>
              {tenantsLoading ? (
                <div className={`${s.skeleton} ${b.loadingSkeleton}`} />
              ) : (
                <div className={b.tableScroller}>
                  <table className={s.table}>
                    <thead>
                      <tr>
                        <th>Tenant</th>
                        <th>Plan</th>
                        <th>Status</th>
                        <th>Expires</th>
                        <th>Remaining</th>
                        <th>Next Bill</th>
                        <th>Mode</th>
                        <th>Price</th>
                        <th>Actions</th>
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
                            {t.billing_mode === "AUTO_CARD" ? "Card" : "Invoice"}
                          </td>
                          <td className={b.numericCell}>
                            {formatPrice(t.monthly_price)}
                          </td>
                          <td>
                            <div className={b.rowActions}>
                              <button className={`${s.btn} ${s.btnSm}`}
                                onClick={() => { setExtendModal(t); setExtendDays("30"); }}>
                                Extend
                              </button>
                              <button className={`${s.btn} ${s.btnSm}`}
                                onClick={() => { setPlanModal(t); setNewPlan(t.plan); }}>
                                Plan
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {filtered.length === 0 && (
                        <tr><td colSpan={9} className={b.emptyCell}>
                          No matching tenants
                        </td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        {/* ── Invoices Tab ── */}
        {tab === "invoices" && (
          <>
            <div className={b.filters}>
              <select className={`${s.input} ${b.filterSelect}`}
                value={invoiceStatus} onChange={(e) => setInvoiceStatus(e.target.value)}>
                <option value="">All Status</option>
                <option value="SCHEDULED">Scheduled</option>
                <option value="PENDING">Pending</option>
                <option value="PAID">Paid</option>
                <option value="FAILED">Failed</option>
                <option value="OVERDUE">Overdue</option>
                <option value="VOID">Void</option>
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
                        <th>Invoice</th>
                        <th>Tenant</th>
                        <th>Amount</th>
                        <th>Period</th>
                        <th>Due</th>
                        <th>Status</th>
                        <th>Paid At</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoicesData?.results.map((inv) => (
                        <tr key={inv.id}>
                          <td className={b.invoiceNumberCell}>{inv.invoice_number}</td>
                          <td>{inv.tenant_code}</td>
                          <td className={b.numericCell}>{formatPrice(inv.total_amount)}</td>
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
                                Mark Paid
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                      {(!invoicesData?.results || invoicesData.results.length === 0) && (
                        <tr><td colSpan={8} className={b.emptyCell}>
                          No invoices
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
              <h2 className={s.modalTitle}>Extend Subscription</h2>
            </div>
            <div className={s.modalBody}>
              <p className={b.modalIntro}>
                <strong>{extendModal.tenant_name || extendModal.tenant_code}</strong>
                {" "}<TenantTypeBadge exempt={isExempt(extendModal.tenant_id)} />
                <br />
                <span className={b.modalMeta}>
                  Current: {extendModal.subscription_status} / expires {formatDate(extendModal.subscription_expires_at)}
                  {extendModal.days_remaining !== null && ` (${extendModal.days_remaining}d left)`}
                </span>
              </p>
              {!isExempt(extendModal.tenant_id) && <LiveWarning action="extend" />}
              <label className={s.inputLabel}>Days to extend</label>
              <input className={s.input} type="number" min="1" max="3650"
                value={extendDays} onChange={(e) => setExtendDays(e.target.value)}
                autoFocus
              />
            </div>
            <div className={s.modalFooter}>
              <button className={`${s.btn} ${s.btnSecondary}`} onClick={() => setExtendModal(null)}>Cancel</button>
              <button className={`${s.btn} ${!isExempt(extendModal.tenant_id) ? s.btnDanger : s.btnPrimary}`}
                onClick={handleExtend} disabled={extendMut.isPending}>
                {extendMut.isPending ? "Extending..." : "Extend"}
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
              <h2 className={s.modalTitle}>Change Plan</h2>
            </div>
            <div className={s.modalBody}>
              <p className={b.modalIntro}>
                <strong>{planModal.tenant_name || planModal.tenant_code}</strong>
                {" "}<TenantTypeBadge exempt={isExempt(planModal.tenant_id)} />
                <br />
                <span className={b.modalMeta}>
                  Current: {planModal.plan_display} ({formatPrice(planModal.monthly_price)}won)
                </span>
              </p>
              {!isExempt(planModal.tenant_id) && <LiveWarning action="change plan" />}
              <label className={s.inputLabel}>New Plan</label>
              <select className={s.input} value={newPlan} onChange={(e) => setNewPlan(e.target.value)}>
                <option value="standard">Standard (99,000won)</option>
                <option value="pro">Pro (198,000won)</option>
                <option value="max">Max (330,000won)</option>
              </select>
            </div>
            <div className={s.modalFooter}>
              <button className={`${s.btn} ${s.btnSecondary}`} onClick={() => setPlanModal(null)}>Cancel</button>
              <button className={`${s.btn} ${!isExempt(planModal.tenant_id) ? s.btnDanger : s.btnPrimary}`}
                onClick={handleChangePlan} disabled={changePlanMut.isPending}>
                {changePlanMut.isPending ? "Changing..." : "Change Plan"}
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
  return (
    <span className={b.invoiceStatusBadge} data-status={statusKey(status)}>
      {status}
    </span>
  );
}

function DaysCell({ days }: { days: number | null }) {
  if (days === null) return <span className={b.daysCell} data-tone="muted">unlimited</span>;
  const tone = days <= 3 ? "danger" : days <= 7 ? "warning" : "default";
  return <span className={b.daysCell} data-tone={tone}>{days}d</span>;
}

function TenantTypeBadge({ exempt }: { exempt: boolean }) {
  return (
    <span className={b.tenantTypeBadge} data-kind={exempt ? "dev" : "live"}>
      {exempt ? "DEV" : "LIVE"}
    </span>
  );
}

function LiveWarning({ action }: { action: string }) {
  return (
    <div className={b.liveWarning}>
      <strong>LIVE tenant</strong> - 이 작업은 운영 테넌트의 실제 구독 상태를 변경합니다.
      {action === "extend" && " 구독 만료일이 실제로 연장됩니다."}
      {action === "change plan" && " 요금제와 월 결제액이 실제로 변경됩니다."}
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
