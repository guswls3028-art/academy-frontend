// PATH: src/app_admin/domains/staff/components/PayrollSummaryCard.tsx
// 급여 KPI 배너 — 총 근무시간, 기본급, 실지급액을 한눈에 보여주는 상단 카드

import { useQuery } from "@tanstack/react-query";
import { fetchStaffSummaryByRange } from "../api/staff.detail.api";
import { useWorkMonth } from "../operations/context/workMonthHooks";
import { staffQueryKeys } from "../queryKeys";
import styles from "./PayrollSummaryCard.module.css";

const TAX_RATE = 0.033;

function KpiBox({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className={styles.kpiBox} data-accent={accent ? "true" : undefined}>
      <div className={styles.kpiLabel}>
        {label}
      </div>
      <div className={styles.kpiValue}>
        {value}
      </div>
      {sub && (
        <div className={styles.kpiSub}>
          {sub}
        </div>
      )}
    </div>
  );
}

function DetailRow({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className={styles.detailRow}>
      <span className={styles.detailLabel} data-muted={muted ? "true" : undefined}>{label}</span>
      <span className={styles.detailValue} data-muted={muted ? "true" : undefined}>{value}</span>
    </div>
  );
}

export function PayrollSummaryCard() {
  const { staffId, range, year, month } = useWorkMonth();

  const summaryQ = useQuery({
    queryKey: staffQueryKeys.summaryRange(staffId, range.from, range.to),
    queryFn: () => fetchStaffSummaryByRange(staffId, range.from, range.to),
    enabled: !!staffId && !!range.from && !!range.to,
  });

  const s = summaryQ.data;
  if (summaryQ.isLoading || !s) {
    return (
      <div className={styles.loadingGrid}>
        {[1, 2, 3].map((i) => (
          <div key={i} className={styles.skeleton} />
        ))}
      </div>
    );
  }

  const workHours = Number(s.work_hours) || 0;
  const baseWage = Number(s.work_amount) || 0;
  const allowance = Number(s.expense_amount) || 0;
  const grossPay = baseWage + allowance;
  const tax = Math.floor(grossPay * TAX_RATE);
  const netPay = grossPay - tax;

  return (
    <div className={styles.root}>
      {/* KPI 대형 카드 3개 */}
      <div className={styles.kpiGrid}>
        <KpiBox
          label="총 근무시간"
          value={`${workHours.toFixed(1)}h`}
          sub={`${year}년 ${month}월`}
        />
        <KpiBox
          label="기본급"
          value={`${baseWage.toLocaleString()}원`}
          sub={allowance > 0 ? `+ 경비 ${allowance.toLocaleString()}원` : undefined}
        />
        <KpiBox
          label="실지급액"
          value={`${netPay.toLocaleString()}원`}
          sub={`세금 3.3% 공제 후`}
          accent
        />
      </div>

      {/* 상세 내역 (접이식) */}
      <details className={styles.details}>
        <summary className={styles.summary}>
          급여 상세 내역
        </summary>
        <div className={styles.detailBody}>
          <DetailRow label="총 근무시간" value={`${workHours.toFixed(1)} h`} />
          <DetailRow label="기본급 (근무)" value={`${baseWage.toLocaleString()}원`} />
          <DetailRow label="수당 · 경비" value={`${allowance.toLocaleString()}원`} />
          <DetailRow label="총 지급액" value={`${grossPay.toLocaleString()}원`} />
          <DetailRow label="세금 (3.3%)" value={`-${tax.toLocaleString()}원`} muted />
          <div className={styles.netRow}>
            <span className={styles.netLabel}>실지급액</span>
            <span className={styles.netValue}>{netPay.toLocaleString()}원</span>
          </div>
        </div>
      </details>
    </div>
  );
}
