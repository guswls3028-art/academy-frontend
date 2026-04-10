// PATH: src/student/domains/fees/pages/StudentFeesPage.tsx
// 학생 수납/결제 조회 페이지 — 조회 전용 (Phase 1)

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "@/shared/api/axios";
import StudentPageShell from "@/student/shared/ui/pages/StudentPageShell";
import EmptyState from "@/student/shared/ui/layout/EmptyState";

type InvoiceStatus = "PENDING" | "PARTIAL" | "PAID" | "OVERDUE" | "CANCELLED";

interface InvoiceItem {
  id: number;
  description: string;
  amount: number;
}

interface Invoice {
  id: number;
  invoice_number: string;
  billing_year: number;
  billing_month: number;
  total_amount: number;
  paid_amount: number;
  outstanding_amount: number;
  status: InvoiceStatus;
  status_display: string;
  due_date: string;
  paid_at: string | null;
  items?: InvoiceItem[];
}

interface Payment {
  id: number;
  invoice_number: string;
  amount: number;
  payment_method_display: string;
  paid_at: string;
}

function formatKRW(n: number) {
  return `${n.toLocaleString("ko-KR")}원`;
}

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  PENDING: { bg: "var(--stu-warn-bg)", color: "var(--stu-warn-text)" },
  PARTIAL: { bg: "color-mix(in srgb, var(--stu-primary) 12%, transparent)", color: "var(--stu-primary)" },
  PAID: { bg: "var(--stu-success-bg)", color: "var(--stu-success-text)" },
  OVERDUE: { bg: "var(--stu-danger-bg)", color: "var(--stu-danger-text)" },
  CANCELLED: { bg: "var(--stu-surface-soft)", color: "var(--stu-text-muted)" },
};

export default function StudentFeesPage() {
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const { data: invoices, isLoading, isError, refetch } = useQuery({
    queryKey: ["student", "fees", "invoices"],
    queryFn: async () => {
      const res = await api.get<Invoice[]>("/student/fees/invoices/");
      return res.data;
    },
    staleTime: 10_000,
  });

  const { data: detail } = useQuery({
    queryKey: ["student", "fees", "invoices", selectedId],
    queryFn: async () => {
      const res = await api.get<Invoice>(`/student/fees/invoices/${selectedId}/`);
      return res.data;
    },
    enabled: selectedId != null,
    staleTime: 10_000,
  });

  const { data: payments } = useQuery({
    queryKey: ["student", "fees", "payments"],
    queryFn: async () => {
      const res = await api.get<Payment[]>("/student/fees/payments/");
      return res.data;
    },
    staleTime: 10_000,
  });

  // Current month invoice
  const now = new Date();
  const current = invoices?.find(
    (inv) => inv.billing_year === now.getFullYear() && inv.billing_month === now.getMonth() + 1,
  );

  if (isLoading) {
    return (
      <StudentPageShell title="수납/결제" description="청구서 및 납부 내역">
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--stu-space-4)" }}>
          <div className="stu-skel" style={{ height: 100, borderRadius: "var(--stu-radius)" }} />
          <div className="stu-skel" style={{ height: 20, width: "30%", borderRadius: "var(--stu-radius-sm)" }} />
          <div className="stu-skel" style={{ height: 64, borderRadius: "var(--stu-radius)" }} />
          <div className="stu-skel" style={{ height: 64, borderRadius: "var(--stu-radius)" }} />
        </div>
      </StudentPageShell>
    );
  }

  if (isError) {
    return (
      <StudentPageShell title="수납/결제" description="청구서 및 납부 내역">
        <EmptyState
          title="청구서를 불러오지 못했습니다"
          description="네트워크 연결을 확인하고 다시 시도해 주세요."
          onRetry={() => refetch()}
        />
      </StudentPageShell>
    );
  }

  return (
    <StudentPageShell title="수납/결제" description="청구서 및 납부 내역">
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--stu-space-6)" }}>
        {/* Current Month Card */}
        {current && (
          <div
            style={{
              padding: 16,
              borderRadius: "var(--stu-radius-lg, 12px)",
              background: "linear-gradient(135deg, rgba(59,130,246,0.07) 0%, var(--stu-surface) 55%)",
              border: "1.5px solid rgba(59,130,246,0.18)",
            }}
          >
            <div style={{ fontSize: 12, color: "var(--stu-text-muted)", fontWeight: 600, marginBottom: 6, letterSpacing: "0.03em" }}>
              {current.billing_year}년 {current.billing_month}월
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.02em" }}>{formatKRW(current.total_amount)}</div>
                {current.outstanding_amount > 0 && (
                  <div style={{ fontSize: 13, color: "var(--stu-danger)", marginTop: 4, fontWeight: 600 }}>
                    미납: {formatKRW(current.outstanding_amount)}
                  </div>
                )}
              </div>
              <StatusBadge status={current.status} label={current.status_display} />
            </div>
            <div style={{ fontSize: 12, color: "var(--stu-text-muted)", marginTop: 8 }}>
              납부기한: {current.due_date}
            </div>
          </div>
        )}

        {/* Invoice List */}
        <section>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: "var(--stu-space-3)" }}>청구서 내역</div>
          {!invoices?.length ? (
            <EmptyState
              title="청구서가 없습니다"
              description="등록된 청구서가 없어요."
              compact
            />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--stu-space-2)" }}>
              {invoices.map((inv) => (
                <button
                  key={inv.id}
                  type="button"
                  onClick={() => setSelectedId(selectedId === inv.id ? null : inv.id)}
                  className="stu-panel stu-panel--pressable"
                  style={{ textAlign: "left", cursor: "pointer", borderColor: selectedId === inv.id ? "var(--stu-primary)" : undefined }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>
                      {inv.billing_year}.{String(inv.billing_month).padStart(2, "0")}
                    </span>
                    <StatusBadge status={inv.status} label={inv.status_display} />
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 700, marginTop: 4 }}>
                    {formatKRW(inv.total_amount)}
                  </div>

                  {/* Expanded detail */}
                  {selectedId === inv.id && detail && (
                    <div
                      style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--stu-border)" }}
                    >
                      {detail.items?.map((item) => (
                        <div
                          key={item.id}
                          style={{ display: "flex", justifyContent: "space-between", fontSize: 14, padding: "4px 0" }}
                        >
                          <span style={{ color: "var(--stu-text-muted)" }}>{item.description}</span>
                          <span style={{ fontWeight: 600 }}>{formatKRW(item.amount)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Payment History */}
        {payments && payments.length > 0 && (
          <section>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: "var(--stu-space-3)" }}>납부 내역</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--stu-space-2)" }}>
              {payments.map((pay) => (
                <div
                  key={pay.id}
                  className="stu-panel"
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>
                      {formatKRW(pay.amount)}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--stu-text-muted)", marginTop: 2 }}>
                      {pay.payment_method_display} · {new Date(pay.paid_at).toLocaleDateString("ko-KR")}
                    </div>
                  </div>
                  <span style={{ fontSize: 12, color: "var(--stu-success-text)", fontWeight: 700 }}>완료</span>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </StudentPageShell>
  );
}

function StatusBadge({ status, label }: { status: string; label: string }) {
  const style = STATUS_STYLE[status] ?? STATUS_STYLE.CANCELLED;
  return (
    <span
      style={{
        padding: "4px 10px",
        borderRadius: 6,
        fontSize: 12,
        fontWeight: 700,
        backgroundColor: style.bg,
        color: style.color,
      }}
    >
      {label}
    </span>
  );
}
