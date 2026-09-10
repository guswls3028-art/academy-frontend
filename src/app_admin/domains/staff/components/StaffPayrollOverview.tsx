import { useQuery } from "@tanstack/react-query";
import { useState, type CSSProperties } from "react";
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
  const issues: string[] = [];
  if (row.open_work_record_count) issues.push(`진행 중 근무 ${row.open_work_record_count}건`);
  if (row.incomplete_work_record_count) issues.push(`계산 미완료 ${row.incomplete_work_record_count}건`);
  if (row.duplicate_work_record_count) issues.push(`중복 의심 ${row.duplicate_work_record_count}건`);
  if (row.abnormal_long_work_record_count) issues.push(`12시간 이상 ${row.abnormal_long_work_record_count}건`);
  if (row.manually_edited_work_record_count) issues.push(`관리자 수정 ${row.manually_edited_work_record_count}건`);
  if (row.pending_expense_count) issues.push(`비용 대기 ${row.pending_expense_count}건`);
  if (row.is_active && row.assigned_work_type_count === 0) issues.push("시급태그 없음");
  if (row.pay_type === "MONTHLY") issues.push("월급 수동 확인");
  if (row.settlement_status === "RECONCILIATION_REQUIRED") issues.push("마감·스냅샷 불일치");
  return issues;
}

