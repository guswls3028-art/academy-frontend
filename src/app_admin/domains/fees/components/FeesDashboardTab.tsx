// PATH: src/app_admin/domains/fees/components/FeesDashboardTab.tsx
// 수납 현황 대시보드 — KPI 카드 + 연체 학생 테이블

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { KPI, EmptyState } from "@/shared/ui/ds";
import { DomainTable } from "@/shared/ui/domain";
import { fetchDashboard, fetchOverdueInvoices, type DashboardStats, type StudentInvoice } from "../api/fees.api";

function formatKRW(n: number) {
  return `${n.toLocaleString("ko-KR")}원`;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string; label: string }> = {
    PENDING: { bg: "var(--color-warning-bg)", color: "var(--color-warning)", label: "미납" },
    PARTIAL: { bg: "var(--color-info-bg)", color: "var(--color-info)", label: "부분납" },
    PAID: { bg: "var(--color-success-bg)", color: "var(--color-success)", label: "완납" },
    OVERDUE: { bg: "var(--color-danger-bg)", color: "var(--color-danger)", label: "연체" },
    CANCELLED: { bg: "var(--color-neutral-bg)", color: "var(--color-text-muted)", label: "취소" },
  };
  const s = map[status] ?? { bg: "#eee", color: "#999", label: status };
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: 4,
        fontSize: 12,
        fontWeight: 600,
        backgroundColor: s.bg,
        color: s.color,
      }}
    >
      {s.label}
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
    queryKey: ["fees", "dashboard", year, month],
    queryFn: () => fetchDashboard({ year, month }),
    staleTime: 10_000,
  });

  const { data: overdueList } = useQuery({
    queryKey: ["fees", "overdue"],
    queryFn: fetchOverdueInvoices,
    staleTime: 10_000,
  });

  if (isLoading) {
    return (
      <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 12 }} aria-label="로딩 중">
        <div className="skeleton" style={{ height: 80, borderRadius: 12 }} />
        <div className="skeleton" style={{ height: 80, borderRadius: 12 }} />
        <div className="skeleton" style={{ height: 220, borderRadius: 12 }} />
      </div>
    );
  }

  if (isError) {
    return (
      <div style={{ padding: 24 }}>
        <EmptyState title="수납 데이터를 불러올 수 없습니다" description="잠시 후 다시 시도해 주세요." />
      </div>
    );
  }

  const s = stats ?? {} as DashboardStats;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      {/* KPI Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "var(--space-3)",
        }}
      >
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
          <h3
            style={{
              fontSize: 15,
              fontWeight: 600,
              color: "var(--color-text-primary)",
              marginBottom: "var(--space-2)",
            }}
          >
            비목별 청구 현황
          </h3>
          <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
            {s.by_fee_type.map((ft: { fee_type: string; total: number }) => {
              const labels: Record<string, string> = {
                TUITION: "수강료", TEXTBOOK: "교재비", HANDOUT: "판서/프린트",
                REGISTRATION: "등록비", MATERIAL: "재료비", OTHER: "기타",
              };
              return (
                <div
                  key={ft.fee_type}
                  style={{
                    padding: "8px 16px",
                    borderRadius: 8,
                    border: "1px solid var(--color-border-divider)",
                    background: "var(--bg-surface)",
                    minWidth: 120,
                  }}
                >
                  <div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
                    {labels[ft.fee_type] ?? ft.fee_type}
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 700, marginTop: 2 }}>
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
        <h3
          style={{
            fontSize: 15,
            fontWeight: 600,
            color: "var(--color-text-primary)",
            marginBottom: "var(--space-2)",
          }}
        >
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
                  <th style={{ textAlign: "right" }}>청구액</th>
                  <th style={{ textAlign: "right" }}>미납액</th>
                  <th>납부기한</th>
                  <th>상태</th>
                </tr>
              </thead>
              <tbody>
                {overdueList.map((inv: StudentInvoice) => (
                  <tr key={inv.id}>
                    <td>{inv.student_name}</td>
                    <td>{inv.billing_year}.{String(inv.billing_month).padStart(2, "0")}</td>
                    <td style={{ textAlign: "right" }}>{formatKRW(inv.total_amount)}</td>
                    <td style={{ textAlign: "right", fontWeight: 600, color: "var(--color-danger)" }}>
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
