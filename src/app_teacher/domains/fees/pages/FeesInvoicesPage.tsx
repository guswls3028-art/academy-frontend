// PATH: src/app_teacher/domains/fees/pages/FeesInvoicesPage.tsx
// 수납 청구서 목록 + 상세 BottomSheet + 결제 기록
import { useEffect, useState, type ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { EmptyState, ICON } from "@/shared/ui/ds";
import { Card, BackButton } from "@teacher/shared/ui/Card";
import { Badge } from "@teacher/shared/ui/Badge";
import BottomSheet from "@teacher/shared/ui/BottomSheet";
import { teacherToast } from "@teacher/shared/ui/teacherToast";
import { ChevronRight, Search } from "@teacher/shared/ui/Icons";
import { EmptyActionButton } from "@teacher/shared/ui/EmptyActionButton";
import { formatBillingDate as formatDate, formatKRWNumber as formatKRW } from "@/shared/product/fees/feesFormat";
import {
  fetchInvoices,
  fetchInvoiceDetail,
  recordPayment,
  type StudentInvoice,
  type InvoiceStatus,
  type PaymentMethod,
} from "../api";
import {
  FEES_PERMISSION_ERROR_DESCRIPTION,
  FEES_PERMISSION_ERROR_TITLE,
  getFeesApiErrorMessage,
  isFeesPermissionError,
} from "../feesError";
import { FEES_STATUS_LABEL, FEES_STATUS_TONE } from "@/shared/product/fees/feesStatus";
import { teacherFeesQueryKeys } from "../queryKeys";
import styles from "./FeesInvoicesPage.module.css";

type FilterKey = "ALL" | "PENDING" | "PARTIAL" | "OVERDUE" | "PAID";

const FILTER_TABS: { key: FilterKey; label: string }[] = [
  { key: "ALL", label: "전체" },
  { key: "PENDING", label: FEES_STATUS_LABEL.PENDING },
  { key: "PARTIAL", label: FEES_STATUS_LABEL.PARTIAL },
  { key: "OVERDUE", label: FEES_STATUS_LABEL.OVERDUE },
  { key: "PAID", label: FEES_STATUS_LABEL.PAID },
];

const STATUS_TONE: Record<InvoiceStatus, "success" | "danger" | "warning" | "info" | "neutral"> = FEES_STATUS_TONE;

export default function FeesInvoicesPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const openId = searchParams.get("id");
  const selectedId = openId && /^\d+$/.test(openId) ? Number(openId) : null;

  const [filter, setFilter] = useState<FilterKey>("ALL");
  const [search, setSearch] = useState("");

  const { data, isLoading, isError, error } = useQuery({
    queryKey: teacherFeesQueryKeys.invoiceList(filter, search),
    queryFn: () =>
      fetchInvoices({
        ...(filter !== "ALL" ? { status: filter } : {}),
        ...(search ? { search } : {}),
      }),
    retry: (failureCount, queryError) => !isFeesPermissionError(queryError) && failureCount < 2,
  });

  const invoices: StudentInvoice[] = data ?? [];
  const isPermissionError = isFeesPermissionError(error);

  const setSelected = (id: number | null) => {
    const next = new URLSearchParams(searchParams);
    if (id != null) next.set("id", String(id));
    else next.delete("id");
    setSearchParams(next);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 py-0.5">
        <BackButton onClick={() => navigate(-1)} />
        <h1 className={`${styles.title} text-[17px] font-bold flex-1`}>
          청구서
        </h1>
      </div>

      {/* Search */}
      <div className={`${styles.searchBox} flex items-center gap-2 rounded-xl`}>
        <Search size={ICON.sm} className={styles.searchIcon} />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="학생 이름, 청구서 번호"
          className={`${styles.searchInput} flex-1 text-sm`}
        />
      </div>

      {/* Filter tabs */}
      <div className={`${styles.filterTabs} flex overflow-x-auto`}>
        {FILTER_TABS.map((t) => (
          <button
            type="button"
            key={t.key}
            onClick={() => setFilter(t.key)}
            className={`${styles.filterTab} ${filter === t.key ? styles.filterTabActive : ""} shrink-0 text-[13px] cursor-pointer`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {isPermissionError ? (
        <EmptyState
          scope="panel"
          tone="error"
          title={FEES_PERMISSION_ERROR_TITLE}
          description={FEES_PERMISSION_ERROR_DESCRIPTION}
        />
      ) : isLoading ? (
        <EmptyState scope="panel" tone="loading" title="불러오는 중…" />
      ) : isError ? (
        <EmptyState
          scope="panel"
          tone="error"
          title="청구서를 불러오지 못했습니다"
          description={getFeesApiErrorMessage(error, "잠시 후 다시 시도해 주세요.")}
        />
      ) : invoices.length === 0 ? (
        <EmptyState
          scope="panel"
          tone="empty"
          title={search.trim() || filter !== "ALL" ? "조건에 맞는 청구서가 없습니다" : "청구서가 없습니다"}
          description={search.trim() || filter !== "ALL" ? "검색어나 상태 필터를 초기화하면 전체 청구서를 다시 확인할 수 있습니다." : "청구서가 발행되면 미납, 연체, 완납 상태별로 이곳에서 관리합니다."}
          actions={
            search.trim() || filter !== "ALL" ? (
              <EmptyActionButton
                variant="secondary"
                onClick={() => {
                  setSearch("");
                  setFilter("ALL");
                }}
              >
                조건 초기화
              </EmptyActionButton>
            ) : undefined
          }
        />
      ) : (
        <div className="flex flex-col gap-1.5">
          {invoices.map((inv) => (
            <button
              type="button"
              key={inv.id}
              onClick={() => setSelected(inv.id)}
              className={`${styles.invoiceButton} flex items-center gap-3 rounded-xl w-full text-left cursor-pointer`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`${styles.primaryText} text-sm font-semibold`}>
                    {inv.student_name}
                  </span>
                  <Badge tone={STATUS_TONE[inv.status]} size="xs">
                    {inv.status_display}
                  </Badge>
                </div>
                <div className={`${styles.mutedText} text-[11px] mt-0.5`}>
                  {inv.invoice_number} · {inv.billing_year}.{String(inv.billing_month).padStart(2, "0")} · 마감{" "}
                  {inv.due_date}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className={`${styles.primaryText} text-sm font-bold tabular-nums`}>
                  {formatKRW(inv.total_amount)}
                </div>
                {inv.outstanding_amount > 0 && (
                  <div className={`${styles.dangerText} text-[11px] tabular-nums`}>
                    -{formatKRW(inv.outstanding_amount)}
                  </div>
                )}
              </div>
              <ChevronRight size={ICON.xs} className={styles.chevron} />
            </button>
          ))}
        </div>
      )}

      {/* Detail sheet */}
      <InvoiceDetailSheet
        open={selectedId != null}
        onClose={() => setSelected(null)}
        invoiceId={selectedId}
      />
    </div>
  );
}

function InvoiceDetailSheet({
  open,
  onClose,
  invoiceId,
}: {
  open: boolean;
  onClose: () => void;
  invoiceId: number | null;
}) {
  const qc = useQueryClient();
  const [payMode, setPayMode] = useState(false);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState<PaymentMethod>("CARD");
  const [payNote, setPayNote] = useState("");
  const payAmountNumber = Number(payAmount);
  const canRecordPayment =
    invoiceId != null && Number.isFinite(payAmountNumber) && payAmountNumber > 0;

  useEffect(() => {
    setPayMode(false);
    setPayAmount("");
    setPayMethod("CARD");
    setPayNote("");
  }, [invoiceId, open]);

  const { data: invoice, isLoading } = useQuery({
    queryKey: teacherFeesQueryKeys.invoice(invoiceId),
    queryFn: () => fetchInvoiceDetail(invoiceId!),
    enabled: invoiceId != null && open,
  });

  const payMut = useMutation({
    mutationFn: () => {
      if (!canRecordPayment) throw new Error("결제 금액을 확인해 주세요.");
      return recordPayment({
        invoice_id: invoiceId!,
        amount: payAmountNumber,
        payment_method: payMethod,
        receipt_note: payNote,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: teacherFeesQueryKeys.invoices });
      qc.invalidateQueries({ queryKey: teacherFeesQueryKeys.invoice(invoiceId) });
      qc.invalidateQueries({ queryKey: teacherFeesQueryKeys.dashboard });
      qc.invalidateQueries({ queryKey: teacherFeesQueryKeys.overdue });
      teacherToast.success("결제를 기록했습니다.");
      setPayMode(false);
      setPayAmount("");
      setPayNote("");
    },
    onError: (error: unknown) =>
      teacherToast.error(getFeesApiErrorMessage(error, "기록에 실패했습니다.")),
  });

  const invoiceItems = invoice?.items ?? [];
  const invoicePayments = invoice?.payments ?? [];

  return (
    <BottomSheet open={open} onClose={onClose} title={invoice?.invoice_number ?? "청구서 상세"}>
      {isLoading && <EmptyState scope="panel" tone="loading" title="불러오는 중…" />}
      {invoice && (
        <div className="flex flex-col gap-3 pb-3">
          {/* 요약 */}
          <Card>
            <div className="flex justify-between items-center">
              <div>
                <div className={`${styles.primaryText} text-sm font-semibold`}>
                  {invoice.student_name}
                </div>
                <div className={`${styles.mutedText} text-[11px] mt-0.5`}>
                  {invoice.billing_year}.{String(invoice.billing_month).padStart(2, "0")} · 마감{" "}
                  {invoice.due_date}
                </div>
              </div>
              <Badge tone={STATUS_TONE[invoice.status]}>{invoice.status_display}</Badge>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-3">
              <StatBox label="청구" value={formatKRW(invoice.total_amount)} />
              <StatBox
                label="수납"
                value={formatKRW(invoice.paid_amount)}
                tone="success"
              />
              <StatBox
                label="잔액"
                value={formatKRW(invoice.outstanding_amount)}
                tone={invoice.outstanding_amount > 0 ? "danger" : "muted"}
              />
            </div>
          </Card>

          {/* 상세 항목 */}
          {invoiceItems.length > 0 && (
            <div className={styles.panelCard}>
              <div className={`${styles.sectionHeader} text-[13px] font-bold`}>
                청구 항목
              </div>
              {invoiceItems.map((it, idx) => (
                <div
                  key={it.id ?? idx}
                  className={`${styles.detailRow} ${idx === invoiceItems.length - 1 ? styles.lastRow : ""} flex justify-between items-center`}
                >
                  <span className={`${styles.primaryText} text-sm`}>{it.description}</span>
                  <span className={`${styles.primaryText} text-sm font-semibold tabular-nums`}>
                    {formatKRW(it.amount)}원
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* 결제 기록 */}
          {invoicePayments.length > 0 && (
            <div className={styles.panelCard}>
              <div className={`${styles.sectionHeader} text-[13px] font-bold`}>
                결제 이력
              </div>
              {invoicePayments.map((p, idx) => (
                <div
                  key={p.id}
                  className={`${styles.detailRow} ${idx === invoicePayments.length - 1 ? styles.lastRow : ""} flex justify-between items-center`}
                >
                  <div className="min-w-0 flex-1">
                    <div className={`${styles.primaryText} text-[13px]`}>
                      {p.payment_method_display} · {formatKRW(p.amount)}원
                    </div>
                    <div className={`${styles.mutedText} text-[11px]`}>
                      {formatDate(p.paid_at || p.created_at)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 결제 기록 버튼 / 폼 */}
          {invoice.outstanding_amount > 0 && invoice.status !== "CANCELLED" && (
            <>
              {!payMode ? (
                <button
                  type="button"
                  onClick={() => { setPayMode(true); setPayAmount(String(invoice.outstanding_amount)); }}
                  className={`${styles.primaryAction} text-sm font-bold cursor-pointer w-full`}
                >
                  결제 기록하기
                </button>
              ) : (
                <Card>
                  <div className={`${styles.primaryText} text-[13px] font-bold mb-2`}>
                    결제 기록
                  </div>
                  <div className="flex flex-col gap-2">
                    <Field label="금액">
                      <input
                        type="number"
                        value={payAmount}
                        onChange={(e) => setPayAmount(e.target.value)}
                        className={`${styles.fieldInput} w-full text-sm tabular-nums`}
                      />
                    </Field>
                    <Field label="수단">
                      <div className="flex gap-1.5">
                        {(["CARD", "BANK_TRANSFER", "CASH", "OTHER"] as PaymentMethod[]).map((m) => (
                          <button
                            key={m}
                            type="button"
                            onClick={() => setPayMethod(m)}
                            className={`${styles.methodButton} ${payMethod === m ? styles.methodButtonActive : ""} text-[12px] font-semibold cursor-pointer`}
                          >
                            {PM_LABEL[m]}
                          </button>
                        ))}
                      </div>
                    </Field>
                    <Field label="메모 (선택)">
                      <input
                        type="text"
                        value={payNote}
                        onChange={(e) => setPayNote(e.target.value)}
                        className={`${styles.fieldInput} w-full text-sm`}
                      />
                    </Field>
                    <div className="flex gap-2 mt-1">
                      <button
                        type="button"
                        onClick={() => setPayMode(false)}
                        className={`${styles.secondaryAction} flex-1 text-sm font-semibold cursor-pointer`}
                      >
                        취소
                      </button>
                      <button
                        type="button"
                        onClick={() => payMut.mutate()}
                        disabled={payMut.isPending || !canRecordPayment}
                        className={`${styles.submitAction} flex-1 text-sm font-bold cursor-pointer disabled:opacity-50`}
                      >
                        {payMut.isPending ? "저장 중…" : "저장"}
                      </button>
                    </div>
                  </div>
                </Card>
              )}
            </>
          )}
        </div>
      )}
    </BottomSheet>
  );
}

function StatBox({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: StatTone;
}) {
  return (
    <div className={`${styles.statBox} rounded-lg flex flex-col items-center py-2`}>
      <span className={`${styles.mutedText} text-[10px]`}>{label}</span>
      <span className={`${STAT_TONE_CLASS[tone]} text-[13px] font-bold tabular-nums`}>{value}</span>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className={`${styles.mutedText} text-[11px] font-semibold block mb-1`}>
        {label}
      </label>
      {children}
    </div>
  );
}

type StatTone = "default" | "success" | "danger" | "muted";

const STAT_TONE_CLASS: Record<StatTone, string> = {
  default: styles.statDefault,
  success: styles.statSuccess,
  danger: styles.statDanger,
  muted: styles.mutedText,
};

const PM_LABEL: Record<PaymentMethod, string> = {
  CARD: "카드",
  BANK_TRANSFER: "계좌",
  CASH: "현금",
  OTHER: "기타",
};
