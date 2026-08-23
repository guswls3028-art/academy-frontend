import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router";

import { Badge, Button, EmptyState } from "@/shared/ui/ds";
import {
  fetchStaffPayrollOverview,
  type PayrollOverviewStatus,
  type StaffPayrollOverviewRow,
} from "../api/staff.api";
import { staffQueryKeys } from "../queryKeys";
import {
  staffAccountRoleLabel,
  staffPositionLabel,
} from "../utils/staffIdentity";
import styles from "./StaffPayrollOverview.module.css";

type Props = {
  year: number;
  month: number;
};

const STATUS_LABEL: Record<PayrollOverviewStatus, string> = {
  OPEN: "정산 중",
  NEEDS_REVIEW: "확인 필요",
  CLOSED: "마감",
  RECONCILIATION_REQUIRED: "대사 필요",
};

function statusTone(status: PayrollOverviewStatus) {
  if (status === "CLOSED") return "success" as const;
  if (status === "OPEN") return "neutral" as const;
  return "warning" as const;
}

function rowIssues(row: StaffPayrollOverviewRow) {
  if (row.settlement_status === "CLOSED") return [];
  const issues: string[] = [];
  if (row.open_work_record_count) issues.push(`진행 중 근무 ${row.open_work_record_count}건`);
  if (row.incomplete_work_record_count) issues.push(`계산 미완료 ${row.incomplete_work_record_count}건`);
  if (row.pending_expense_count) issues.push(`비용 대기 ${row.pending_expense_count}건`);
  if (row.is_active && row.assigned_work_type_count === 0) issues.push("시급태그 없음");
  if (row.pay_type === "MONTHLY") issues.push("월급 수동 확인");
  if (row.settlement_status === "RECONCILIATION_REQUIRED") issues.push("마감·스냅샷 불일치");
  return issues;
}

