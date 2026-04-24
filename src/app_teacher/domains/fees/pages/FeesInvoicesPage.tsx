// PATH: src/app_teacher/domains/fees/pages/FeesInvoicesPage.tsx
// 수납 송장 목록 + 상세 BottomSheet + 결제 기록
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { EmptyState } from "@/shared/ui/ds";
import { Card, BackButton } from "@teacher/shared/ui/Card";
import { Badge } from "@teacher/shared/ui/Badge";
import BottomSheet from "@teacher/shared/ui/BottomSheet";
import { teacherToast } from "@teacher/shared/ui/teacherToast";
import { ChevronRight, Search } from "@teacher/shared/ui/Icons";
import {
  fetchInvoices,
  fetchInvoiceDetail,
  recordPayment,
  type StudentInvoice,
  type InvoiceStatus,
  type PaymentMethod,
} from "../api";

type FilterKey = "ALL" | "PENDING" | "PARTIAL" | "OVERDUE" | "PAID";

const FILTER_TABS: { key: FilterKey; label: string }[] = [
  { key: "ALL", label: "전체" },
  { key: "PENDING", label: "대기" },
  { key: "PARTIAL", label: "부분" },
  { key: "OVERDUE", label: "연체" },
  { key: "PAID", label: "완납" },
];

const STATUS_TONE: Record<InvoiceStatus, "success" | "danger" | "warning" | "info" | "neutral"> = {
  PAID: "success",
  PARTIAL: "warning",
  PENDING: "neutral",
  OVERDUE: "danger",
  CANCELLED: "neutral",
};

function formatKRW(n: number): string {
  if (n == null) return "-";
  return new Intl.NumberFormat("ko-KR").format(Math.round(n));
}

