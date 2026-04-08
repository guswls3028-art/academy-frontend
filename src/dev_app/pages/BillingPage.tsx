// PATH: src/dev_app/pages/BillingPage.tsx
// Billing admin dashboard — tenant subscription overview + actions

import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  useBillingTenants,
  useBillingDashboard,
  useBillingInvoices,
  useExtendSubscription,
  useChangePlan,
  useMarkInvoicePaid,
} from "@/dev_app/hooks/useBilling";
import { useDevToast } from "@/dev_app/components/DevToast";
import type { TenantSubscriptionDto, InvoiceDto } from "@/dev_app/api/billing";
import s from "@/dev_app/layout/DevLayout.module.css";

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

const STATUS_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  active: { bg: "var(--dev-success-subtle)", color: "var(--dev-success)", label: "Active" },
  grace: { bg: "var(--dev-warning-subtle)", color: "var(--dev-warning)", label: "Grace" },
  expired: { bg: "var(--dev-danger-subtle)", color: "var(--dev-danger)", label: "Expired" },
};

const PLAN_LABELS: Record<string, string> = {
  standard: "Standard",
  pro: "Pro",
  max: "Max",
};

const INVOICE_STATUS_STYLES: Record<string, { bg: string; color: string }> = {
  SCHEDULED: { bg: "#f1f5f9", color: "#475569" },
  PENDING: { bg: "#eff6ff", color: "#3b82f6" },
  PAID: { bg: "#ecfdf5", color: "#10b981" },
  FAILED: { bg: "#fef2f2", color: "#ef4444" },
  OVERDUE: { bg: "#fef2f2", color: "#ef4444" },
  VOID: { bg: "#f1f5f9", color: "#94a3b8" },
};

