// PATH: src/app_admin/domains/profile/expense/pages/ProfileExpensePage.tsx
import { useOutletContext } from "react-router";
import { Button, EmptyState, Section } from "@/shared/ui/ds";
import { ProfileOutletContext } from "../../ProfileLayout";

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
    resetRangeToMonth,
  } = useOutletContext<ProfileOutletContext>();

  const domain = useExpenseDomain(month, range);
  const analytics = useExpenseAnalytics(domain.rows);

  return (
    <>
      <div className="flex flex-col gap-[var(--space-6)]">
        <ExpenseHeader
          range={range}
          resetRangeToMonth={resetRangeToMonth}
          rowsForExcel={domain.allRows}
          onCreate={domain.openCreate}
        />

        <Section>
          <div className="grid grid-cols-1 gap-[var(--space-6)] lg:grid-cols-2">
            <ExpenseSummaryCard
              total={domain.total}
              count={domain.rows.length}
            />
            <ExpenseChartCard data={analytics.daily} />
          </div>
        </Section>

        <Section>
          {domain.isError ? (
            <EmptyState
              tone="error"
              title="지출 내역을 불러올 수 없습니다"
              description="연결 상태를 확인한 뒤 다시 시도해 주세요."
              actions={
                <Button intent="secondary" size="sm" onClick={() => void domain.refetch()}>
                  다시 시도
                </Button>
              }
            />
          ) : domain.isLoading ? (
            <EmptyState tone="loading" title="지출 내역을 불러오는 중…" />
          ) : domain.rows.length === 0 ? (
            <EmptyState
              title="지출 내역 없음"
              description="선택한 기간에 지출이 없습니다."
              actions={
                <Button
                  intent="primary"
                  size="md"
                  onClick={domain.openCreate}
                  className="mt-4"
                >
                  + 지출 등록
                </Button>
              }
            />
          ) : (
            <ExpenseTable
              rows={domain.rows}
              onEdit={domain.openEdit}
              onDelete={domain.remove}
              deletingId={domain.deletingId}
            />
          )}
        </Section>
      </div>

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
