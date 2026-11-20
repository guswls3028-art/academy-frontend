import { useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { DomainTable, ResizableTh, useTableColumnPrefs, type TableColumnDef } from "@/shared/ui/domain";

export type DirectoryColumn<T> = TableColumnDef & {
  value: (row: T) => string | number;
  render?: (row: T) => ReactNode;
};

export type DirectorySort = {key: string; ascending: boolean};

const compareText = new Intl.Collator("ko", {numeric: true});

export default function DawonDirectoryTable<T extends {id: number}>({id, label, rows, columns, empty, sort: controlledSort, onSort}: {
  sort?: DirectorySort; onSort?: (sort: DirectorySort) => void;
  id: string; label: string; rows: T[]; columns: DirectoryColumn<T>[]; empty: string;
}) {
  const {columnWidths, setColumnWidth} = useTableColumnPrefs(id, columns);
  const [localSort, setLocalSort] = useState({key: columns[0].key, ascending: true});
  const sort = controlledSort ?? localSort;
  const setSort = onSort ?? setLocalSort;
  const active = columns.find(column => column.key === sort.key) ?? columns[0];
  const sorted = [...rows].sort((left, right) => {
    const a = active.value(left), b = active.value(right);
    const difference = typeof a === "number" && typeof b === "number" ? a - b : compareText.compare(String(a), String(b));
    return (sort.ascending ? difference : -difference) || left.id - right.id;
  });
  const tableWidth = columns.reduce((sum, column) => sum + (columnWidths[column.key] ?? column.defaultWidth), 0);
  return <DomainTable scrollLabel={label} tableClassName="ds-table--flat" tableStyle={{tableLayout: "fixed", minWidth: tableWidth}}>
    <thead><tr>{columns.map(column => {
      const selected = sort.key === column.key;
      const Icon = selected ? (sort.ascending ? ArrowUp : ArrowDown) : ArrowUpDown;
      return <ResizableTh key={column.key} scope="col" columnKey={column.key} resizeLabel={column.label} width={columnWidths[column.key] ?? column.defaultWidth}
        minWidth={column.minWidth} onWidthChange={setColumnWidth} aria-sort={selected ? (sort.ascending ? "ascending" : "descending") : "none"}>
        <button type="button" className="inline-flex items-center gap-1" aria-label={column.label + " 정렬"}
          onClick={() => setSort({key: column.key, ascending: selected ? !sort.ascending : true})}>
          {column.label}<Icon size={13} aria-hidden />
        </button>
      </ResizableTh>;
    })}</tr></thead>
    <tbody>{sorted.map(row => <tr key={row.id}>{columns.map(column => <td key={column.key}>
      {column.render ? column.render(row) : column.value(row) === "" ? "—" : column.value(row)}
    </td>)}</tr>)}
      {!sorted.length && <tr><td colSpan={columns.length}>{empty}</td></tr>}
    </tbody>
  </DomainTable>;
}
