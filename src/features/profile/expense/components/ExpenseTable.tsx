// PATH: src/features/profile/expense/components/ExpenseTable.tsx
import { useState, useMemo } from "react";
import { Expense } from "../../api/profile.api";
import { FiEdit2, FiTrash2 } from "react-icons/fi";
import { Button } from "@/shared/ui/ds";
import { DomainTable, TABLE_COL } from "@/shared/ui/domain";

export default function ExpenseTable({
  rows,
  onEdit,
  onDelete,
}: {
  rows: Expense[];
  onEdit: (r: Expense) => void;
  onDelete: (r: Expense) => void;
}) {
  const tableWidth =
    TABLE_COL.checkbox +
    TABLE_COL.medium +
    TABLE_COL.subject +
    TABLE_COL.memo +
    TABLE_COL.medium +
    TABLE_COL.actions;
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const allIds = useMemo(() => rows.map((r) => r.id), [rows]);
  const allSelected = rows.length > 0 && allIds.every((id) => selectedSet.has(id));

  const toggleSelect = (id: number) => {
    if (selectedSet.has(id)) setSelectedIds((prev) => prev.filter((x) => x !== id));
    else setSelectedIds((prev) => [...prev, id]);
  };
  const toggleSelectAll = () => {
    if (allSelected) setSelectedIds((prev) => prev.filter((id) => !allIds.includes(id)));
    else setSelectedIds((prev) => [...new Set([...prev, ...allIds])]);
  };

  return (
    <DomainTable
      tableClassName="ds-table--flat"
      tableStyle={{ tableLayout: "fixed", width: tableWidth }}
    >
      <colgroup>
        <col style={{ width: TABLE_COL.checkbox }} />
        <col style={{ width: TABLE_COL.medium }} />
        <col style={{ width: TABLE_COL.subject }} />
        <col style={{ width: TABLE_COL.memo }} />
        <col style={{ width: TABLE_COL.medium }} />
        <col style={{ width: TABLE_COL.actions }} />
      </colgroup>
      <thead>
        <tr
          style={{
            background: "color-mix(in srgb, var(--color-primary) 4%, transparent)",
          }}
        >
          <th
            style={{
              padding: "var(--space-3) var(--space-4)",
              width: TABLE_COL.checkbox,
              textAlign: "center",
            }}
          >
            <input
              type="checkbox"
              checked={allSelected}
              ref={(el) => {
                if (el) el.indeterminate = !allSelected && selectedSet.size > 0;
              }}
              onChange={toggleSelectAll}
              aria-label="전체 선택"
              className="cursor-pointer"
            />
          </th>
          <th
            style={{
              padding: "var(--space-3) var(--space-4)",
              fontSize: "var(--text-sm)",
              fontWeight: "var(--font-title)",
              color: "var(--color-text-secondary)",
              textAlign: "left",
            }}
          >
            날짜
          </th>
          <th
            style={{
              padding: "var(--space-3) var(--space-4)",
              fontSize: "var(--text-sm)",
              fontWeight: "var(--font-title)",
              color: "var(--color-text-secondary)",
              textAlign: "left",
            }}
          >
            항목
          </th>
          <th
            style={{
              padding: "var(--space-3) var(--space-4)",
              fontSize: "var(--text-sm)",
              fontWeight: "var(--font-title)",
              color: "var(--color-text-secondary)",
              textAlign: "left",
            }}
          >
            메모
          </th>
          <th
            style={{
              padding: "var(--space-3) var(--space-4)",
              fontSize: "var(--text-sm)",
              fontWeight: "var(--font-title)",
              color: "var(--color-text-secondary)",
              textAlign: "right",
            }}
          >
            금액
          </th>
          <th
            style={{
              padding: "var(--space-3) var(--space-4)",
              fontSize: "var(--text-sm)",
              fontWeight: "var(--font-title)",
              color: "var(--color-text-secondary)",
              textAlign: "center",
            }}
          >
            관리
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr
            key={r.id}
            className="transition-colors"
            style={{
              borderTop: "1px solid color-mix(in srgb, var(--color-border-divider) 35%, transparent)",
            }}
          >
            <td style={{ padding: "var(--space-3) var(--space-4)", textAlign: "center", verticalAlign: "middle" }}>
              <input
                type="checkbox"
                checked={selectedSet.has(r.id)}
                onChange={() => toggleSelect(r.id)}
                aria-label={`${r.title} 선택`}
                className="cursor-pointer"
              />
            </td>
            {/* 날짜 */}
            <td
              style={{
                padding: "var(--space-3) var(--space-4)",
                fontSize: "var(--text-sm)",
                fontWeight: 600,
                color: "var(--color-text-primary)",
              }}
            >
              {r.date}
            </td>

            {/* 항목 */}
            <td
              style={{
                padding: "var(--space-3) var(--space-4)",
                fontSize: "var(--text-sm)",
                fontWeight: 600,
                color: "var(--color-text-primary)",
              }}
            >
              {r.title}
            </td>

            {/* 메모 */}
            <td
              style={{
                padding: "var(--space-3) var(--space-4)",
                fontSize: "var(--text-sm)",
                color: "var(--color-text-secondary)",
                maxWidth: 300,
              }}
              className="truncate"
              title={r.memo || undefined}
            >
              {r.memo || "-"}
            </td>

            {/* 금액 */}
            <td
              style={{
                padding: "var(--space-3) var(--space-4)",
                fontSize: "var(--text-sm)",
                fontWeight: "var(--font-title)",
                color: "var(--color-text-primary)",
                textAlign: "right",
              }}
            >
              {r.amount.toLocaleString()}원
            </td>

            {/* 관리 */}
            <td
              style={{
                padding: "var(--space-3) var(--space-4)",
                textAlign: "center",
              }}
            >
              <div className="flex justify-center gap-1">
                <Button
                  type="button"
                  intent="ghost"
                  size="sm"
                  onClick={() => onEdit(r)}
                  title="수정"
                  className="!min-w-0 !w-8 !h-8 !p-0"
                >
                  <FiEdit2 size={14} />
                </Button>
                <Button
                  type="button"
                  intent="danger"
                  size="sm"
                  onClick={() => onDelete(r)}
                  title="삭제"
                  className="!min-w-0 !w-8 !h-8 !p-0"
                >
                  <FiTrash2 size={14} />
                </Button>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </DomainTable>
  );
}
