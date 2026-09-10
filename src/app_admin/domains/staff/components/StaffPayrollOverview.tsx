import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, type CSSProperties } from "react";
import { AlertTriangle, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { useLocation, useNavigate, useSearchParams } from "react-router";

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

type PayrollFilter = "all" | "review" | "closed";

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
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const overviewQ = useQuery({
    queryKey: staffQueryKeys.payrollOverview(year, month),
    queryFn: () => fetchStaffPayrollOverview(year, month),
  });
  const reviewRows = overviewQ.data?.rows.filter(
    (row) =>
      row.advisory_issue_count > 0 ||
      row.settlement_status === "NEEDS_REVIEW" ||
      row.settlement_status === "RECONCILIATION_REQUIRED",
  ) ?? [];
  const filterParam = searchParams.get("payrollFilter");
  const filter: PayrollFilter = filterParam === "review" || filterParam === "closed"
    ? filterParam
    : "all";
  const search = searchParams.get("payrollSearch") ?? "";

  useEffect(() => {
    if (location.state?.focusPayrollOverview) {
      headingRef.current?.focus();
    }
  }, [location.state]);

  const goMonth = (delta: number) => {
    const nextDate = new Date(year, month - 1 + delta);
    const next = new URLSearchParams(searchParams);
    next.delete("staffId");
    next.set("year", String(nextDate.getFullYear()));
    next.set("month", String(nextDate.getMonth() + 1));
    setSearchParams(next);
  };

  const openStaff = (staffId: number) => {
    const next = new URLSearchParams(searchParams);
    next.set("staffId", String(staffId));
    next.set("year", String(year));
    next.set("month", String(month));
    navigate(`/workspace/staff/attendance?${next.toString()}`);
  };

  const setFilter = (nextFilter: PayrollFilter) => {
    const next = new URLSearchParams(searchParams);
    if (nextFilter === "all") next.delete("payrollFilter");
    else next.set("payrollFilter", nextFilter);
    setSearchParams(next, { replace: true });
  };

  const setSearch = (value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set("payrollSearch", value);
    else next.delete("payrollSearch");
    setSearchParams(next, { replace: true });
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
  const filterRows = filter === "review"
    ? reviewRows
    : filter === "closed"
      ? rows.filter((row) => row.settlement_status === "CLOSED")
      : rows;
  const normalizedSearch = search.trim().toLocaleLowerCase("ko-KR");
  const visibleRows = normalizedSearch
    ? filterRows.filter((row) => row.name.toLocaleLowerCase("ko-KR").includes(normalizedSearch))
    : filterRows;

  return (
    <div className={styles.root} data-testid="staff-payroll-overview">
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>전체 현황</span>
          <h2 ref={headingRef} tabIndex={-1}>{year}년 {month}월 급여판</h2>
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
        <div className={styles.headlineMetric} data-testid="payroll-headline-metric">
          <span>최종 이체 참고 총액</span>
          <strong>{totals.reference_transfer_amount.toLocaleString()}<small>원</small></strong>
          <p>대상 {totals.staff_count}명 · 마감 {totals.closed_count}명 · 근무 {totals.work_hours.toFixed(1)}h</p>
        </div>
        <div className={styles.headlineMetric} data-warning={reviewRows.length > 0 ? "true" : undefined} data-testid="payroll-headline-metric">
          <span>확인 필요 인원</span>
          <strong>{reviewRows.length}<small>명</small></strong>
          <p>마감 차단 {totals.needs_review_count}명 · 기록 점검 {totals.advisory_issue_count}건 · {totals.pending_expense_amount ? `비용 대기 ${totals.pending_expense_amount.toLocaleString()}원` : "비용 대기 없음"}</p>
        </div>
      </section>

      {reviewRows.length > 0 && (
        <div className={styles.attention} role="status">
          <AlertTriangle size={17} aria-hidden />
          <span><strong>지급 전 확인</strong> 기록 이상·비용 대기·시급태그·월급·마감 대사를 확인하세요. 경고는 기록을 숨기거나 수정을 막지 않습니다.</span>
        </div>
      )}

      <section className={styles.toolbar} aria-label="급여 직원 찾기">
        <label className={styles.searchField}>
          <Search size={16} aria-hidden />
          <span className="sr-only">직원 이름 검색</span>
          <input
            type="search"
            aria-label="직원 이름 검색"
            placeholder="직원 이름 검색"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <div className={styles.segmented} role="group" aria-label="급여 직원 필터">
          <button type="button" aria-pressed={filter === "all"} onClick={() => setFilter("all")}>전체</button>
          <button type="button" aria-pressed={filter === "review"} onClick={() => setFilter("review")}>확인 필요</button>
          <button type="button" aria-pressed={filter === "closed"} onClick={() => setFilter("closed")}>마감</button>
        </div>
        <span className={styles.resultCount}>표시 {visibleRows.length}명</span>
      </section>

      {visibleRows.length === 0 ? (
        <EmptyState
          scope="panel"
          title="조건에 맞는 직원이 없습니다"
          description={search ? "검색어를 바꾸거나 전체 필터를 선택해 주세요." : "다른 상태 필터를 선택해 주세요."}
        />
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
                          {row.work_type_breakdown.map((item, index) => (
                            <span key={item.work_type_id ?? `unknown-${index}`} style={{ "--work-color": item.color ?? undefined } as CSSProperties}>{item.work_type_name ?? "근무유형 미지정"} {item.work_hours.toFixed(1)}h</span>
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
                <button key={row.staff_id} type="button" className={styles.mobileRow} onClick={() => openStaff(row.staff_id)}>
                  <span className={styles.mobileIdentity}>
                    <span>
                      <strong>{row.name}</strong>
                      <small>{staffPositionLabel(row.position)} · {staffAccountRoleLabel(row.account_role)} · {row.is_active ? "재직" : "퇴사"}</small>
                      {issues.length > 0 && <span className={styles.issueText}>{issues.join(" · ")}</span>}
                    </span>
                    <span className={styles.mobileAmount}>
                      <small>최종 이체 참고</small>
                      <strong>{row.reference_transfer_amount.toLocaleString()}원</strong>
                      <Badge variant="soft" tone={statusTone(row.settlement_status)}>{STATUS_LABEL[row.settlement_status]}</Badge>
                    </span>
                  </span>
                  <span className={styles.mobileWork}>
                    <span className={styles.rowTypes}>{row.work_type_breakdown.map((item, index) => <span key={item.work_type_id ?? `unknown-${index}`} style={{ "--work-color": item.color ?? undefined } as CSSProperties}>{item.work_type_name ?? "근무유형 미지정"} {item.work_hours.toFixed(1)}h</span>)}</span>
                    <strong>{row.work_hours.toFixed(1)}h</strong>
                  </span>
                  <span className={styles.mobileMeta}>
                    <span><small>공제 전</small><strong>{row.work_amount.toLocaleString()}원</strong></span>
                    <span>
                      <small>승인 환급</small><strong>{row.approved_expense_amount.toLocaleString()}원</strong>
                      {row.pending_expense_count > 0 && <em>대기 {row.pending_expense_amount.toLocaleString()}원</em>}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </>
      )}

      {totals.work_type_breakdown.length > 0 && (
        <section className={styles.workTypeStrip} aria-label="근무유형별 시간">
          <strong>근무유형별</strong>
          <div>
            {totals.work_type_breakdown.map((item, index) => (
              <span key={item.work_type_id ?? `unknown-${index}`} style={{ "--work-color": item.color ?? undefined } as CSSProperties}>
                {item.work_type_name ?? "근무유형 미지정"} <b>{item.work_hours.toFixed(1)}h</b>
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
