// PATH: src/app_admin/domains/fees/components/FeesDashboardTab.tsx
// 수납 현황 대시보드 — KPI 카드 + 연체 학생 테이블

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { KPI, EmptyState } from "@/shared/ui/ds";
import { DomainTable } from "@/shared/ui/domain";
import { formatKRW } from "@/shared/product/fees/feesFormat";
import { fetchDashboard, fetchOverdueInvoices, type DashboardStats, type StudentInvoice } from "../api/fees.api";
import { adminFeesQueryKeys } from "../queryKeys";
import { FEES_STATUS_LABEL, type InvoiceStatus } from "../utils/feesStatus";
import styles from "./FeesDashboardTab.module.css";

const STATUS_CLASS: Record<InvoiceStatus, string> = {
  PENDING: styles.statusPending,
  PARTIAL: styles.statusPartial,
  PAID: styles.statusPaid,
  OVERDUE: styles.statusOverdue,
  CANCELLED: styles.statusCancelled,
};

function StatusBadge({ status }: { status: string }) {
  const isKnownStatus = status in FEES_STATUS_LABEL;
  const key = isKnownStatus ? (status as InvoiceStatus) : null;
  const label = key ? FEES_STATUS_LABEL[key] : status;
  const toneClass = key ? STATUS_CLASS[key] : styles.statusUnknown;

  return (
    <span className={`${styles.statusBadge} ${toneClass}`}>
      {label}
    </span>
  );
}

export { StatusBadge };

export default function FeesDashboardTab() {
  const navigate = useNavigate();
  const today = new Date();
  const [year] = useState(today.getFullYear());
  const [month] = useState(today.getMonth() + 1);

  const goInvoices = () => navigate("/admin/fees/invoices");

  const { data: stats, isLoading, isError } = useQuery({
    queryKey: adminFeesQueryKeys.dashboard(year, month),
    queryFn: () => fetchDashboard({ year, month }),
    staleTime: 10_000,
  });

  const { data: overdueList } = useQuery({
    queryKey: adminFeesQueryKeys.overdue,
    queryFn: fetchOverdueInvoices,
    staleTime: 10_000,
  });

  if (isLoading) {
    return (
      <div className={`${styles.root} ${styles.loadingRoot}`} aria-label="로딩 중">
        <div className={`skeleton ${styles.skeletonMedium}`} />
        <div className={`skeleton ${styles.skeletonMedium}`} />
        <div className={`skeleton ${styles.skeletonLarge}`} />
      </div>
    );
  }

  if (isError) {
    return (
      <div className={styles.errorRoot}>
        <EmptyState title="수납 데이터를 불러올 수 없습니다" description="잠시 후 다시 시도해 주세요." />
      </div>
    );
  }

  const s = (stats ?? {}) as DashboardStats;

  return (
    <div className={styles.root}>
      {/* KPI Cards */}
      <div className={styles.kpiGrid}>
        <KPI label="이번 달 청구 총액" value={formatKRW(s.total_billed ?? 0)} />
        <KPI label="수납 총액" value={formatKRW(s.total_paid ?? 0)} />
        <KPI
          label="미납 잔액"
          value={formatKRW(s.total_outstanding ?? 0)}
          hint={s.total_outstanding > 0 ? "청구서 보기 →" : undefined}
          onClick={s.total_outstanding > 0 ? goInvoices : undefined}
        />
        <KPI
          label="연체 건수"
          value={`${s.overdue_count ?? 0}건`}
          hint={s.overdue_count > 0 ? "청구서 보기 →" : undefined}
          onClick={s.overdue_count > 0 ? goInvoices : undefined}
        />
      </div>

      {/* Fee Type Breakdown */}
      {s.by_fee_type && s.by_fee_type.length > 0 && (
        <div>
          <h3 className={styles.sectionTitle}>
            비목별 청구 현황
          </h3>
          <div className={styles.feeTypeList}>
            {s.by_fee_type.map((ft: { fee_type: string; total: number }) => {
              const labels: Record<string, string> = {
                TUITION: "수강료", TEXTBOOK: "교재비", HANDOUT: "판서/프린트",
                REGISTRATION: "등록비", MATERIAL: "재료비", OTHER: "기타",
              };
              return (
                <div key={ft.fee_type} className={styles.feeTypeCard}>
                  <div className={styles.feeTypeLabel}>
                    {labels[ft.fee_type] ?? ft.fee_type}
                  </div>
                  <div className={styles.feeTypeValue}>
                    {formatKRW(ft.total)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Overdue Table */}
      <div>
        <h3 className={styles.sectionTitle}>
          연체 학생
        </h3>
        {!overdueList?.length ? (
          <EmptyState title="연체 학생이 없습니다" />
        ) : (
          <DomainTable>
            <table className="ds-table">
              <thead>
                <tr>
                  <th>학생</th>
                  <th>청구월</th>
                  <th className={styles.amountCell}>청구액</th>
                  <th className={styles.amountCell}>미납액</th>
                  <th>납부기한</th>
                  <th>상태</th>
                </tr>
              </thead>
              <tbody>
                {overdueList.map((inv: StudentInvoice) => (
                  <tr key={inv.id}>
                    <td>{inv.student_name}</td>
                    <td>{inv.billing_year}.{String(inv.billing_month).padStart(2, "0")}</td>
                    <td className={styles.amountCell}>{formatKRW(inv.total_amount)}</td>
                    <td className={`${styles.amountCell} ${styles.outstandingCell}`}>
                      {formatKRW(inv.outstanding_amount)}
                    </td>
                    <td>{inv.due_date}</td>
                    <td><StatusBadge status={inv.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DomainTable>
        )}
      </div>
    </div>
  );
}
