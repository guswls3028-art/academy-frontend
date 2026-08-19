import { useCallback, useMemo, useState } from "react";
import type { Attendance } from "../../api/profile.api";
import {
  DomainTable,
  ResizableTh,
  TABLE_COL,
  useTableColumnPrefs,
  type TableColumnDef,
} from "@/shared/ui/domain";
import styles from "./AttendanceCards.module.css";

const COLUMN_DEFS: TableColumnDef[] = [
  { key: "date", label: "날짜", defaultWidth: TABLE_COL.medium, minWidth: 92 },
  { key: "work_type", label: "유형", defaultWidth: TABLE_COL.mediumAlt, minWidth: 90 },
  { key: "timeRange", label: "근무시간", defaultWidth: TABLE_COL.timeRange, minWidth: 140 },
  { key: "hourly", label: "적용 시급", defaultWidth: TABLE_COL.mediumAlt, minWidth: 90 },
  { key: "amount", label: "근무액", defaultWidth: TABLE_COL.medium, minWidth: 100 },
];

function fmtTime(value?: string | null) {
  return value ? value.slice(0, 5) : "근무 중";
}

export default function AttendanceTable({ rows }: { rows: Attendance[] }) {
  const [sort, setSort] = useState("-date");
  const { columnWidths, setColumnWidth } = useTableColumnPrefs(
    "profile-work-records",
    COLUMN_DEFS,
  );
  const sortedRows = useMemo(() => {
    const key = sort.startsWith("-") ? sort.slice(1) : sort;
    const ascending = !sort.startsWith("-");
    return [...rows].sort((a, b) => {
      let comparison = 0;
      if (key === "date") comparison = a.date.localeCompare(b.date, "ko");
      else if (key === "amount") comparison = a.amount - b.amount;
      else if (key === "hourly") {
        comparison = (a.hourly_rate ?? 0) - (b.hourly_rate ?? 0);
      }
      else comparison = String((a as Record<string, unknown>)[key] ?? "")
        .localeCompare(String((b as Record<string, unknown>)[key] ?? ""), "ko");
      return ascending ? comparison : -comparison;
    });
  }, [rows, sort]);
  const handleSort = useCallback((key: string) => {
    setSort((current) => current === key ? `-${key}` : current === `-${key}` ? "" : key);
  }, []);
  const width = (column: string, fallback: number) => columnWidths[column] ?? fallback;
  const tableWidth = width("date", TABLE_COL.medium)
    + width("work_type", TABLE_COL.mediumAlt)
    + width("timeRange", TABLE_COL.timeRange)
    + width("hourly", TABLE_COL.mediumAlt)
    + width("amount", TABLE_COL.medium);

  return (
    <DomainTable
      tableClassName="ds-table--flat ds-table--center"
      tableStyle={{ tableLayout: "fixed", width: tableWidth }}
    >
      <colgroup>
        {COLUMN_DEFS.map((column) => (
          <col key={column.key} width={width(column.key, column.defaultWidth)} />
        ))}
      </colgroup>
      <thead>
        <tr className={styles.tableHeadRow}>
          {COLUMN_DEFS.map((column) => {
            const sortKey = column.key === "timeRange" ? "date" : column.key;
            const isAscending = sort === sortKey;
            const isDescending = sort === `-${sortKey}`;
            return (
              <ResizableTh
                key={column.key}
                columnKey={column.key}
                width={width(column.key, column.defaultWidth)}
                minWidth={column.minWidth}
                maxWidth={400}
                onWidthChange={setColumnWidth}
                onClick={() => handleSort(sortKey)}
                aria-sort={isAscending ? "ascending" : isDescending ? "descending" : "none"}
                className="cursor-pointer select-none"
              >
                {column.label}
              </ResizableTh>
            );
          })}
        </tr>
      </thead>
      <tbody>
        {sortedRows.map((row) => (
          <tr key={row.id} className={styles.tableRow}>
            <td className={styles.dateCell}>{row.date}</td>
            <td className={styles.secondaryCell}>{row.work_type}</td>
            <td className={styles.primaryCell}>
              <div>{fmtTime(row.start_time)} ~ {fmtTime(row.end_time)}</div>
              <div className={styles.durationDetail}>
                {row.end_time == null
                  ? "진행 중"
                  : `총 ${row.duration_hours}시간${row.break_minutes ? ` · 휴게 ${row.break_minutes}분` : ""}`}
              </div>
            </td>
            <td className={styles.secondaryAmountCell}>
              {row.hourly_rate != null ? `${row.hourly_rate.toLocaleString()}원` : "-"}
            </td>
            <td className={styles.totalAmountCell}>
              {row.end_time == null ? "계산 전" : `${row.amount.toLocaleString()}원`}
            </td>
          </tr>
        ))}
      </tbody>
    </DomainTable>
  );
}
