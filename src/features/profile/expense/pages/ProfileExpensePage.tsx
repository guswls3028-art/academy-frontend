// PATH: src/features/profile/expense/pages/ProfileExpensePage.tsx
import { useOutletContext } from "react-router-dom";
import { Section, EmptyState } from "@/shared/ui/ds";
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

  return (
    <>
      <ExpenseHeader
        range={range}
        setRangeFrom={setRangeFrom}
        setRangeTo={setRangeTo}
        resetRangeToMonth={resetRangeToMonth}
        rowsForExcel={domain.allRows}
        onCreate={domain.openCreate}
      />

      <Section>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ExpenseSummaryCard
            total={domain.total}
            count={domain.rows.length}
          />
          <ExpenseChartCard data={analytics.daily} />
        </div>
      </Section>

      <Section>
        {!domain.isLoading && domain.rows.length === 0 && (
          <EmptyState
            title="지출 내역 없음"
            description="선택한 기간에 지출이 없습니다."
            action={
              <button
                onClick={domain.openCreate}
                className="mt-4 h-[38px] px-4 rounded-lg border border-[var(--color-primary)] bg-[var(--color-primary)] text-sm font-semibold text-white"
              >
                + 지출 등록
              </button>
            }
          />
        )}

        {domain.rows.length > 0 && (
          <ExpenseTable
            rows={domain.rows}
            onEdit={domain.openEdit}
            onDelete={domain.remove}
          />
        )}
      </Section>

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
