// PATH: src/features/profile/expense/components/ExpenseHeader.tsx
import { Panel } from "@/shared/ui/ds";
import { Expense } from "../../api/profile.api";
import { downloadExpenseExcel } from "../../excel/expenseExcel";
import { FiPlus, FiDownload } from "react-icons/fi";

export default function ExpenseHeader({
  range,
  setRangeFrom,
  setRangeTo,
  resetRangeToMonth,
  rowsForExcel,
  onCreate,
}: {
  range: { from: string; to: string };
  setRangeFrom: (v: string) => void;
  setRangeTo: (v: string) => void;
  resetRangeToMonth: (m?: string) => void;
  rowsForExcel: Expense[];
  onCreate: () => void;
}) {
  const monthValue =
    range.from?.slice(0, 7) || new Date().toISOString().slice(0, 7);

  return (
    <Panel>
      <div className="panel-body flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-wrap items-end gap-4">
          <button
            onClick={() => resetRangeToMonth()}
            className="h-[38px] px-4 rounded-lg border border-[var(--border-divider)] bg-[var(--bg-surface-soft)] text-sm font-semibold"
          >
            전체
          </button>

          <input
            type="month"
            value={monthValue}
            onChange={(e) => resetRangeToMonth(e.target.value)}
            className="h-[38px] w-[150px] rounded-lg border border-[var(--border-divider)] bg-[var(--bg-surface)] px-3 text-sm"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() =>
              downloadExpenseExcel({ month: monthValue, rows: rowsForExcel })
            }
            className="inline-flex items-center gap-2 h-[38px] px-4 rounded-lg border border-[var(--border-divider)] bg-[var(--bg-surface)] text-sm font-semibold"
          >
            <FiDownload size={14} />
            Excel
          </button>

          <button
            onClick={onCreate}
            className="inline-flex items-center gap-2 h-[38px] px-4 rounded-lg border border-[var(--color-primary)] bg-[var(--color-primary)] text-sm font-semibold text-white"
          >
            <FiPlus size={14} />
            지출 등록
          </button>
        </div>
      </div>
    </Panel>
  );
}
