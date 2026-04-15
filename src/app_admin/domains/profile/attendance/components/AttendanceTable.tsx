// PATH: src/app_admin/domains/profile/attendance/components/AttendanceTable.tsx
import { useState, useMemo, useCallback } from "react";
import { FiEdit2, FiTrash2 } from "react-icons/fi";
import { Attendance } from "../../api/profile.api";
import { Button } from "@/shared/ui/ds";
import { DomainTable, TABLE_COL, ResizableTh, useTableColumnPrefs } from "@/shared/ui/domain";
import type { TableColumnDef } from "@/shared/ui/domain";

const PROFILE_ATTENDANCE_COLUMN_DEFS: TableColumnDef[] = [
  { key: "date", label: "날짜", defaultWidth: TABLE_COL.medium, minWidth: 80 },
  { key: "work_type", label: "유형", defaultWidth: TABLE_COL.mediumAlt, minWidth: 70 },
  { key: "timeRange", label: "근무시간", defaultWidth: TABLE_COL.timeRange, minWidth: 100 },
  { key: "hourly", label: "시급", defaultWidth: TABLE_COL.mediumAlt, minWidth: 70 },
  { key: "amount", label: "금액", defaultWidth: TABLE_COL.medium, minWidth: 90 },
  { key: "actions", label: "관리", defaultWidth: TABLE_COL.actions, minWidth: 72 },
];

