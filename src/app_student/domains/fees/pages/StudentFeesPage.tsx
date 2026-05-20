// PATH: src/app_student/domains/fees/pages/StudentFeesPage.tsx
// 학생 수납/결제 조회 페이지 — 조회 전용 (Phase 1)

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "@/shared/api/axios";
import StudentPageShell from "@student/shared/ui/pages/StudentPageShell";
import EmptyState from "@student/layout/EmptyState";
import styles from "./StudentFeesPage.module.css";

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
        <div className={styles.loadingStack}>
          <div className={`stu-skel ${styles.loadingCard}`} />
          <div className={`stu-skel ${styles.loadingTitle}`} />
          <div className={`stu-skel ${styles.loadingRow}`} />
          <div className={`stu-skel ${styles.loadingRow}`} />
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
      <div className={styles.pageStack}>
        {/* Current Month Card */}
        {current && (
          <div className={styles.currentCard}>
            <div className={styles.currentPeriod}>
              {current.billing_year}년 {current.billing_month}월
            </div>
            <div className={styles.currentMain}>
              <div>
                <div className={styles.currentTotal}>{formatKRW(current.total_amount)}</div>
                {current.outstanding_amount > 0 && (
                  <div className={styles.outstandingAmount}>
                    미납: {formatKRW(current.outstanding_amount)}
                  </div>
                )}
              </div>
              <StatusBadge status={current.status} label={current.status_display} />
            </div>
            <div className={styles.dueDate}>
              납부기한: {current.due_date}
            </div>
          </div>
        )}

        {/* Invoice List */}
        <section>
          <div className={styles.sectionTitle}>청구서 내역</div>
          {!invoices?.length ? (
            <EmptyState
              title="청구서가 없습니다"
              description="등록된 청구서가 없어요."
              compact
            />
          ) : (
            <div className={styles.listStack}>
              {invoices.map((inv) => (
                <button
                  key={inv.id}
                  type="button"
                  onClick={() => setSelectedId(selectedId === inv.id ? null : inv.id)}
                  className={`stu-panel stu-panel--pressable ${styles.invoiceButton}`}
                  data-selected={selectedId === inv.id}
                >
                  <div className={styles.invoiceHeader}>
                    <span className={styles.invoicePeriod}>
                      {inv.billing_year}.{String(inv.billing_month).padStart(2, "0")}
                    </span>
                    <StatusBadge status={inv.status} label={inv.status_display} />
                  </div>
                  <div className={styles.invoiceTotal}>
                    {formatKRW(inv.total_amount)}
                  </div>

                  {/* Expanded detail */}
                  {selectedId === inv.id && detail && (
                    <div className={styles.invoiceDetail}>
                      {detail.items?.map((item) => (
                        <div
                          key={item.id}
                          className={styles.invoiceItem}
                        >
                          <span className={styles.invoiceItemDesc}>{item.description}</span>
                          <span className={styles.invoiceItemAmount}>{formatKRW(item.amount)}</span>
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
            <div className={styles.sectionTitle}>납부 내역</div>
            <div className={styles.listStack}>
              {payments.map((pay) => (
                <div
                  key={pay.id}
                  className={`stu-panel ${styles.paymentRow}`}
                >
                  <div>
                    <div className={styles.paymentAmount}>
                      {formatKRW(pay.amount)}
                    </div>
                    <div className={styles.paymentMeta}>
                      {pay.payment_method_display} · {new Date(pay.paid_at).toLocaleDateString("ko-KR")}
                    </div>
                  </div>
                  <span className={styles.paymentDone}>완료</span>
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
  return (
    <span
      className={styles.statusBadge}
      data-status={normalizeStatus(status)}
    >
      {label}
    </span>
  );
}

function normalizeStatus(status: string) {
  if (status === "PENDING" || status === "PARTIAL" || status === "PAID" || status === "OVERDUE") {
    return status.toLowerCase();
  }
  return "cancelled";
}
