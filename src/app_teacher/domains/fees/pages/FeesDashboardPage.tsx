// PATH: src/app_teacher/domains/fees/pages/FeesDashboardPage.tsx
// 수납 대시보드 — 당월 청구/수납/미납 요약 + 연체 리스트
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { EmptyState } from "@/shared/ui/ds";
import { Card, SectionTitle, KpiCard, BackButton } from "@teacher/shared/ui/Card";
import { Badge } from "@teacher/shared/ui/Badge";
import { ChevronRight } from "@teacher/shared/ui/Icons";
import { fetchDashboard, fetchOverdueInvoices } from "../api";

function formatKRW(n: number): string {
  if (n == null) return "-";
  return new Intl.NumberFormat("ko-KR").format(Math.round(n));
}

export default function FeesDashboardPage() {
  const navigate = useNavigate();
  const now = new Date();
  const [year] = useState(now.getFullYear());
  const [month] = useState(now.getMonth() + 1);

  const { data: dashboard, isLoading, isError, refetch } = useQuery({
    queryKey: ["teacher-fees-dashboard", year, month],
    queryFn: () => fetchDashboard({ year, month }),
  });

  const { data: overdue } = useQuery({
    queryKey: ["teacher-fees-overdue"],
    queryFn: fetchOverdueInvoices,
  });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 py-0.5">
        <BackButton onClick={() => navigate(-1)} />
        <h1 className="text-[17px] font-bold flex-1" style={{ color: "var(--tc-text)" }}>
          수납 {year}.{String(month).padStart(2, "0")}
        </h1>
        <button
          onClick={() => navigate("/teacher/fees/invoices")}
          className="text-[12px] font-bold cursor-pointer"
          style={{
            padding: "8px 12px",
            minHeight: "var(--tc-touch-min)",
            borderRadius: "var(--tc-radius)",
            border: "1px solid var(--tc-border)",
            background: "var(--tc-surface)",
            color: "var(--tc-primary)",
          }}
        >
          송장 →
        </button>
      </div>

      {isLoading && <EmptyState scope="panel" tone="loading" title="불러오는 중…" />}

      {isError && !isLoading && (
        <Card>
          <div className="text-[13px] font-semibold mb-1" style={{ color: "var(--tc-danger)" }}>
            대시보드를 불러오지 못했습니다.
          </div>
          <div className="text-[12px] leading-relaxed mb-3" style={{ color: "var(--tc-text-muted)" }}>
            네트워크나 서버 문제일 수 있습니다. 잠시 후 다시 시도해 주세요.
          </div>
          <button
            onClick={() => refetch()}
            className="text-[13px] font-bold cursor-pointer"
            style={{
              padding: "10px 14px",
              minHeight: "var(--tc-touch-min)",
              borderRadius: "var(--tc-radius)",
              border: "1px solid var(--tc-border-strong)",
              background: "var(--tc-surface)",
              color: "var(--tc-text)",
            }}
          >
            다시 시도
          </button>
        </Card>
      )}

      {dashboard && (
        <>
          {/* KPI */}
          <div className="grid grid-cols-3 gap-2">
            <KpiCard label="청구" value={formatKRW(dashboard.total_billed)} color="var(--tc-primary)" />
            <KpiCard label="수납" value={formatKRW(dashboard.total_paid)} color="var(--tc-success)" />
            <KpiCard
              label="미납"
              value={formatKRW(dashboard.total_outstanding)}
              color="var(--tc-danger)"
            />
          </div>

          {/* 상태별 카운트 */}
          <Card>
            <div className="flex justify-around">
              <Stat label="발행" value={dashboard.invoice_count} />
              <Stat label="대기" value={dashboard.pending_count} color="var(--tc-warn)" />
              <Stat label="완납" value={dashboard.paid_count} color="var(--tc-success)" />
              <Stat label="연체" value={dashboard.overdue_count} color="var(--tc-danger)" />
            </div>
          </Card>

          {/* 비목별 분해 */}
          {dashboard.by_fee_type?.length > 0 && (
            <>
              <SectionTitle>비목별 청구</SectionTitle>
              <Card style={{ padding: 0, overflow: "hidden" }}>
                {dashboard.by_fee_type.map((row, i) => (
                  <div
                    key={row.fee_type}
                    className="flex justify-between items-center"
                    style={{
                      padding: "var(--tc-space-3) var(--tc-space-4)",
                      borderBottom:
                        i < dashboard.by_fee_type.length - 1
                          ? "1px solid var(--tc-border)"
                          : "none",
                    }}
                  >
                    <span className="text-sm" style={{ color: "var(--tc-text)" }}>
                      {FEE_TYPE_LABEL[row.fee_type] ?? row.fee_type}
                    </span>
                    <span className="text-sm font-semibold tabular-nums" style={{ color: "var(--tc-text)" }}>
                      {formatKRW(row.total)}원
                    </span>
                  </div>
                ))}
              </Card>
            </>
          )}
        </>
      )}

      {/* 연체 리스트 */}
      <SectionTitle right={overdue && overdue.length > 0 ? <Badge tone="danger" pill>{overdue.length}건</Badge> : undefined}>
        연체 송장
      </SectionTitle>
      {overdue && overdue.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          {overdue.slice(0, 20).map((inv: any) => (
            <button
              key={inv.id}
              onClick={() => navigate(`/teacher/fees/invoices?id=${inv.id}`)}
              className="flex items-center gap-3 rounded-xl w-full text-left cursor-pointer"
              style={{
                padding: "var(--tc-space-3) var(--tc-space-4)",
                minHeight: "var(--tc-touch-min)",
                background: "var(--tc-surface)",
                border: "1px solid var(--tc-border)",
              }}
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold truncate" style={{ color: "var(--tc-text)" }}>
                  {inv.student_name}
                </div>
                <div className="text-[11px] mt-0.5" style={{ color: "var(--tc-text-muted)" }}>
                  {inv.invoice_number} · 마감 {inv.due_date}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-sm font-bold tabular-nums" style={{ color: "var(--tc-danger)" }}>
                  {formatKRW(inv.outstanding_amount)}원
                </div>
              </div>
              <ChevronRight size={14} style={{ color: "var(--tc-text-muted)" }} />
            </button>
          ))}
        </div>
      ) : (
        <EmptyState scope="panel" tone="empty" title="연체 송장이 없습니다" />
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  color = "var(--tc-text)",
}: {
  label: string;
  value: number;
  color?: string;
}) {
  return (
    <div className="flex flex-col items-center">
      <span className="text-[18px] font-bold tabular-nums" style={{ color }}>
        {value ?? 0}
      </span>
      <span className="text-[11px]" style={{ color: "var(--tc-text-muted)" }}>
        {label}
      </span>
    </div>
  );
}

const FEE_TYPE_LABEL: Record<string, string> = {
  TUITION: "수강료",
  TEXTBOOK: "교재",
  HANDOUT: "프린트",
  REGISTRATION: "등록비",
  MATERIAL: "부교재",
  OTHER: "기타",
};
