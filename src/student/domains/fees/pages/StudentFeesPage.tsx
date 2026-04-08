// PATH: src/student/domains/fees/pages/StudentFeesPage.tsx
// 학생 수납/결제 조회 페이지 — 조회 전용 (Phase 1)

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "@/shared/api/axios";

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
  PENDING: { bg: "#fff3e0", color: "#e65100" },
  PARTIAL: { bg: "#e3f2fd", color: "#1565c0" },
  PAID: { bg: "#e8f5e9", color: "#2e7d32" },
  OVERDUE: { bg: "#ffebee", color: "#c62828" },
};

export default function StudentFeesPage() {
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const { data: invoices, isLoading } = useQuery({
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

  return (
    <div style={{ padding: "16px", maxWidth: 600, margin: "0 auto" }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>수납/결제</h2>

      {isLoading ? (
        <p style={{ color: "var(--stu-muted)" }}>불러오는 중...</p>
      ) : (
        <>
          {/* Current Month Card */}
          {current && (
            <div
              style={{
                padding: 16,
                borderRadius: 12,
                background: "var(--stu-surface, #fff)",
                border: "1px solid var(--stu-border, #e0e0e0)",
                marginBottom: 20,
              }}
            >
              <div style={{ fontSize: 13, color: "var(--stu-muted, #888)", marginBottom: 4 }}>
                {current.billing_year}년 {current.billing_month}월
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 24, fontWeight: 700 }}>{formatKRW(current.total_amount)}</div>
                  {current.outstanding_amount > 0 && (
                    <div style={{ fontSize: 13, color: "#c62828", marginTop: 4 }}>
                      미납: {formatKRW(current.outstanding_amount)}
                    </div>
                  )}
                </div>
                <span
                  style={{
                    padding: "4px 10px",
                    borderRadius: 6,
                    fontSize: 13,
                    fontWeight: 600,
                    backgroundColor: STATUS_STYLE[current.status]?.bg ?? "#f5f5f5",
                    color: STATUS_STYLE[current.status]?.color ?? "#666",
                  }}
                >
                  {current.status_display}
                </span>
              </div>
              <div style={{ fontSize: 12, color: "var(--stu-muted, #888)", marginTop: 8 }}>
                납부기한: {current.due_date}
              </div>
            </div>
          )}

          {/* Invoice List */}
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>청구서 내역</h3>
          {!invoices?.length ? (
            <p style={{ color: "var(--stu-muted, #888)", fontSize: 14, textAlign: "center", padding: 24 }}>
              청구서가 없습니다
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {invoices.map((inv) => (
                <div
                  key={inv.id}
                  onClick={() => setSelectedId(selectedId === inv.id ? null : inv.id)}
                  style={{
                    padding: 12,
                    borderRadius: 8,
                    background: "var(--stu-surface, #fff)",
                    border: selectedId === inv.id
                      ? "2px solid var(--stu-primary, #1976d2)"
                      : "1px solid var(--stu-border, #e0e0e0)",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontWeight: 500 }}>
                      {inv.billing_year}.{String(inv.billing_month).padStart(2, "0")}
                    </span>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        padding: "2px 8px",
                        borderRadius: 4,
                        backgroundColor: STATUS_STYLE[inv.status]?.bg ?? "#f5f5f5",
                        color: STATUS_STYLE[inv.status]?.color ?? "#666",
                      }}
                    >
                      {inv.status_display}
                    </span>
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 700, marginTop: 4 }}>
                    {formatKRW(inv.total_amount)}
                  </div>

                  {/* Expanded detail */}
                  {selectedId === inv.id && detail && (
                    <div
                      style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--stu-border, #e0e0e0)" }}
                    >
                      {detail.items?.map((item) => (
                        <div
                          key={item.id}
                          style={{ display: "flex", justifyContent: "space-between", fontSize: 14, padding: "4px 0" }}
                        >
                          <span>{item.description}</span>
                          <span>{formatKRW(item.amount)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Payment History */}
          {payments && payments.length > 0 && (
            <>
              <h3 style={{ fontSize: 16, fontWeight: 600, marginTop: 24, marginBottom: 12 }}>납부 내역</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {payments.map((pay) => (
                  <div
                    key={pay.id}
                    style={{
                      padding: 12,
                      borderRadius: 8,
                      background: "var(--stu-surface, #fff)",
                      border: "1px solid var(--stu-border, #e0e0e0)",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 500 }}>
                        {formatKRW(pay.amount)}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--stu-muted, #888)" }}>
                        {pay.payment_method_display} · {new Date(pay.paid_at).toLocaleDateString("ko-KR")}
                      </div>
                    </div>
                    <span style={{ fontSize: 12, color: "#2e7d32", fontWeight: 600 }}>완료</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
