// PATH: src/features/profile/expense/pages/ProfileExpensePage.tsx
import { useOutletContext } from "react-router-dom";
import { PageSection } from "@/shared/ui/page";
import { EmptyState } from "@/shared/ui/feedback";
import { ProfileOutletContext } from "../../layout/ProfileLayout";

import ExpenseHeader from "../components/ExpenseHeader";
import ExpenseSummaryCard from "../components/ExpenseSummaryCard";
import ExpenseChartCard from "../components/ExpenseChartCard";
import ExpenseTable from "../components/ExpenseTable";
import ExpenseFormModal from "../components/ExpenseFormModal";

import { useExpenseDomain } from "../hooks/useExpenseDomain";
import { useExpenseAnalytics } from "../hooks/useExpenseAnalytics";

export default function ProfileExpensePage() {
  const {
    month,
    range,
    setRangeFrom,
    setRangeTo,
    resetRangeToMonth,
  } = useOutletContext<ProfileOutletContext>();

  const domain = useExpenseDomain(month, range);
  const analytics = useExpenseAnalytics(domain.rows);

  const chartData = analytics.daily;

  const rangeLabel =
    range.from && range.to
      ? `${range.from} ~ ${range.to} 기준`
      : "선택한 기간 기준";

  return (
    <>
      {/* ===== 상단 기간 컨트롤 ===== */}
      <ExpenseHeader
        range={range}
        setRangeFrom={setRangeFrom}
        setRangeTo={setRangeTo}
        resetRangeToMonth={resetRangeToMonth}
        rowsForExcel={domain.allRows}
        onCreate={domain.openCreate}
      />

      {/* ===== 요약 + 그래프 ===== */}
      <PageSection>
        {/* ✅ 핵심: Profile 도메인 전체 좌측 정렬 강제 */}
        <div className="text-left">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* 요약 */}
            <div>
              <div className="flex items-baseline justify-between mb-2">
                <div className="text-sm font-semibold text-[var(--text-primary)]">
                  요약
                </div>
                <div className="text-xs text-[var(--text-muted)]">
                  {rangeLabel}
                </div>
              </div>

              <ExpenseSummaryCard
                total={domain.total}
                count={domain.rows.length}
              />
            </div>

            {/* 그래프 */}
            <div>
              <div className="flex items-baseline justify-between mb-2">
                <div className="text-sm font-semibold text-[var(--text-primary)]">
                  지출 분석
                </div>
                <div className="text-xs text-[var(--text-muted)]">
                  동일 기간 기준
                </div>
              </div>

              <ExpenseChartCard data={chartData} />
            </div>
          </div>
        </div>
      </PageSection>

      {/* ===== 기록 ===== */}
      <PageSection title={`지출 내역 (${range.from} ~ ${range.to})`}>
        {/* ✅ 핵심: 테이블 영역 좌측 정렬 강제 */}
        <div className="text-left">
          {domain.isLoading && (
            <div className="text-sm text-[var(--text-muted)]">
              불러오는 중...
            </div>
          )}

          {!domain.isLoading && domain.rows.length === 0 && (
            <EmptyState
              title="지출 내역 없음"
              message="선택한 기간에 지출이 없습니다."
              actionLabel="+ 지출 등록"
              onAction={domain.openCreate}
            />
          )}

          {domain.rows.length > 0 && (
            <ExpenseTable
              rows={domain.rows}
              onEdit={domain.openEdit}
              onDelete={domain.remove}
            />
          )}
        </div>
      </PageSection>

      {/* ===== 모달 ===== */}
      <ExpenseFormModal
        open={domain.open}
        initial={domain.editing}
        submitting={domain.submitting}
        onClose={domain.close}
        onSubmit={domain.submit}
      />
    </>
  );
}
