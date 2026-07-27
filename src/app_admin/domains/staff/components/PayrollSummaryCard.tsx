// PATH: src/app_admin/domains/staff/components/PayrollSummaryCard.tsx
// 정산 KPI 배너 — 서버 집계값만 표시하며 세금·보험 공제는 계산하지 않는다.

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
  const settlementTotal = Number(s.total_amount) || baseWage + allowance;

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
          label="정산 합계(공제 전)"
          value={`${settlementTotal.toLocaleString()}원`}
          sub={allowance > 0 ? `승인 선결제 환급 ${allowance.toLocaleString()}원 포함` : "승인 선결제 환급 없음"}
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
          <DetailRow label="근무기록 금액" value={`${baseWage.toLocaleString()}원`} />
          <DetailRow label="승인 선결제 환급" value={`${allowance.toLocaleString()}원`} />
          <div className={styles.netRow}>
            <span className={styles.netLabel}>정산 합계(공제 전)</span>
            <span className={styles.netValue}>{settlementTotal.toLocaleString()}원</span>
          </div>
          <p className={styles.kpiSub}>
            세금·4대보험·기타 공제는 반영하지 않습니다. 실제 지급액은 계약 형태와 공제 내역을 확인해 확정하세요.
          </p>
        </div>
      </details>
    </div>
  );
}
