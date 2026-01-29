// PATH: src/features/profile/expense/components/ExpenseHeader.tsx
import { PageToolbar } from "@/shared/ui/page";
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
    <PageToolbar>
      <div className="flex flex-wrap items-end justify-between gap-4">
        {/* ===== 왼쪽: 기간 ===== */}
        <div className="flex flex-wrap items-end gap-4">
          {/* 전체 */}
          <button
            onClick={() => resetRangeToMonth()}
            className="
              h-[38px] px-4
              rounded-lg
              border border-[var(--border-divider)]
              bg-[var(--bg-surface-soft)]
              text-sm font-semibold
              hover:bg-[var(--bg-surface)]
            "
          >
            전체
          </button>

          {/* 월 */}
          <div className="space-y-1">
            <div className="text-xs font-medium text-[var(--text-muted)]">
              월별 지출
            </div>
            <input
              type="month"
              value={monthValue}
              onChange={(e) => resetRangeToMonth(e.target.value)}
              className="
                h-[38px] w-[150px]
                rounded-lg
                border border-[var(--border-divider)]
                bg-[var(--bg-surface)]
                px-3
                text-sm
                outline-none
                focus:border-[var(--color-primary)]
              "
            />
          </div>

          {/* 기간 */}
          <div className="space-y-1">
            <div className="text-xs font-medium text-[var(--text-muted)]">
              기간별 지출
            </div>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={range.from}
                onChange={(e) => setRangeFrom(e.target.value)}
                className="
                  h-[38px] w-[150px]
                  rounded-lg
                  border border-[var(--border-divider)]
                  bg-[var(--bg-surface)]
                  px-3
                  text-sm
                  outline-none
                  focus:border-[var(--color-primary)]
                "
              />
              <span className="text-xs text-[var(--text-muted)]">~</span>
              <input
                type="date"
                value={range.to}
                onChange={(e) => setRangeTo(e.target.value)}
                className="
                  h-[38px] w-[150px]
                  rounded-lg
                  border border-[var(--border-divider)]
                  bg-[var(--bg-surface)]
                  px-3
                  text-sm
                  outline-none
                  focus:border-[var(--color-primary)]
                "
              />
            </div>
          </div>
        </div>

        {/* ===== 오른쪽: 액션 ===== */}
        <div className="flex items-center gap-2">
          <button
            onClick={() =>
              downloadExpenseExcel({
                month: monthValue,
                rows: rowsForExcel,
              })
            }
            className="
              inline-flex items-center gap-2
              h-[38px] px-4
              rounded-lg
              border border-[var(--border-divider)]
              bg-[var(--bg-surface)]
              text-sm font-semibold
              hover:bg-[var(--bg-surface-soft)]
            "
          >
            <FiDownload size={14} />
            Excel
          </button>

          <button
            onClick={onCreate}
            className="
              inline-flex items-center gap-2
              h-[38px] px-4
              rounded-lg
              border border-[var(--color-primary)]
              bg-[var(--color-primary)]
              text-sm font-semibold
              text-white
              hover:brightness-95
            "
          >
            <FiPlus size={14} />
            지출 등록
          </button>
        </div>
      </div>
    </PageToolbar>
  );
}