type Tab = "tenants" | "invoices";

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
          <Link to="/dev/dashboard" style={{ color: "var(--dev-text-muted)", textDecoration: "none", fontSize: 13 }}>
            Dashboard
          </Link>
          <span style={{ margin: "0 6px", color: "var(--dev-text-muted)" }}>/</span>
          <span style={{ fontSize: 13, fontWeight: 600 }}>Billing</span>
        </div>
      </header>

      <div className={s.content}>
        {/* ── Dashboard Summary ── */}
        {dashboard && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 20 }}>
            <SummaryCard label="MRR" value={`${formatPrice(dashboard.mrr)}won`} />
            <SummaryCard label="Total Tenants" value={String(dashboard.total_tenants)} />
            <SummaryCard label="Expiring Soon" value={String(dashboard.expiring_soon)} warn={dashboard.expiring_soon > 0} />
            <SummaryCard label="Overdue" value={String(dashboard.overdue_invoices)} warn={dashboard.overdue_invoices > 0} />
          </div>
        )}

        {/* ── Tab Bar ── */}
        <div style={{ display: "flex", gap: 0, borderBottom: "1px solid var(--dev-border)", marginBottom: 16 }}>
          <TabBtn active={tab === "tenants"} onClick={() => setTab("tenants")}>Tenants</TabBtn>
          <TabBtn active={tab === "invoices"} onClick={() => setTab("invoices")}>Invoices</TabBtn>
        </div>

        {/* ── Tenants Tab ── */}
        {tab === "tenants" && (
          <>
            {/* Filters */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
              <select className={s.input} style={{ width: "auto", minWidth: 120 }}
                value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="">All Status</option>
                <option value="active">Active</option>
                <option value="grace">Grace</option>
                <option value="expired">Expired</option>
              </select>
              <select className={s.input} style={{ width: "auto", minWidth: 120 }}
                value={planFilter} onChange={(e) => setPlanFilter(e.target.value)}>
                <option value="">All Plans</option>
                <option value="standard">Standard</option>
                <option value="pro">Pro</option>
                <option value="max">Max</option>
              </select>
              <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13, cursor: "pointer" }}>
                <input type="checkbox" checked={expiringOnly} onChange={(e) => setExpiringOnly(e.target.checked)} />
                Expiring 7d
              </label>
            </div>

            <div className={s.card}>
              {tenantsLoading ? (
                <div className={s.skeleton} style={{ height: 200 }} />
              ) : (
                <div style={{ overflowX: "auto" }}>
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
                        <tr key={t.tenant_id} style={isExempt(t.tenant_id) ? { opacity: 0.6 } : undefined}>
                          <td style={{ fontWeight: 600 }}>
                            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              {t.tenant_name || t.tenant_code}
                              <TenantTypeBadge exempt={isExempt(t.tenant_id)} />
                            </span>
                            <div style={{ fontSize: 11, color: "var(--dev-text-muted)" }}>{t.tenant_code}</div>
                          </td>
                          <td>{PLAN_LABELS[t.plan] || t.plan}</td>
                          <td>
                            <StatusBadge status={t.subscription_status} />
                            {t.cancel_at_period_end && (
                              <span style={{ display: "block", fontSize: 10, color: "var(--dev-warning)", marginTop: 2 }}>
                                Cancel scheduled
                              </span>
                            )}
                          </td>
                          <td style={{ fontSize: 13 }}>{formatDate(t.subscription_expires_at)}</td>
                          <td>
                            <DaysCell days={t.days_remaining} />
                          </td>
                          <td style={{ fontSize: 13 }}>{formatDate(t.next_billing_at)}</td>
                          <td style={{ fontSize: 12, color: "var(--dev-text-muted)" }}>
                            {t.billing_mode === "AUTO_CARD" ? "Card" : "Invoice"}
                          </td>
                          <td style={{ fontSize: 13, fontVariantNumeric: "tabular-nums" }}>
                            {formatPrice(t.monthly_price)}
                          </td>
                          <td>
                            <div style={{ display: "flex", gap: 4 }}>
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
                        <tr><td colSpan={9} style={{ textAlign: "center", color: "var(--dev-text-muted)", padding: 32 }}>
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
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <select className={s.input} style={{ width: "auto", minWidth: 120 }}
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
                <div className={s.skeleton} style={{ height: 200 }} />
              ) : (
                <div style={{ overflowX: "auto" }}>
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
                          <td style={{ fontWeight: 500, fontSize: 13 }}>{inv.invoice_number}</td>
                          <td>{inv.tenant_code}</td>
                          <td style={{ fontVariantNumeric: "tabular-nums" }}>{formatPrice(inv.total_amount)}</td>
                          <td style={{ fontSize: 12 }}>{inv.period_start} ~ {inv.period_end}</td>
                          <td style={{ fontSize: 13 }}>{inv.due_date}</td>
                          <td><InvoiceStatusBadge status={inv.status} /></td>
                          <td style={{ fontSize: 12, color: "var(--dev-text-muted)" }}>
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
                        <tr><td colSpan={8} style={{ textAlign: "center", color: "var(--dev-text-muted)", padding: 32 }}>
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
              <p style={{ marginBottom: 8 }}>
                <strong>{extendModal.tenant_name || extendModal.tenant_code}</strong>
                {" "}<TenantTypeBadge exempt={isExempt(extendModal.tenant_id)} />
                <br />
                <span style={{ fontSize: 13, color: "var(--dev-text-muted)" }}>
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
              <p style={{ marginBottom: 8 }}>
                <strong>{planModal.tenant_name || planModal.tenant_code}</strong>
                {" "}<TenantTypeBadge exempt={isExempt(planModal.tenant_id)} />
                <br />
                <span style={{ fontSize: 13, color: "var(--dev-text-muted)" }}>
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
    <div style={{
      background: "var(--dev-surface)", border: "1px solid var(--dev-border)",
      borderRadius: "var(--dev-radius)", padding: "14px 16px",
      boxShadow: "var(--dev-shadow-sm)",
    }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--dev-text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
        {label}
      </div>
      <div style={{
        fontSize: 22, fontWeight: 700, marginTop: 4, fontVariantNumeric: "tabular-nums",
        color: warn ? "var(--dev-danger)" : "var(--dev-text)",
      }}>
        {value}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] || { bg: "#f1f5f9", color: "#94a3b8", label: status };
  return (
    <span style={{
      display: "inline-block", padding: "2px 8px", borderRadius: 6,
      fontSize: 11, fontWeight: 600, background: style.bg, color: style.color,
    }}>
      {style.label}
    </span>
  );
}

function InvoiceStatusBadge({ status }: { status: string }) {
  const style = INVOICE_STATUS_STYLES[status] || { bg: "#f1f5f9", color: "#94a3b8" };
  return (
    <span style={{
      display: "inline-block", padding: "2px 8px", borderRadius: 6,
      fontSize: 11, fontWeight: 600, background: style.bg, color: style.color,
    }}>
      {status}
    </span>
  );
}

function DaysCell({ days }: { days: number | null }) {
  if (days === null) return <span style={{ color: "var(--dev-text-muted)" }}>unlimited</span>;
  const color = days <= 3 ? "var(--dev-danger)" : days <= 7 ? "var(--dev-warning)" : "var(--dev-text)";
  return <span style={{ fontWeight: 600, color, fontVariantNumeric: "tabular-nums" }}>{days}d</span>;
}

function TenantTypeBadge({ exempt }: { exempt: boolean }) {
  return (
    <span style={{
      display: "inline-block", padding: "1px 6px", borderRadius: 4, fontSize: 9,
      fontWeight: 700, letterSpacing: "0.5px", verticalAlign: "middle",
      background: exempt ? "#f1f5f9" : "#fef2f2",
      color: exempt ? "#94a3b8" : "#ef4444",
      border: `1px solid ${exempt ? "#e2e8f0" : "#fecaca"}`,
    }}>
      {exempt ? "DEV" : "LIVE"}
    </span>
  );
}

function LiveWarning({ action }: { action: string }) {
  return (
    <div style={{
      padding: "8px 12px", borderRadius: 6, marginBottom: 12,
      background: "#fef2f2", border: "1px solid #fecaca", fontSize: 12,
      color: "#dc2626", lineHeight: 1.5,
    }}>
      <strong>LIVE tenant</strong> &mdash; 이 작업은 운영 테넌트의 실제 구독 상태를 변경합니다.
      {action === "extend" && " 구독 만료일이 실제로 연장됩니다."}
      {action === "change plan" && " 요금제와 월 결제액이 실제로 변경됩니다."}
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{
      padding: "8px 16px", fontSize: 13, fontWeight: active ? 600 : 400, border: "none",
      borderBottom: active ? "2px solid var(--dev-primary)" : "2px solid transparent",
      background: "transparent", color: active ? "var(--dev-primary)" : "var(--dev-text-muted)",
      cursor: "pointer",
    }}>
      {children}
    </button>
  );
}
