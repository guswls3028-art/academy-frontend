// PATH: src/app_admin/domains/staff/components/PayrollSummaryCard.tsx
// 정산 KPI 배너 — 저장된 금액과 서버가 산출한 3.3% 비교 참고값만 표시한다.

import { useQuery } from "@tanstack/react-query";
import { fetchStaffSummaryByRange } from "../api/staff.detail.api";
import { useWorkMonth } from "../operations/context/workMonthHooks";
import { staffQueryKeys } from "../queryKeys";
import { Button, EmptyState } from "@/shared/ui/ds";
import styles from "./PayrollSummaryCard.module.css";

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

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.detailRow}>
      <span className={styles.detailLabel}>{label}</span>
      <span className={styles.detailValue}>{value}</span>
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
  if (summaryQ.isError) {
    return (
      <EmptyState
        scope="panel"
        tone="error"
        title="이번 달 정산 요약을 불러올 수 없습니다"
        actions={
          <Button intent="secondary" size="sm" onClick={() => summaryQ.refetch()}>
            다시 시도
          </Button>
        }
      />
    );
  }
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
  const settlementTotal = Number(s.total_amount) || 0;

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
          label="근무기록 금액"
          value={`${baseWage.toLocaleString()}원`}
          sub="기록된 시간·단가 기준"
        />
        <KpiBox
          label="최종 이체 참고액"
          value={`${s.reference_transfer_amount.toLocaleString()}원`}
          sub="3.3% 적용 시 참고 · 환급 포함"
          accent
        />
      </div>

      {/* 상세 내역 (접이식) */}
      <details className={styles.details}>
        <summary className={styles.summary}>
          정산 상세 내역
        </summary>
        <div className={styles.detailBody}>
          <DetailRow label="총 근무시간" value={`${workHours.toFixed(1)} h`} />
          <DetailRow label="근무 공제 전 총액" value={`${baseWage.toLocaleString()}원`} />
          <DetailRow label="사업소득세 3% 참고" value={`-${s.reference_business_income_tax.toLocaleString()}원`} />
          <DetailRow label="지방소득세 0.3% 참고" value={`-${s.reference_local_income_tax.toLocaleString()}원`} />
          <DetailRow label="3.3% 적용 시 참고 공제" value={`-${s.reference_deduction_total.toLocaleString()}원`} />
          <DetailRow label="공제 후 근무 참고액" value={`${s.reference_net_work_amount.toLocaleString()}원`} />
          <DetailRow label="승인 선결제 환급" value={`+${allowance.toLocaleString()}원`} />
          <div className={styles.netRow}>
            <span className={styles.netLabel}>최종 이체 참고액</span>
            <span className={styles.netValue}>{s.reference_transfer_amount.toLocaleString()}원</span>
          </div>
          <p className={styles.kpiSub}>
            3.3% 적용을 자동 판정한 값이 아닙니다. 실제 공제 적용 여부와 지급액은 계약 형태와 세무 내역을 확인해 확정하세요. 공제 전 정산 합계는 {settlementTotal.toLocaleString()}원입니다.
          </p>
        </div>
      </details>
    </div>
  );
}
