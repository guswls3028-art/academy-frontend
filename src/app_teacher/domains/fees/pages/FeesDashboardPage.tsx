// PATH: src/app_teacher/domains/fees/pages/FeesDashboardPage.tsx
// 수납 대시보드 — 당월 청구/수납/미납 요약 + 연체 리스트
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { EmptyState, ICON } from "@/shared/ui/ds";
import { Card, SectionTitle, KpiCard, BackButton } from "@teacher/shared/ui/Card";
import { Badge } from "@teacher/shared/ui/Badge";
import { ChevronRight } from "@teacher/shared/ui/Icons";
import { formatKRWNumber as formatKRW } from "@/shared/product/fees/feesFormat";
import { fetchDashboard, fetchOverdueInvoices, type FeeType, type StudentInvoice } from "../api";
import {
  FEES_PERMISSION_ERROR_DESCRIPTION,
  FEES_PERMISSION_ERROR_TITLE,
  isFeesPermissionError,
} from "../feesError";
import { teacherFeesQueryKeys } from "../queryKeys";
import styles from "./FeesDashboardPage.module.css";

export default function FeesDashboardPage() {
  const navigate = useNavigate();
  const now = new Date();
  const [year] = useState(now.getFullYear());
  const [month] = useState(now.getMonth() + 1);

  const { data: dashboard, isLoading, isError, error, refetch } = useQuery({
    queryKey: teacherFeesQueryKeys.dashboardMonth(year, month),
    queryFn: () => fetchDashboard({ year, month }),
    retry: (failureCount, queryError) => !isFeesPermissionError(queryError) && failureCount < 2,
  });
  const isPermissionError = isFeesPermissionError(error);

  const { data: overdue } = useQuery({
    queryKey: teacherFeesQueryKeys.overdue,
    queryFn: fetchOverdueInvoices,
    enabled: dashboard != null,
  });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 py-0.5">
        <BackButton onClick={() => navigate(-1)} />
        <h1 className={`${styles.title} text-[17px] font-bold flex-1`}>
          수납 관리 · {year}.{String(month).padStart(2, "0")}
        </h1>
        <button
          type="button"
          onClick={() => navigate("/teacher/fees/invoices")}
          className={`${styles.invoiceLink} text-[12px] font-bold cursor-pointer`}
        >
          청구서 →
        </button>
      </div>

      {isPermissionError && (
        <EmptyState
          scope="panel"
          tone="error"
          title={FEES_PERMISSION_ERROR_TITLE}
          description={FEES_PERMISSION_ERROR_DESCRIPTION}
        />
      )}

      {!isPermissionError && isLoading && <EmptyState scope="panel" tone="loading" title="불러오는 중…" />}

      {isError && !isLoading && !isPermissionError && (
        <Card>
          <div className={`${styles.errorTitle} text-[13px] font-semibold mb-1`}>
            대시보드를 불러오지 못했습니다.
          </div>
          <div className={`${styles.mutedText} text-[12px] leading-relaxed mb-3`}>
            네트워크나 서버 문제일 수 있습니다. 잠시 후 다시 시도해 주세요.
          </div>
          <button
            type="button"
            onClick={() => refetch()}
            className={`${styles.retryButton} text-[13px] font-bold cursor-pointer`}
          >
            다시 시도
          </button>
        </Card>
      )}

      {dashboard && (
        <>
          {/* KPI — 금액 */}
          <div className="grid grid-cols-3 gap-2">
            <KpiCard label="청구 총액" value={formatKRW(dashboard.total_billed)} color="var(--tc-primary)" />
            <KpiCard label="수납 총액" value={formatKRW(dashboard.total_paid)} color="var(--tc-success)" />
            <KpiCard
              label="미납 잔액"
              value={formatKRW(dashboard.total_outstanding)}
              color="var(--tc-danger)"
            />
          </div>

          {/* 상태별 건수 */}
          <Card>
            <div className={`${styles.sectionCaption} text-[11px] font-semibold mb-2`}>
              청구서 건수
            </div>
            <div className="flex justify-around">
              <Stat label="발행" value={dashboard.invoice_count} />
              <Stat label="미납" value={dashboard.pending_count} tone="warn" />
              <Stat label="완납" value={dashboard.paid_count} tone="success" />
              <Stat label="연체" value={dashboard.overdue_count} tone="danger" />
            </div>
          </Card>

          {/* 비목별 분해 */}
          {dashboard.by_fee_type?.length > 0 && (
            <>
              <SectionTitle>비목별 청구</SectionTitle>
              <div className={styles.breakdownCard}>
                {dashboard.by_fee_type.map((row, i) => (
                  <div
                    key={row.fee_type}
                    className={`${styles.breakdownRow} ${i === dashboard.by_fee_type.length - 1 ? styles.lastRow : ""} flex justify-between items-center`}
                  >
                    <span className={`${styles.primaryText} text-sm`}>
                      {FEE_TYPE_LABEL[row.fee_type] ?? row.fee_type}
                    </span>
                    <span className={`${styles.primaryText} text-sm font-semibold tabular-nums`}>
                      {formatKRW(row.total)}원
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {dashboard && (
        <>
          {/* 연체 리스트 */}
          <SectionTitle right={overdue && overdue.length > 0 ? <Badge tone="danger" pill>{overdue.length}건</Badge> : undefined}>
            연체 청구서
          </SectionTitle>
          {overdue && overdue.length > 0 ? (
            <div className="flex flex-col gap-1.5">
              {overdue.slice(0, 20).map((inv: StudentInvoice) => (
                <button
                  type="button"
                  key={inv.id}
                  onClick={() => navigate(`/teacher/fees/invoices?id=${inv.id}`)}
                  className={`${styles.overdueButton} flex items-center gap-3 rounded-xl w-full text-left cursor-pointer`}
                >
                  <div className="flex-1 min-w-0">
                    <div className={`${styles.primaryText} text-sm font-semibold truncate`}>
                      {inv.student_name}
                    </div>
                    <div className={`${styles.mutedText} text-[11px] mt-0.5`}>
                      {inv.invoice_number} · 마감 {inv.due_date}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className={`${styles.dangerText} text-sm font-bold tabular-nums`}>
                      {formatKRW(inv.outstanding_amount)}원
                    </div>
                  </div>
                  <ChevronRight size={ICON.xs} className={styles.chevron} />
                </button>
              ))}
            </div>
          ) : (
            <EmptyState scope="panel" tone="empty" title="연체 청구서가 없습니다" />
          )}
        </>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number;
  tone?: StatTone;
}) {
  return (
    <div className="flex flex-col items-center">
      <span className={`${styles.statValue} ${STAT_TONE_CLASS[tone]} text-[18px] font-bold tabular-nums`}>
        {value ?? 0}
      </span>
      <span className={`${styles.mutedText} text-[11px]`}>
        {label}
      </span>
    </div>
  );
}

type StatTone = "default" | "warn" | "success" | "danger";

const STAT_TONE_CLASS: Record<StatTone, string> = {
  default: styles.statDefault,
  warn: styles.statWarn,
  success: styles.statSuccess,
  danger: styles.statDanger,
};

const FEE_TYPE_LABEL: Record<FeeType, string> = {
  TUITION: "수강료",
  TEXTBOOK: "교재",
  HANDOUT: "프린트",
  REGISTRATION: "등록비",
  MATERIAL: "부교재",
  OTHER: "기타",
};