export function StaffPayrollOverview({ year, month }: Props) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [reviewOnly, setReviewOnly] = useState(false);
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
  const visibleRows = reviewOnly
    ? rows.filter((row) => row.advisory_issue_count > 0 || row.settlement_status === "NEEDS_REVIEW" || row.settlement_status === "RECONCILIATION_REQUIRED")
    : rows;

  return (
    <div className={styles.root} data-testid="staff-payroll-overview">
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>전체 현황</span>
          <h2>{year}년 {month}월 급여판</h2>
          <p>직원을 고르기 전에 근무·비용·마감 상태를 한 번에 확인합니다.</p>
        </div>
        <div className={styles.monthControl} aria-label="급여 현황 월 선택">
          <Button intent="ghost" size="sm" leftIcon={<ChevronLeft size={16} />} aria-label="이전 달" onClick={() => goMonth(-1)}>
            이전
          </Button>
          <strong>{year}.{String(month).padStart(2, "0")}</strong>
          <Button intent="ghost" size="sm" rightIcon={<ChevronRight size={16} />} aria-label="다음 달" onClick={() => goMonth(1)}>
            다음
          </Button>
        </div>
      </header>

      <section className={styles.ledgerSummary} aria-label="월 급여 합계">
        <div className={styles.totalCard}>
          <span>근무 공제 전 총액</span>
          <strong>{totals.work_amount.toLocaleString()}<small>원</small></strong>
          <p>기록된 유급 분과 적용 시급으로 계산한 근무액입니다.</p>
        </div>
        <div className={styles.metricRail}>
          <Metric label="총 근무시간" value={`${totals.work_hours.toFixed(1)}h`} />
          <Metric label="승인 환급비" value={`${totals.approved_expense_amount.toLocaleString()}원`} sub={`대상 ${totals.staff_count}명 · 마감 ${totals.closed_count}명`} />
          <Metric
            label="지급 전 확인"
            value={`${totals.advisory_issue_count}건`}
            sub={totals.pending_expense_amount ? `대기 비용 ${totals.pending_expense_amount.toLocaleString()}원` : "대기 비용 없음"}
            warning={totals.advisory_issue_count > 0 || totals.needs_review_count > 0}
          />
        </div>
      </section>

      {totals.work_type_breakdown.length > 0 && (
        <section className={styles.workTypeStrip} aria-label="근무유형별 시간">
          <strong>근무유형별</strong>
          <div>
            {totals.work_type_breakdown.map((item) => (
              <span key={item.work_type_id} style={{ "--work-color": item.color } as CSSProperties}>
                {item.work_type_name} <b>{item.work_hours.toFixed(1)}h</b>
              </span>
            ))}
          </div>
        </section>
      )}

      <section className={styles.waterfall} aria-label="3.3% 적용 시 참고 정산">
        <WaterfallStep label="근무 공제 전" value={totals.work_amount} />
        <WaterfallStep label="3.3% 참고 공제" value={-totals.reference_deduction_total} sub={`사업소득세 ${totals.reference_business_income_tax.toLocaleString()}원 + 지방소득세 ${totals.reference_local_income_tax.toLocaleString()}원`} />
        <WaterfallStep label="공제 후 근무 참고" value={totals.reference_net_work_amount} />
        <WaterfallStep label="승인 환급비" value={totals.approved_expense_amount} prefix="+" />
        <WaterfallStep label="최종 이체 참고액" value={totals.reference_transfer_amount} accent />
        <p><strong>3.3% 적용 시 참고</strong> 비교값입니다. 실제 공제 적용 여부와 지급액은 계약·세무 확인 후 확정하세요.</p>
      </section>

      {(totals.needs_review_count > 0 || totals.advisory_issue_count > 0) && (
        <div className={styles.attention} role="status">
          <AlertTriangle size={17} aria-hidden />
          <span><strong>지급 전 확인</strong> 중복·장시간·미퇴근·관리자 수정 이력을 먼저 살펴보세요. 경고는 기록을 숨기거나 수정을 막지 않습니다.</span>
          <Button intent={reviewOnly ? "primary" : "secondary"} size="sm" onClick={() => setReviewOnly((value) => !value)}>
            {reviewOnly ? "전체 직원 보기" : "확인 항목만 보기"}
          </Button>
        </div>
      )}

      {visibleRows.length === 0 ? (
        <EmptyState scope="panel" title="표시할 직원이 없습니다" description="재직 직원이나 이달 근무·비용 기록이 없습니다." />
      ) : (
        <>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>직원</th>
                  <th>근무 유형</th>
                  <th>근무시간</th>
                  <th>근무 공제 전</th>
                  <th>승인 환급</th>
                  <th>최종 이체 참고</th>
                  <th>정산 상태</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => {
                  const issues = rowIssues(row);
                  return (
                    <tr key={row.staff_id} data-status={row.settlement_status}>
                      <td>
                        <button type="button" className={styles.staffLink} onClick={() => openStaff(row.staff_id)}>
                          <strong>{row.name}</strong>
                          <span>{staffPositionLabel(row.position)} · {staffAccountRoleLabel(row.account_role)} · {row.is_active ? "재직" : "퇴사"}</span>
                        </button>
                      </td>
                      <td>
                        <div className={styles.rowTypes}>
                          {row.work_type_breakdown.map((item) => (
                            <span key={item.work_type_id} style={{ "--work-color": item.color } as CSSProperties}>{item.work_type_name} {item.work_hours.toFixed(1)}h</span>
                          ))}
                        </div>
                      </td>
                      <td className={styles.number}>{row.work_hours.toFixed(1)}h</td>
                      <td className={styles.number}>{row.work_amount.toLocaleString()}원</td>
                      <td className={styles.number}>
                        {row.approved_expense_amount.toLocaleString()}원
                        {row.pending_expense_count > 0 && <span className={styles.pending}>대기 {row.pending_expense_amount.toLocaleString()}원</span>}
                      </td>
                      <td className={`${styles.number} ${styles.total}`}>{row.reference_transfer_amount.toLocaleString()}원<span className={styles.subtle}>3.3% 적용 시 참고</span></td>
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
            {visibleRows.map((row) => {
              const issues = rowIssues(row);
              return (
                <button key={row.staff_id} type="button" className={styles.mobileCard} onClick={() => openStaff(row.staff_id)}>
                  <span className={styles.mobileIdentity}>
                    <span><strong>{row.name}</strong><small>{staffPositionLabel(row.position)} · {staffAccountRoleLabel(row.account_role)}</small></span>
                    <Badge variant="solid" tone={statusTone(row.settlement_status)}>{STATUS_LABEL[row.settlement_status]}</Badge>
                  </span>
                  <span className={styles.mobileNumbers}>
                    <span><small>근무 · 공제 전</small>{row.work_hours.toFixed(1)}h · {row.work_amount.toLocaleString()}원</span>
                    <span><small>최종 이체 참고</small>{row.reference_transfer_amount.toLocaleString()}원</span>
                  </span>
                  <span className={styles.rowTypes}>{row.work_type_breakdown.map((item) => <span key={item.work_type_id} style={{ "--work-color": item.color } as CSSProperties}>{item.work_type_name} {item.work_hours.toFixed(1)}h</span>)}</span>
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

function WaterfallStep({ label, value, sub, prefix, accent = false }: { label: string; value: number; sub?: string; prefix?: string; accent?: boolean }) {
  return (
    <div className={styles.waterfallStep} data-accent={accent ? "true" : undefined}>
      <span>{label}</span>
      <strong>{prefix}{value.toLocaleString()}원</strong>
      {sub && <small>{sub}</small>}
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
