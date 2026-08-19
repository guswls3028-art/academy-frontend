// PATH: src/dev_app/pages/BillingPage.tsx
// Billing admin dashboard — tenant subscription overview + actions

import { useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router";
import { CalendarPlus, Search } from "lucide-react";
import {
  useBillingTenants,
  useBillingDashboard,
  useBillingInvoices,
  useExtendSubscription,
  useMarkInvoicePaid,
  useBankTransferNotices,
  useConfirmBankTransferNotice,
  useRejectBankTransferNotice,
  useMarkTaxInvoiceIssued,
} from "@dev/domains/billing/hooks/useBilling";
import { useDevToast } from "@dev/shared/components/useDevToast";
import type {
  TenantSubscriptionDto,
  InvoiceDto,
  BankTransferNoticeDto,
} from "@dev/domains/billing/api/billing.api";
import { dottedDateText, wonText } from "@/shared/utils/displayText";
import { formatLocalDate } from "@/shared/utils/localDate";
import { resolveBillingAmounts } from "@/shared/product/billingAmounts";
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

function parsePositiveInt(value: string): number | null {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseLocalDate(value: string): Date {
  const [year, month, day] = normalizeDateString(value).split("-").map(Number);
  return new Date(year, month - 1, day);
}

function normalizeDateString(value: string): string {
  return value.match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? value;
}

function getExtensionPreview(expiresAt: string | null, days: number): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const currentExpiry = expiresAt ? parseLocalDate(expiresAt) : today;
  const base = currentExpiry > today ? currentExpiry : today;
  const next = new Date(base);
  next.setDate(next.getDate() + days);
  return dottedDateText(formatLocalDate(next));
}

const SUBSCRIPTION_STATE_TEXT: Record<string, string> = {
  active: "정상",
  grace: "유예",
  expired: "만료",
};

const PLAN_LABELS: Record<string, string> = {
  all: "전체 기능",
};

const BILLING_MODE_LABELS: Record<string, string> = {
  AUTO_CARD: "카드 자동",
  INVOICE_REQUEST: "계좌이체 청구",
};

type Tab = "tenants" | "invoices" | "bankTransfers";

const EXTEND_PRESETS = [
  { days: 30, label: "+30일", caption: "1개월" },
  { days: 90, label: "+90일", caption: "3개월" },
  { days: 180, label: "+180일", caption: "6개월" },
  { days: 365, label: "+365일", caption: "1년" },
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
  const [expiringOnly, setExpiringOnly] = useState(false);
  const [invoiceStatus, setInvoiceStatus] = useState("");
  const [bankTransferPage, setBankTransferPage] = useState(1);

  // Queries
  const {
    data: tenants,
    isLoading: tenantsLoading,
    isError: tenantsError,
    refetch: refetchTenants,
  } = useBillingTenants();
  const {
    data: dashboard,
    isError: dashboardError,
    refetch: refetchDashboard,
  } = useBillingDashboard();
  const {
    data: invoicesData,
    isLoading: invoicesLoading,
    isError: invoicesError,
    refetch: refetchInvoices,
  } = useBillingInvoices(
    invoiceStatus ? { status: invoiceStatus } : undefined,
  );
  const {
    data: bankTransfers,
    isLoading: bankTransfersLoading,
    isError: bankTransfersError,
    refetch: refetchBankTransfers,
  } = useBankTransferNotices(bankTransferPage);

  // Mutations
  const extendMut = useExtendSubscription();
  const markPaidMut = useMarkInvoicePaid();
  const confirmTransferMut = useConfirmBankTransferNotice();
  const rejectTransferMut = useRejectBankTransferNotice();
  const markTaxIssuedMut = useMarkTaxInvoiceIssued();

  // Modal state
  const [extendModal, setExtendModal] = useState<TenantSubscriptionDto | null>(null);
  const [extendDays, setExtendDays] = useState("30");
  const extendDaysNumber = parsePositiveInt(extendDays);
  const extendPreview = extendModal && extendDaysNumber
    ? getExtensionPreview(extendModal.subscription_expires_at, extendDaysNumber)
    : null;

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
    if (expiringOnly) list = list.filter((t) => t.days_remaining !== null && t.days_remaining <= 7);
    return list;
  }, [tenants, tenantQuery, statusFilter, expiringOnly]);

  // ── Actions ──

  function openExtendModal(t: TenantSubscriptionDto, days = 30) {
    setExtendModal(t);
    setExtendDays(String(days));
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
      toast(`${result.tenant_code} ${days}일 연장 완료 (만료일 ${dottedDateText(result.subscription_expires_at)})`);
      setExtendModal(null);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } };
      toast("연장 실패: " + (err.response?.data?.detail || String(e)), "error");
    }
  }

  async function handleMarkPaid(inv: InvoiceDto) {
    const liveWarn = !EXEMPT_TENANT_IDS.has(
      tenants?.find((t) => t.tenant_code === inv.tenant_code)?.tenant_id ?? 0
    )
      ? "\n\n[LIVE TENANT] 이 작업은 운영 테넌트의 실제 구독 상태를 변경합니다."
      : "";
    if (!confirm(`${inv.invoice_number} 입금 확인하시겠습니까?\n금액: ${wonText(inv.total_amount)}${liveWarn}`)) return;
    try {
      await markPaidMut.mutateAsync(inv.id);
      toast(`${inv.invoice_number} 입금 확인 완료`);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } };
      toast("입금 확인 실패: " + (err.response?.data?.detail || String(e)), "error");
    }
  }

  async function handleConfirmTransfer(notice: BankTransferNoticeDto) {
    const accepted = confirm(
      `${notice.invoice_number} 입금을 확인하시겠습니까?\n` +
      `테넌트: ${notice.tenant_name || notice.tenant_code}\n` +
      `입금자: ${notice.depositor_name}\n` +
      `금액: ${wonText(notice.amount)}\n\n` +
      "[LIVE] 확인 즉시 실제 구독 기간과 수납 장부에 반영됩니다.",
    );
    if (!accepted) return;
    try {
      await confirmTransferMut.mutateAsync(notice.id);
      setBankTransferPage(1);
      toast(`${notice.invoice_number} 입금 확인 완료`);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { detail?: string } } };
      toast(
        "입금 확인 실패: " +
          (err.response?.data?.detail || String(error)),
        "error",
      );
    }
  }

  async function handleRejectTransfer(notice: BankTransferNoticeDto) {
    const reason = prompt("고객에게 표시할 반려 사유를 입력하세요.");
    if (!reason?.trim()) return;
    try {
      await rejectTransferMut.mutateAsync({
        noticeId: notice.id,
        reason: reason.trim(),
      });
      setBankTransferPage(1);
      toast(`${notice.invoice_number} 입금 신고 반려 완료`);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { detail?: string } } };
      toast(
        "반려 실패: " + (err.response?.data?.detail || String(error)),
        "error",
      );
    }
  }

  async function handleTaxIssued(notice: BankTransferNoticeDto) {
    if (!notice.tax_invoice_issue_id) return;
    const issueNumber = prompt(
      "홈택스에서 발행한 국세청 승인번호를 입력하세요.",
    );
    if (!issueNumber?.trim()) return;
    try {
      await markTaxIssuedMut.mutateAsync({
        issueId: notice.tax_invoice_issue_id,
        issueNumber: issueNumber.trim(),
      });
      setBankTransferPage(1);
      toast(`${notice.invoice_number} 세금계산서 발행 기록 완료`);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { detail?: string } } };
      toast(
        "발행 기록 실패: " +
          (err.response?.data?.detail || String(error)),
        "error",
      );
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
        <section className={s.pageIntro}>
          <div>
            <p className={s.pageEyebrow}>REVENUE OPERATIONS</p>
            <h1 className={s.pageTitle}>결제 관리</h1>
            <p className={s.pageSub}>구독 만료, 인보이스, 입금 신고를 실제 반영 전후 맥락과 함께 관리합니다.</p>
          </div>
          <div className={b.liveBoundary}>
            <span aria-hidden />
            LIVE DATA
            <small>변경 즉시 운영에 반영</small>
          </div>
        </section>

        {dashboardError && (
          <div className={b.readError} role="alert">
            <span>결제 요약을 불러오지 못해 합계 수치를 표시하지 않습니다.</span>
            <button type="button" className={`${s.btn} ${s.btnSecondary} ${s.btnSm}`} onClick={() => void refetchDashboard()}>다시 시도</button>
          </div>
        )}

        {/* ── Dashboard Summary ── */}
        {dashboard && (
          <div className={b.summaryGrid}>
            <SummaryCard label="MRR (VAT 별도)" value={wonText(dashboard.mrr_supply_amount ?? dashboard.mrr)} />
            <SummaryCard label="전체 테넌트" value={String(dashboard.total_tenants)} />
            <SummaryCard label="7일 내 만료" value={String(dashboard.expiring_soon)} warn={dashboard.expiring_soon > 0} />
            <SummaryCard label="연체 인보이스" value={String(dashboard.overdue_invoices)} warn={dashboard.overdue_invoices > 0} />
          </div>
        )}

        {/* ── Tab Bar ── */}
        <div className={b.tabBar}>
          <TabBtn active={tab === "tenants"} onClick={() => setTab("tenants")}>테넌트 구독</TabBtn>
          <TabBtn active={tab === "invoices"} onClick={() => setTab("invoices")}>인보이스</TabBtn>
          <TabBtn active={tab === "bankTransfers"} onClick={() => setTab("bankTransfers")}>
            입금 신고
            {(bankTransfers?.count ?? 0) > 0 && (
              <span className={b.tabDot} aria-label="처리 대기 건 있음" />
            )}
          </TabBtn>
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
                <label className={b.checkboxLabel}>
                  <input type="checkbox" checked={expiringOnly} onChange={(e) => setExpiringOnly(e.target.checked)} />
                  7일 내 만료
                </label>
              </div>
            </div>

            <div className={`${s.card} ${b.desktopTableCard}`}>
              {tenantsLoading ? (
                <div className={`${s.skeleton} ${b.loadingSkeleton}`} />
              ) : tenantsError ? (
                <div className={b.readError} role="alert">
                  <span>구독 목록을 불러오지 못해 기간 연장 기능을 잠갔습니다.</span>
                  <button type="button" className={`${s.btn} ${s.btnSecondary} ${s.btnSm}`} onClick={() => void refetchTenants()}>다시 시도</button>
                </div>
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
                        <th>월 결제 총액 (VAT 포함)</th>
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
                          <td className={b.dateCell}>{dottedDateText(t.subscription_expires_at)}</td>
                          <td>
                            <DaysCell days={t.days_remaining} />
                          </td>
                          <td className={b.dateCell}>{dottedDateText(t.next_billing_at)}</td>
                          <td className={b.billingModeCell}>
                            {BILLING_MODE_LABELS[t.billing_mode] || t.billing_mode}
                          </td>
                          <td className={b.numericCell}>
                            {wonText(resolveBillingAmounts(t).totalAmount)}
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
            {tenantsError && (
              <div className={`${b.mobileTenantList} ${b.readError}`} role="alert">
                <span>구독 목록을 불러오지 못해 기간 연장 기능을 잠갔습니다.</span>
                <button type="button" className={`${s.btn} ${s.btnSecondary} ${s.btnSm}`} onClick={() => void refetchTenants()}>다시 시도</button>
              </div>
            )}

            {!tenantsLoading && !tenantsError && (
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
                      <Metric label="만료일" value={dottedDateText(t.subscription_expires_at)} />
                      <Metric label="잔여" value={t.days_remaining === null ? "제한 없음" : `${t.days_remaining}일`} tone={t.days_remaining !== null && t.days_remaining <= 7 ? "warn" : undefined} />
                      <Metric label="다음 결제" value={dottedDateText(t.next_billing_at)} />
                      <Metric label="방식" value={BILLING_MODE_LABELS[t.billing_mode] || t.billing_mode} />
                      <Metric label="월 결제 총액 (VAT 포함)" value={wonText(resolveBillingAmounts(t).totalAmount)} />
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
              ) : invoicesError ? (
                <div className={b.readError} role="alert">
                  <span>인보이스를 불러오지 못해 입금 확인 기능을 잠갔습니다.</span>
                  <button type="button" className={`${s.btn} ${s.btnSecondary} ${s.btnSm}`} onClick={() => void refetchInvoices()}>다시 시도</button>
                </div>
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
                          <td className={b.numericCell}>{wonText(inv.total_amount)}</td>
                          <td className={b.periodCell}>{inv.period_start} ~ {inv.period_end}</td>
                          <td className={b.dateCell}>{inv.due_date}</td>
                          <td><InvoiceStatusBadge status={inv.status} /></td>
                          <td className={b.mutedSmallCell}>
                            {inv.paid_at ? inv.paid_at.split("T")[0] : "-"}
                          </td>
                          <td>
                            {(inv.can_mark_paid ?? ["PENDING", "OVERDUE", "FAILED"].includes(inv.status)) && (
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

        {/* ── Bank Transfer Notices Tab ── */}
        {tab === "bankTransfers" && (
          <div className={s.card}>
            {bankTransfersError ? (
              <div className={b.queueError} role="alert">
                <strong>입금 신고 목록을 불러오지 못했습니다.</strong>
                <button
                  type="button"
                  className={`${s.btn} ${s.btnSm}`}
                  onClick={() => refetchBankTransfers()}
                >
                  다시 시도
                </button>
              </div>
            ) : bankTransfersLoading ? (
              <div className={`${s.skeleton} ${b.loadingSkeleton}`} />
            ) : (
              <>
                <div className={b.tableScroller}>
                  <table className={s.table}>
                  <thead>
                    <tr>
                      <th>요청 시각</th>
                      <th>테넌트 / 청구서</th>
                      <th>입금자</th>
                      <th>금액</th>
                      <th>이체 시각</th>
                      <th>상태</th>
                      <th>세금계산서</th>
                      <th>조작</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bankTransfers?.results.map((notice) => (
                      <tr key={notice.id}>
                        <td className={b.mutedSmallCell}>
                          {notice.submitted_at.replace("T", " ").slice(0, 16)}
                        </td>
                        <td>
                          <strong className={b.noticeTenant}>
                            {notice.tenant_name || notice.tenant_code}
                          </strong>
                          <span className={b.noticeInvoice}>
                            {notice.invoice_number}
                          </span>
                        </td>
                        <td>{notice.depositor_name}</td>
                        <td className={b.numericCell}>
                          {wonText(notice.amount)}
                        </td>
                        <td className={b.mutedSmallCell}>
                          {notice.deposited_at.replace("T", " ").slice(0, 16)}
                        </td>
                        <td>
                          <NoticeStatusBadge status={notice.status} />
                          {notice.rejection_reason && (
                            <span className={b.rejectionReason}>
                              {notice.rejection_reason}
                            </span>
                          )}
                        </td>
                        <td>
                          <TaxStatusBadge
                            requested={notice.tax_invoice_requested}
                            status={notice.tax_invoice_status}
                          />
                          {notice.tax_invoice_requested && (
                            <details className={b.taxDetails}>
                              <summary>발행정보</summary>
                              <div>
                                <strong>
                                  {notice.business_profile_snapshot.business_name ||
                                    "-"}
                                </strong>
                                <span>
                                  {notice.business_profile_snapshot.business_registration_number ||
                                    "-"}
                                </span>
                                <span>
                                  {notice.business_profile_snapshot.tax_invoice_email ||
                                    "-"}
                                </span>
                                <span>
                                  {notice.business_profile_snapshot.representative_name ||
                                    "-"}
                                </span>
                              </div>
                            </details>
                          )}
                        </td>
                        <td>
                          <div className={b.rowActions}>
                            {notice.status === "SUBMITTED" && (
                              <>
                                <button
                                  className={`${s.btn} ${s.btnSm} ${s.btnPrimary}`}
                                  onClick={() => handleConfirmTransfer(notice)}
                                  disabled={confirmTransferMut.isPending}
                                >
                                  입금 확인
                                </button>
                                <button
                                  className={`${s.btn} ${s.btnSm}`}
                                  onClick={() => handleRejectTransfer(notice)}
                                  disabled={rejectTransferMut.isPending}
                                >
                                  반려
                                </button>
                              </>
                            )}
                            {notice.tax_invoice_status === "READY" &&
                              notice.tax_invoice_issue_id && (
                                <button
                                  className={`${s.btn} ${s.btnSm} ${s.btnPrimary}`}
                                  onClick={() => handleTaxIssued(notice)}
                                  disabled={markTaxIssuedMut.isPending}
                                >
                                  발행 완료 기록
                                </button>
                              )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {(!bankTransfers?.results ||
                      bankTransfers.results.length === 0) && (
                      <tr>
                        <td colSpan={8} className={b.emptyCell}>
                          입금 확인 요청이 없습니다.
                        </td>
                      </tr>
                    )}
                  </tbody>
                  </table>
                </div>
                {bankTransfers && bankTransfers.count > 0 && (
                  <div className={b.pagination}>
                    <span>
                      전체 {bankTransfers.count.toLocaleString()}건 ·{" "}
                      {bankTransferPage}페이지
                    </span>
                    <div>
                      <button
                        type="button"
                        className={`${s.btn} ${s.btnSm}`}
                        disabled={!bankTransfers.previous}
                        onClick={() =>
                          setBankTransferPage((page) => Math.max(1, page - 1))
                        }
                      >
                        이전
                      </button>
                      <button
                        type="button"
                        className={`${s.btn} ${s.btnSm}`}
                        disabled={!bankTransfers.next}
                        onClick={() =>
                          setBankTransferPage((page) => page + 1)
                        }
                      >
                        다음
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
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
                  현재 {SUBSCRIPTION_STATE_TEXT[extendModal.subscription_status] || extendModal.subscription_status}
                  {" / "}만료일 {dottedDateText(extendModal.subscription_expires_at)}
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
                  <strong>{dottedDateText(extendModal.subscription_expires_at)}</strong>
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
      {SUBSCRIPTION_STATE_TEXT[status] || status}
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

function NoticeStatusBadge({ status }: { status: string }) {
  const labels: Record<string, string> = {
    SUBMITTED: "확인 대기",
    CONFIRMED: "입금 확인",
    REJECTED: "반려",
  };
  return (
    <span className={b.invoiceStatusBadge} data-status={statusKey(status)}>
      {labels[status] || status}
    </span>
  );
}

function TaxStatusBadge({
  requested,
  status,
}: {
  requested: boolean;
  status: string;
}) {
  if (!requested) return <span className={b.mutedSmallCell}>미요청</span>;
  const labels: Record<string, string> = {
    REQUESTED: "입금 대기",
    READY: "발행 필요",
    ISSUED: "발행 완료",
    FAILED: "발행 실패",
    NOT_REQUESTED: "미요청",
  };
  return (
    <span className={b.taxStatusBadge} data-status={statusKey(status)}>
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
