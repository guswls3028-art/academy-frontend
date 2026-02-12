// PATH: src/features/profile/expense/components/ExpenseHeader.tsx
import { Button, Panel } from "@/shared/ui/ds";
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
    <Panel variant="subtle">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <div
            style={{
              fontSize: "var(--text-sm)",
              fontWeight: "var(--font-title)",
              color: "var(--color-text-primary)",
            }}
          >
            기간 선택
          </div>
          <Button
            type="button"
            intent="secondary"
            size="sm"
            onClick={() => resetRangeToMonth()}
          >
            전체
          </Button>

          <input
            type="month"
            value={monthValue}
            onChange={(e) => resetRangeToMonth(e.target.value)}
            className="ds-input"
            style={{ width: 160 }}
          />
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            intent="secondary"
            size="sm"
            onClick={() =>
              downloadExpenseExcel({ month: monthValue, rows: rowsForExcel })
            }
            className="inline-flex items-center gap-2"
          >
            <FiDownload size={14} />
            Excel
          </Button>

          <Button
            type="button"
            intent="primary"
            size="sm"
            onClick={onCreate}
            className="inline-flex items-center gap-2"
          >
            <FiPlus size={14} />
            지출 등록
          </Button>
        </div>
      </div>
    </Panel>
  );
}