function AttendanceSortableTh({
  colKey,
  label,
  widthKey,
  width,
  sort,
  onSort,
  onWidthChange,
}: {
  colKey: string;
  label: string;
  widthKey: string;
  width: number;
  sort: string;
  onSort: (colKey: string) => void;
  onWidthChange: (key: string, width: number) => void;
}) {
  const isAsc = sort === colKey;
  const isDesc = sort === `-${colKey}`;
  return (
    <ResizableTh
      columnKey={widthKey}
      width={width}
      minWidth={40}
      maxWidth={400}
      onWidthChange={onWidthChange}
      onClick={() => onSort(colKey)}
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

interface Props {
  rows: Attendance[];
  onEdit: (row: Attendance) => void;
  onDelete: (row: Attendance) => void;
}

function fmtTime(t?: string) {
  return t ? t.slice(0, 5) : "-";
}

export default function AttendanceTable({
  rows,
  onEdit,
  onDelete,
}: Props) {
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [sort, setSort] = useState("");
  const { columnWidths, setColumnWidth } = useTableColumnPrefs("profile-attendance", PROFILE_ATTENDANCE_COLUMN_DEFS);
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const allIds = useMemo(() => rows.map((r) => r.id), [rows]);
  const allSelected = rows.length > 0 && allIds.every((attendanceId) => selectedSet.has(attendanceId));

  const sortedRows = useMemo(() => {
    if (!sort) return rows;
    const key = sort.startsWith("-") ? sort.slice(1) : sort;
    const asc = !sort.startsWith("-");
    return [...rows].sort((a, b) => {
      if (key === "date") {
        const cmp = (a.date ?? "").localeCompare(b.date ?? "", "ko");
        return asc ? cmp : -cmp;
      }
      if (key === "amount") {
        return asc ? a.amount - b.amount : b.amount - a.amount;
      }
      const aVal = (a as Record<string, unknown>)[key] ?? "";
      const bVal = (b as Record<string, unknown>)[key] ?? "";
      return asc ? String(aVal).localeCompare(String(bVal), "ko") : -String(aVal).localeCompare(String(bVal), "ko");
    });
  }, [rows, sort]);

  const handleSort = useCallback((colKey: string) => {
    setSort((prev) => (prev === colKey ? `-${colKey}` : prev === `-${colKey}` ? "" : colKey));
  }, []);

  const tableWidth =
    TABLE_COL.checkbox +
    (columnWidths.date ?? TABLE_COL.medium) +
    (columnWidths.work_type ?? TABLE_COL.mediumAlt) +
    (columnWidths.timeRange ?? TABLE_COL.timeRange) +
    (columnWidths.hourly ?? TABLE_COL.mediumAlt) +
    (columnWidths.amount ?? TABLE_COL.medium) +
    (columnWidths.actions ?? TABLE_COL.actions);

  const toggleSelect = (attendanceId: number) => {
    if (selectedSet.has(attendanceId)) setSelectedIds((prev) => prev.filter((x) => x !== attendanceId));
    else setSelectedIds((prev) => [...prev, attendanceId]);
  };
  const toggleSelectAll = () => {
    if (allSelected) setSelectedIds((prev) => prev.filter((attendanceId) => !allIds.includes(attendanceId)));
    else setSelectedIds((prev) => [...new Set([...prev, ...allIds])]);
  };

  if (!rows.length) return null;

  return (
    <DomainTable
      tableClassName="ds-table--flat ds-table--center"
      tableStyle={{ tableLayout: "fixed", width: tableWidth }}
    >
      <colgroup>
        <col style={{ width: TABLE_COL.checkbox }} />
        <col style={{ width: columnWidths.date ?? TABLE_COL.medium }} />
        <col style={{ width: columnWidths.work_type ?? TABLE_COL.mediumAlt }} />
        <col style={{ width: columnWidths.timeRange ?? TABLE_COL.timeRange }} />
        <col style={{ width: columnWidths.hourly ?? TABLE_COL.mediumAlt }} />
        <col style={{ width: columnWidths.amount ?? TABLE_COL.medium }} />
        <col style={{ width: columnWidths.actions ?? TABLE_COL.actions }} />
      </colgroup>
      <thead>
        <tr
          style={{
            background: "color-mix(in srgb, var(--color-primary) 4%, transparent)",
          }}
        >
          <th style={{ padding: "var(--space-3) var(--space-4)", width: TABLE_COL.checkbox, textAlign: "center" }} className="ds-checkbox-cell">
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
          <AttendanceSortableTh colKey="date" label="날짜" widthKey="date" width={columnWidths.date ?? TABLE_COL.medium} sort={sort} onSort={handleSort} onWidthChange={setColumnWidth} />
          <AttendanceSortableTh colKey="work_type" label="유형" widthKey="work_type" width={columnWidths.work_type ?? TABLE_COL.mediumAlt} sort={sort} onSort={handleSort} onWidthChange={setColumnWidth} />
          <AttendanceSortableTh colKey="timeRange" label="근무시간" widthKey="timeRange" width={columnWidths.timeRange ?? TABLE_COL.timeRange} sort={sort} onSort={handleSort} onWidthChange={setColumnWidth} />
          <AttendanceSortableTh colKey="hourly" label="시급" widthKey="hourly" width={columnWidths.hourly ?? TABLE_COL.mediumAlt} sort={sort} onSort={handleSort} onWidthChange={setColumnWidth} />
          <AttendanceSortableTh colKey="amount" label="금액" widthKey="amount" width={columnWidths.amount ?? TABLE_COL.medium} sort={sort} onSort={handleSort} onWidthChange={setColumnWidth} />
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
        {sortedRows.map((r) => {
          const hourly =
            r.duration_hours > 0
              ? Math.round(r.amount / r.duration_hours)
              : 0;

          return (
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
                  aria-label={`${r.date} ${r.work_type} 선택`}
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

              {/* 유형 */}
              <td
                style={{
                  padding: "var(--space-3) var(--space-4)",
                  fontSize: "var(--text-sm)",
                  color: "var(--color-text-secondary)",
                }}
              >
                {r.work_type}
              </td>

              {/* 근무시간 */}
              <td
                style={{
                  padding: "var(--space-3) var(--space-4)",
                  fontSize: "var(--text-sm)",
                  color: "var(--color-text-primary)",
                }}
              >
                <div>{fmtTime(r.start_time)} ~ {fmtTime(r.end_time)}</div>
                <div
                  style={{
                    fontSize: "var(--text-xs)",
                    color: "var(--color-text-muted)",
                    marginTop: 2,
                  }}
                >
                  총 {r.duration_hours}시간
                </div>
              </td>

              {/* 시급 */}
              <td
                style={{
                  padding: "var(--space-3) var(--space-4)",
                  fontSize: "var(--text-sm)",
                  color: "var(--color-text-secondary)",
                  textAlign: "right",
                }}
              >
                {hourly.toLocaleString()}원
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
                    iconOnly
                    onClick={() => onEdit(r)}
                    title="수정"
                  >
                    <FiEdit2 size={14} />
                  </Button>
                  <Button
                    type="button"
                    intent="danger"
                    size="sm"
                    iconOnly
                    onClick={() => onDelete(r)}
                    title="삭제"
                  >
                    <FiTrash2 size={14} />
                  </Button>
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </DomainTable>
  );
}
