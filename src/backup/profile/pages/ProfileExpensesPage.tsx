// PATH: src/features/profile/pages/ProfileExpensesPage.tsx
import { useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";

import { PageSection } from "@/shared/ui/page";
import { EmptyState } from "@/shared/ui/feedback";

import ExpenseFormModal from "../components/ExpenseFormModal";
import ExpenseSummaryCard from "../components/ExpenseSummaryCard";
import MemoCell from "../components/MemoCell";

import { useCreateExpense, useDeleteExpense, useMyExpenses } from "../hooks/useProfile";
import { Expense } from "../api/profile";
import { ProfileOutletContext } from "../layout/ProfileLayout";
import { downloadExpenseExcel } from "../excel/expenseExcel";

export default function ProfileExpensesPage() {
  const { month, setMonth } = useOutletContext<ProfileOutletContext>();

  const { data = [], isLoading } = useMyExpenses(month);
  const rows = useMemo(() => data ?? [], [data]);

  const createMut = useCreateExpense(month);
  const deleteMut = useDeleteExpense(month);

  const [open, setOpen] = useState(false);

  const submit = async (form: {
    date: string;
    title: string;
    amount: number;
    memo: string;
  }) => {
    await createMut.mutateAsync({
      ...form,
      memo: form.memo?.trim() ? form.memo : undefined,
    });
  };

  const remove = async (row: Expense) => {
    if (!confirm("해당 지출을 삭제하시겠습니까?")) return;
    await deleteMut.mutateAsync(row.id);
  };

  return (
    <>
      <div className="mb-4 flex items-center gap-3">
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="form-input w-[160px]"
        />
        <button onClick={() => downloadExpenseExcel({ month, rows })} className="btn-secondary">
          📊 Excel 다운로드
        </button>
      </div>

      <PageSection title="지출 요약">
        <ExpenseSummaryCard rows={rows} />
      </PageSection>

      <PageSection
        title="지출 내역"
        right={
          <button onClick={() => setOpen(true)} className="btn-primary text-sm">
            + 지출 등록
          </button>
        }
      >
        {isLoading && <div className="text-sm text-muted">불러오는 중...</div>}

        {!isLoading && rows.length === 0 && (
          <EmptyState title="지출 없음" message="선택한 월에 등록된 지출이 없습니다." />
        )}

        {!!rows.length && (
          <div className="overflow-hidden rounded-lg border border-[var(--border-divider)]">
            <table className="table">
              <thead>
                <tr>
                  <th>날짜</th>
                  <th>항목</th>
                  <th className="text-right">금액</th>
                  <th>메모</th>
                  <th className="text-right">관리</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>{r.date}</td>
                    <td>{r.title}</td>
                    <td className="text-right">{r.amount.toLocaleString()}원</td>
                    <td><MemoCell value={r.memo} /></td>
                    <td className="text-right">
                      <button
                        className="btn-secondary text-xs text-[var(--color-danger)]"
                        onClick={() => remove(r)}
                      >
                        삭제
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </PageSection>

      <ExpenseFormModal
        open={open}
        onClose={() => setOpen(false)}
        onSubmit={submit}
        submitting={createMut.isPending}
      />
    </>
  );
}