export default function FeesInvoicesPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const openId = searchParams.get("id");
  const selectedId = openId && /^\d+$/.test(openId) ? Number(openId) : null;

  const [filter, setFilter] = useState<FilterKey>("ALL");
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["teacher-fees-invoices", filter, search],
    queryFn: () =>
      fetchInvoices({
        ...(filter !== "ALL" ? { status: filter } : {}),
        ...(search ? { search } : {}),
      }),
  });

  const invoices = (data as any as StudentInvoice[]) ?? [];

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
        <h1 className="text-[17px] font-bold flex-1" style={{ color: "var(--tc-text)" }}>
          송장
        </h1>
      </div>

      {/* Search */}
      <div className="flex items-center gap-2 rounded-xl"
        style={{ padding: "8px 12px", background: "var(--tc-surface)", border: "1px solid var(--tc-border)" }}>
        <Search size={16} style={{ color: "var(--tc-text-muted)", flexShrink: 0 }} />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="학생 이름, 송장 번호"
          className="flex-1 text-sm"
          style={{ border: "none", background: "transparent", color: "var(--tc-text)", outline: "none" }}
        />
      </div>

      {/* Filter tabs */}
      <div className="flex overflow-x-auto" style={{ borderBottom: "1px solid var(--tc-border)", WebkitOverflowScrolling: "touch" }}>
        {FILTER_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setFilter(t.key)}
            className="shrink-0 text-[13px] cursor-pointer"
            style={{
              padding: "12px 14px",
              minHeight: "var(--tc-touch-min)",
              background: "none",
              border: "none",
              borderBottom: filter === t.key ? "2px solid var(--tc-primary)" : "2px solid transparent",
              color: filter === t.key ? "var(--tc-primary)" : "var(--tc-text-secondary)",
              fontWeight: filter === t.key ? 700 : 500,
              whiteSpace: "nowrap",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <EmptyState scope="panel" tone="loading" title="불러오는 중…" />
      ) : invoices.length === 0 ? (
        <EmptyState scope="panel" tone="empty" title="송장이 없습니다" />
      ) : (
        <div className="flex flex-col gap-1.5">
          {invoices.map((inv) => (
            <button
              key={inv.id}
              onClick={() => setSelected(inv.id)}
              className="flex items-center gap-3 rounded-xl w-full text-left cursor-pointer"
              style={{
                padding: "var(--tc-space-3) var(--tc-space-4)",
                minHeight: "var(--tc-touch-min)",
                background: "var(--tc-surface)",
                border: "1px solid var(--tc-border)",
              }}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold" style={{ color: "var(--tc-text)" }}>
                    {inv.student_name}
                  </span>
                  <Badge tone={STATUS_TONE[inv.status]} size="xs">
                    {inv.status_display}
                  </Badge>
                </div>
                <div className="text-[11px] mt-0.5" style={{ color: "var(--tc-text-muted)" }}>
                  {inv.invoice_number} · {inv.billing_year}.{String(inv.billing_month).padStart(2, "0")} · 마감{" "}
                  {inv.due_date}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-sm font-bold tabular-nums" style={{ color: "var(--tc-text)" }}>
                  {formatKRW(inv.total_amount)}
                </div>
                {inv.outstanding_amount > 0 && (
                  <div className="text-[11px] tabular-nums" style={{ color: "var(--tc-danger)" }}>
                    -{formatKRW(inv.outstanding_amount)}
                  </div>
                )}
              </div>
              <ChevronRight size={14} style={{ color: "var(--tc-text-muted)" }} />
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

  const { data: invoice, isLoading } = useQuery({
    queryKey: ["teacher-fees-invoice", invoiceId],
    queryFn: () => fetchInvoiceDetail(invoiceId!),
    enabled: invoiceId != null && open,
  });

  const payMut = useMutation({
    mutationFn: () =>
      recordPayment({
        invoice_id: invoiceId!,
        amount: Number(payAmount),
        payment_method: payMethod,
        receipt_note: payNote,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["teacher-fees-invoices"] });
      qc.invalidateQueries({ queryKey: ["teacher-fees-invoice", invoiceId] });
      qc.invalidateQueries({ queryKey: ["teacher-fees-dashboard"] });
      qc.invalidateQueries({ queryKey: ["teacher-fees-overdue"] });
      teacherToast.success("결제를 기록했습니다.");
      setPayMode(false);
      setPayAmount("");
      setPayNote("");
    },
    onError: (e: any) =>
      teacherToast.error(e?.response?.data?.detail ?? "기록에 실패했습니다."),
  });

  return (
    <BottomSheet open={open} onClose={onClose} title={invoice?.invoice_number ?? "송장 상세"}>
      {isLoading && <EmptyState scope="panel" tone="loading" title="불러오는 중…" />}
      {invoice && (
        <div className="flex flex-col gap-3 pb-3">
          {/* 요약 */}
          <Card>
            <div className="flex justify-between items-center">
              <div>
                <div className="text-sm font-semibold" style={{ color: "var(--tc-text)" }}>
                  {invoice.student_name}
                </div>
                <div className="text-[11px] mt-0.5" style={{ color: "var(--tc-text-muted)" }}>
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
                color="var(--tc-success)"
              />
              <StatBox
                label="잔액"
                value={formatKRW(invoice.outstanding_amount)}
                color={invoice.outstanding_amount > 0 ? "var(--tc-danger)" : "var(--tc-text-muted)"}
              />
            </div>
          </Card>

          {/* 상세 항목 */}
          {invoice.items && invoice.items.length > 0 && (
            <Card style={{ padding: 0, overflow: "hidden" }}>
              <div className="text-[13px] font-bold" style={{ padding: "var(--tc-space-3) var(--tc-space-4)", borderBottom: "1px solid var(--tc-border)", color: "var(--tc-text)" }}>
                청구 항목
              </div>
              {invoice.items.map((it: any, idx: number) => (
                <div key={it.id ?? idx} className="flex justify-between items-center"
                  style={{
                    padding: "var(--tc-space-3) var(--tc-space-4)",
                    borderBottom: idx < (invoice.items!.length - 1) ? "1px solid var(--tc-border)" : "none",
                  }}>
                  <span className="text-sm" style={{ color: "var(--tc-text)" }}>{it.description}</span>
                  <span className="text-sm font-semibold tabular-nums" style={{ color: "var(--tc-text)" }}>
                    {formatKRW(it.amount)}원
                  </span>
                </div>
              ))}
            </Card>
          )}

          {/* 결제 기록 */}
          {invoice.payments && invoice.payments.length > 0 && (
            <Card style={{ padding: 0, overflow: "hidden" }}>
              <div className="text-[13px] font-bold" style={{ padding: "var(--tc-space-3) var(--tc-space-4)", borderBottom: "1px solid var(--tc-border)", color: "var(--tc-text)" }}>
                결제 이력
              </div>
              {invoice.payments.map((p: any, idx: number) => (
                <div key={p.id} className="flex justify-between items-center"
                  style={{
                    padding: "var(--tc-space-3) var(--tc-space-4)",
                    borderBottom: idx < (invoice.payments!.length - 1) ? "1px solid var(--tc-border)" : "none",
                  }}>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px]" style={{ color: "var(--tc-text)" }}>
                      {p.payment_method_display} · {formatKRW(p.amount)}원
                    </div>
                    <div className="text-[11px]" style={{ color: "var(--tc-text-muted)" }}>
                      {new Date(p.paid_at || p.created_at).toLocaleDateString("ko-KR")}
                    </div>
                  </div>
                </div>
              ))}
            </Card>
          )}

          {/* 결제 기록 버튼 / 폼 */}
          {invoice.outstanding_amount > 0 && invoice.status !== "CANCELLED" && (
            <>
              {!payMode ? (
                <button
                  onClick={() => { setPayMode(true); setPayAmount(String(invoice.outstanding_amount)); }}
                  className="text-sm font-bold cursor-pointer w-full"
                  style={{
                    padding: "14px",
                    minHeight: "var(--tc-touch-min)",
                    borderRadius: "var(--tc-radius)",
                    border: "none",
                    background: "var(--tc-primary)",
                    color: "#fff",
                  }}
                >
                  결제 기록하기
                </button>
              ) : (
                <Card>
                  <div className="text-[13px] font-bold mb-2" style={{ color: "var(--tc-text)" }}>
                    결제 기록
                  </div>
                  <div className="flex flex-col gap-2">
                    <Field label="금액">
                      <input
                        type="number"
                        value={payAmount}
                        onChange={(e) => setPayAmount(e.target.value)}
                        className="w-full text-sm tabular-nums"
                        style={fieldStyle}
                      />
                    </Field>
                    <Field label="수단">
                      <div className="flex gap-1.5">
                        {(["CARD", "BANK_TRANSFER", "CASH", "OTHER"] as PaymentMethod[]).map((m) => (
                          <button
                            key={m}
                            type="button"
                            onClick={() => setPayMethod(m)}
                            className="text-[12px] font-semibold cursor-pointer"
                            style={{
                              padding: "8px 12px",
                              minHeight: "var(--tc-touch-min)",
                              borderRadius: "var(--tc-radius-sm)",
                              border:
                                payMethod === m
                                  ? "2px solid var(--tc-primary)"
                                  : "1px solid var(--tc-border)",
                              background:
                                payMethod === m ? "var(--tc-primary-bg)" : "var(--tc-surface)",
                              color:
                                payMethod === m ? "var(--tc-primary)" : "var(--tc-text-secondary)",
                            }}
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
                        className="w-full text-sm"
                        style={fieldStyle}
                      />
                    </Field>
                    <div className="flex gap-2 mt-1">
                      <button
                        onClick={() => setPayMode(false)}
                        className="flex-1 text-sm font-semibold cursor-pointer"
                        style={{
                          padding: "12px",
                          minHeight: "var(--tc-touch-min)",
                          borderRadius: "var(--tc-radius)",
                          border: "1px solid var(--tc-border)",
                          background: "var(--tc-surface)",
                          color: "var(--tc-text-secondary)",
                        }}
                      >
                        취소
                      </button>
                      <button
                        onClick={() => payMut.mutate()}
                        disabled={payMut.isPending || !payAmount}
                        className="flex-1 text-sm font-bold cursor-pointer disabled:opacity-50"
                        style={{
                          padding: "12px",
                          minHeight: "var(--tc-touch-min)",
                          borderRadius: "var(--tc-radius)",
                          border: "none",
                          background: "var(--tc-primary)",
                          color: "#fff",
                        }}
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

function StatBox({ label, value, color = "var(--tc-text)" }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-lg flex flex-col items-center py-2"
      style={{ background: "var(--tc-surface-soft)", border: "1px solid var(--tc-border)" }}>
      <span className="text-[10px]" style={{ color: "var(--tc-text-muted)" }}>{label}</span>
      <span className="text-[13px] font-bold tabular-nums" style={{ color }}>{value}</span>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[11px] font-semibold block mb-1" style={{ color: "var(--tc-text-muted)" }}>
        {label}
      </label>
      {children}
    </div>
  );
}

const fieldStyle: React.CSSProperties = {
  padding: "10px 12px",
  minHeight: "var(--tc-touch-min)",
  borderRadius: "var(--tc-radius-sm)",
  border: "1px solid var(--tc-border-strong)",
  background: "var(--tc-surface)",
  color: "var(--tc-text)",
  outline: "none",
};

const PM_LABEL: Record<PaymentMethod, string> = {
  CARD: "카드",
  BANK_TRANSFER: "계좌",
  CASH: "현금",
  OTHER: "기타",
};