export function StaffPayrollOverview({ year, month }: Props) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const overviewQ = useQuery({
    queryKey: staffQueryKeys.payrollOverview(year, month),
    queryFn: () => fetchStaffPayrollOverview(year, month),
  });

  const goMonth = (delta: number) => {
    const nextDate = new Date(year, month - 1 + delta);
    const next = new URLSearchParams(searchParams);
    next.delete("staffId");
    next.set("year", String(nextDate.getFullYear()));
    next.set("month", String(nextDate.getMonth() + 1));
    setSearchParams(next);
  };

  const openStaff = (staffId: number) => {
    navigate(
      `/workspace/staff/attendance?staffId=${staffId}&year=${year}&month=${month}`,
    );
  };

  if (overviewQ.isError) {
    return (
      <EmptyState
        scope="panel"
        tone="error"
        title="전체 급여 현황을 불러올 수 없습니다"
        actions={
          <Button intent="secondary" size="sm" onClick={() => overviewQ.refetch()}>
            다시 시도
          </Button>
        }
      />
    );
  }
  if (overviewQ.isLoading || !overviewQ.data) {
    return <EmptyState scope="panel" tone="loading" title="전체 급여 현황을 계산하는 중…" />;
  }

  const { totals, rows } = overviewQ.data;

  return (
    <div className={styles.root} data-testid="staff-payroll-overview">
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>전체 현황</span>
          <h2>{year}년 {month}월 급여판</h2>
          <p>직원을 고르기 전에 근무·비용·마감 상태를 한 번에 확인합니다.</p>
        </div>
        <div className={styles.monthControl} aria-label="급여 현황 월 선택">
          <Button intent="ghost" size="sm" iconOnly aria-label="이전 달" onClick={() => goMonth(-1)}>
            <ChevronLeft size={18} />
          </Button>
          <strong>{year}.{String(month).padStart(2, "0")}</strong>
          <Button intent="ghost" size="sm" iconOnly aria-label="다음 달" onClick={() => goMonth(1)}>
            <ChevronRight size={18} />
          </Button>
        </div>
      </header>

      <section className={styles.ledgerSummary} aria-label="월 급여 합계">
        <div className={styles.totalCard}>
          <span>정산 합계(공제 전)</span>
          <strong>{totals.total_amount.toLocaleString()}<small>원</small></strong>
          <p>근무기록 {totals.work_amount.toLocaleString()}원 + 승인 선결제 환급 {totals.approved_expense_amount.toLocaleString()}원</p>
        </div>
        <div className={styles.metricRail}>
          <Metric label="총 근무시간" value={`${totals.work_hours.toFixed(1)}h`} />
          <Metric label="대상 직원" value={`${totals.staff_count}명`} sub={`마감 ${totals.closed_count}명`} />
          <Metric
            label="확인 필요"
            value={`${totals.needs_review_count}명`}
            sub={totals.pending_expense_amount ? `대기 비용 ${totals.pending_expense_amount.toLocaleString()}원` : "대기 비용 없음"}
            warning={totals.needs_review_count > 0}
          />
        </div>
      </section>

      {totals.needs_review_count > 0 && (
        <div className={styles.attention} role="status">
          <AlertTriangle size={17} aria-hidden />
          <span><strong>{totals.needs_review_count}명</strong>에게 월마감 전 확인할 항목이 있습니다. 아래 행의 사유를 먼저 처리하세요.</span>
        </div>
      )}

      {rows.length === 0 ? (
        <EmptyState scope="panel" title="표시할 직원이 없습니다" description="재직 직원이나 이달 근무·비용 기록이 없습니다." />
      ) : (
        <>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>직원</th>
                  <th>직위·계정</th>
                  <th>근무시간</th>
                  <th>근무기록 금액</th>
                  <th>선결제 환급</th>
                  <th>공제 전 합계</th>
                  <th>정산 상태</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const issues = rowIssues(row);
                  return (
                    <tr key={row.staff_id} data-status={row.settlement_status}>
                      <td>
                        <button type="button" className={styles.staffLink} onClick={() => openStaff(row.staff_id)}>
                          <strong>{row.name}</strong>
                          <span>{row.is_active ? "재직" : "퇴사"}</span>
                        </button>
                      </td>
                      <td>
                        <strong className={styles.identity}>{staffPositionLabel(row.position)}</strong>
                        <span className={styles.subtle}>{staffAccountRoleLabel(row.account_role)}</span>
                      </td>
                      <td className={styles.number}>{row.work_hours.toFixed(1)}h</td>
                      <td className={styles.number}>{row.work_amount.toLocaleString()}원</td>
                      <td className={styles.number}>
                        {row.approved_expense_amount.toLocaleString()}원
                        {row.pending_expense_count > 0 && <span className={styles.pending}>대기 {row.pending_expense_amount.toLocaleString()}원</span>}
                      </td>
                      <td className={`${styles.number} ${styles.total}`}>{row.total_amount.toLocaleString()}원</td>
                      <td>
                        <Badge variant="solid" tone={statusTone(row.settlement_status)}>{STATUS_LABEL[row.settlement_status]}</Badge>
                        {issues.length > 0 && <span className={styles.issueText}>{issues.join(" · ")}</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className={styles.mobileList}>
            {rows.map((row) => {
              const issues = rowIssues(row);
              return (
                <button key={row.staff_id} type="button" className={styles.mobileCard} onClick={() => openStaff(row.staff_id)}>
                  <span className={styles.mobileIdentity}>
                    <span><strong>{row.name}</strong><small>{staffPositionLabel(row.position)} · {staffAccountRoleLabel(row.account_role)}</small></span>
                    <Badge variant="solid" tone={statusTone(row.settlement_status)}>{STATUS_LABEL[row.settlement_status]}</Badge>
                  </span>
                  <span className={styles.mobileNumbers}>
                    <span><small>근무</small>{row.work_hours.toFixed(1)}h</span>
                    <span><small>공제 전 합계</small>{row.total_amount.toLocaleString()}원</span>
                  </span>
                  {issues.length > 0 && <span className={styles.issueText}>{issues.join(" · ")}</span>}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  sub,
  warning = false,
}: {
  label: string;
  value: string;
  sub?: string;
  warning?: boolean;
}) {
  return (
    <div className={styles.metric} data-warning={warning ? "true" : "false"}>
      <span>{label}</span>
      <strong>{value}</strong>
      {sub && <small>{sub}</small>}
    </div>
  );
}
