// PATH: src/features/profile/expense/components/ExpenseTable.tsx
import { useState, useMemo, useCallback } from "react";
import { Expense } from "../../api/profile.api";
import { FiEdit2, FiTrash2 } from "react-icons/fi";
import { Button } from "@/shared/ui/ds";
import { DomainTable, TABLE_COL, ResizableTh, useTableColumnPrefs } from "@/shared/ui/domain";
import type { TableColumnDef } from "@/shared/ui/domain";

const PROFILE_EXPENSE_COLUMN_DEFS: TableColumnDef[] = [
  { key: "date", label: "날짜", defaultWidth: TABLE_COL.medium, minWidth: 80 },
  { key: "title", label: "항목", defaultWidth: TABLE_COL.subject, minWidth: 80 },
  { key: "memo", label: "메모", defaultWidth: TABLE_COL.memo, minWidth: 100 },
  { key: "amount", label: "금액", defaultWidth: TABLE_COL.medium, minWidth: 90 },
  { key: "actions", label: "관리", defaultWidth: TABLE_COL.actions, minWidth: 72 },
];

export default function ExpenseTable({
  rows,
  onEdit,
  onDelete,
}: {
  rows: Expense[];
  onEdit: (r: Expense) => void;
  onDelete: (r: Expense) => void;
}) {
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [sort, setSort] = useState("");
  const { columnWidths, setColumnWidth } = useTableColumnPrefs("profile-expense", PROFILE_EXPENSE_COLUMN_DEFS);
  const tableWidth =
    TABLE_COL.checkbox +
    (columnWidths.date ?? TABLE_COL.medium) +
    (columnWidths.title ?? TABLE_COL.subject) +
    (columnWidths.memo ?? TABLE_COL.memo) +
    (columnWidths.amount ?? TABLE_COL.medium) +
    (columnWidths.actions ?? TABLE_COL.actions);
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const allIds = useMemo(() => rows.map((r) => r.id), [rows]);
  const allSelected = rows.length > 0 && allIds.every((id) => selectedSet.has(id));

  const sortedRows = useMemo(() => {
    if (!sort) return rows;
    const key = sort.startsWith("-") ? sort.slice(1) : sort;
    const asc = !sort.startsWith("-");
    return [...rows].sort((a, b) => {
      if (key === "date") {
        return asc ? (a.date ?? "").localeCompare(b.date ?? "", "ko") : -(a.date ?? "").localeCompare(b.date ?? "", "ko");
      }
      if (key === "amount") return asc ? a.amount - b.amount : b.amount - a.amount;
      const aVal = (a as Record<string, unknown>)[key] ?? "";
      const bVal = (b as Record<string, unknown>)[key] ?? "";
      return asc ? String(aVal).localeCompare(String(bVal), "ko") : -String(aVal).localeCompare(String(bVal), "ko");
    });
  }, [rows, sort]);

  const handleSort = useCallback((colKey: string) => {
    setSort((prev) => (prev === colKey ? `-${colKey}` : prev === `-${colKey}` ? "" : colKey));
  }, []);

  function SortableTh({ colKey, label, widthKey, width }: { colKey: string; label: string; widthKey: string; width: number }) {
    const isAsc = sort === colKey;
    const isDesc = sort === `-${colKey}`;
    return (
      <ResizableTh
        columnKey={widthKey}
        width={width}
        minWidth={40}
        maxWidth={600}
        onWidthChange={setColumnWidth}
        onClick={() => handleSort(colKey)}
        aria-sort={isAsc ? "ascending" : isDesc ? "descending" : "none"}
        className="cursor-pointer select-none"
      >
        <span className="inline-flex items-center justify-center gap-2">
          {label}
          <span aria-hidden style={{ fontSize: 11, opacity: isAsc || isDesc ? 1 : 0.35, color: "var(--color-primary)" }}>
            {isAsc ? "▲" : isDesc ? "▼" : "⇅"}
          </span>
        </span>
      </ResizableTh>
    );
  }

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
      tableClassName="ds-table--flat ds-table--center"
      tableStyle={{ tableLayout: "fixed", width: tableWidth }}
    >
      <colgroup>
        <col style={{ width: TABLE_COL.checkbox }} />
        <col style={{ width: columnWidths.date ?? TABLE_COL.medium }} />
        <col style={{ width: columnWidths.title ?? TABLE_COL.subject }} />
        <col style={{ width: columnWidths.memo ?? TABLE_COL.memo }} />
        <col style={{ width: columnWidths.amount ?? TABLE_COL.medium }} />
        <col style={{ width: columnWidths.actions ?? TABLE_COL.actions }} />
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
            className="ds-checkbox-cell"
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
          <SortableTh colKey="date" label="날짜" widthKey="date" width={columnWidths.date ?? TABLE_COL.medium} />
          <SortableTh colKey="title" label="항목" widthKey="title" width={columnWidths.title ?? TABLE_COL.subject} />
          <SortableTh colKey="memo" label="메모" widthKey="memo" width={columnWidths.memo ?? TABLE_COL.memo} />
          <SortableTh colKey="amount" label="금액" widthKey="amount" width={columnWidths.amount ?? TABLE_COL.medium} />
          <ResizableTh
            columnKey="actions"
            width={columnWidths.actions ?? TABLE_COL.actions}
            minWidth={72}
            maxWidth={120}
            onWidthChange={setColumnWidth}
            className="text-center"
          >
            관리
          </ResizableTh>
        </tr>
      </thead>
      <tbody>
        {sortedRows.map((r) => (
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
