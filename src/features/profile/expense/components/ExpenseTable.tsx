// PATH: src/features/profile/expense/components/ExpenseTable.tsx
import { Expense } from "../../api/profile.api";
import { FiEdit2, FiTrash2 } from "react-icons/fi";
import { Panel } from "@/shared/ui/ds";

/**
 * 메모도 1fr 금지 → minmax로 제한
 */
const GRID =
  "grid grid-cols-[110px_140px_minmax(160px,240px)_110px_72px] items-center gap-3";

export default function ExpenseTable({
  rows,
  onEdit,
  onDelete,
}: {
  rows: Expense[];
  onEdit: (r: Expense) => void;
  onDelete: (r: Expense) => void;
}) {
  return (
    <Panel>
      {/* ===== Header ===== */}
      <div
        className={`${GRID} px-4 py-2 bg-[var(--bg-surface-soft)] text-xs font-medium text-[var(--text-muted)]`}
      >
        <div>날짜</div>
        <div>항목</div>
        <div>메모</div>
        <div>금액</div>
        <div className="text-center">관리</div>
      </div>

      {/* ===== Rows ===== */}
      {rows.map((r) => (
        <div
          key={r.id}
          className={`${GRID} px-4 py-2 border-t border-[var(--border-divider)] hover:bg-[var(--bg-surface-soft)]`}
        >
          {/* 날짜 */}
          <div className="text-sm font-medium">{r.date}</div>

          {/* 항목 */}
          <div className="text-sm font-medium">{r.title}</div>

          {/* 메모 */}
          <div className="text-sm text-[var(--text-muted)] truncate">
            {r.memo || "-"}
          </div>

          {/* 금액 */}
          <div className="text-sm font-semibold">
            {r.amount.toLocaleString()}원
          </div>

          {/* 관리 */}
          <div className="flex justify-end gap-1">
            <button
              className="action-btn"
              onClick={() => onEdit(r)}
              title="수정"
            >
              <FiEdit2 size={14} />
            </button>
            <button
              className="action-btn danger"
              onClick={() => onDelete(r)}
              title="삭제"
            >
              <FiTrash2 size={14} />
            </button>
          </div>
        </div>
      ))}

      <style>{`
        .action-btn{
          width: 28px;
          height: 28px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 8px;
          border: 1px solid var(--border-divider);
          background: var(--bg-surface);
          color: var(--text-muted);
        }
        .action-btn:hover{
          background: var(--bg-surface-soft);
          color: var(--text-primary);
        }
        .action-btn.danger{
          border-color: rgba(239,68,68,0.4);
          color: rgb(185,28,28);
          background: rgba(239,68,68,0.08);
        }
      `}</style>
    </Panel>
  );
}
