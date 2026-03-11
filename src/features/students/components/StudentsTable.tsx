// PATH: src/features/students/components/StudentsTable.tsx
import { useMemo } from "react";
import { EmptyState } from "@/shared/ui/ds";
import { DomainTable, TABLE_COL, ResizableTh } from "@/shared/ui/domain";
import type { TableColumnDef } from "@/shared/ui/domain";
import StudentNameWithLectureChip from "@/shared/ui/chips/StudentNameWithLectureChip";
import { formatPhone, formatStudentPhoneDisplay } from "@/shared/utils/formatPhone";

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function highlight(text: string, keyword: string) {
  if (!keyword) return text;
  const k = keyword.trim();
  if (!k) return text;

  const parts = String(text).split(new RegExp(`(${escapeRegExp(k)})`, "gi"));
  return parts.map((p, i) =>
    p.toLowerCase() === k.toLowerCase() ? (
      <mark
        key={`hl-${i}-${String(p).slice(0, 8)}`}
        className="px-0.5 rounded"
        style={{
          backgroundColor: "var(--state-selected-bg)",
          color: "inherit",
        }}
      >
        {p}
      </mark>
    ) : (
      p
    )
  );
}

/** 학생 테이블 컬럼 정의 (useTableColumnPrefs + TableColumnPicker + 테이블 렌더 단일 진실) */
export function getStudentsTableColumnsDef(isDeletedTab: boolean): TableColumnDef[] {
  return [
    { key: "name", label: "이름", defaultWidth: TABLE_COL.name, minWidth: 80 },
    { key: "parentPhone", label: "학부모 전화", defaultWidth: TABLE_COL.phone, minWidth: 90 },
    { key: "studentPhone", label: "학생 전화", defaultWidth: TABLE_COL.phone, minWidth: 90 },
    { key: "school", label: "학교", defaultWidth: TABLE_COL.medium, minWidth: 70 },
    { key: "schoolClass", label: "반", defaultWidth: TABLE_COL.short, minWidth: 50 },
    {
      key: isDeletedTab ? "deletedAt" : "registeredAt",
      label: isDeletedTab ? "삭제일" : "등록일",
      defaultWidth: TABLE_COL.medium,
      minWidth: 80,
    },
    { key: "tags", label: "태그", defaultWidth: TABLE_COL.tag, minWidth: 60 },
    ...(isDeletedTab ? [] : [{ key: "active", label: "상태", defaultWidth: TABLE_COL.status, minWidth: 60 }]),
  ];
}

export default function StudentsTable({
  data = [],
  search,
  sort,
  onSortChange,
  onRowClick,
  selectedIds = [],
  onSelectionChange,
  isDeletedTab = false,
  onToggleActive,
  togglingId = null,
  columnPrefs,
}: {
  data: any[];
  search: string;
  sort: string;
  onSortChange: (v: string) => void;
  onRowClick: (id: number) => void;
  selectedIds?: number[];
  onSelectionChange?: (ids: number[]) => void;
  isDeletedTab?: boolean;
  onToggleActive?: (id: number, nextActive: boolean) => void;
  togglingId?: number | null;
  columnPrefs?: {
    visibleColumns: TableColumnDef[];
    columnWidths: Record<string, number>;
    setColumnWidth: (key: string, width: number) => void;
  };
}) {
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const allIds = useMemo(() => data.map((s) => s.id), [data]);
  const allSelected = data.length > 0 && allIds.every((id) => selectedSet.has(id));

  function toggleSelect(id: number) {
    if (!onSelectionChange) return;
    if (selectedSet.has(id)) {
      onSelectionChange(selectedIds.filter((x) => x !== id));
    } else {
      onSelectionChange([...selectedIds, id]);
    }
  }

  /** 현재 페이지 전체 선택/해제 — 기존 선택 유지, 페이지 전환 시에도 선택 유지 */
  function toggleSelectAll() {
    if (!onSelectionChange) return;
    if (allSelected) {
      onSelectionChange(selectedIds.filter((id) => !allIds.includes(id)));
    } else {
      const merged = new Set([...selectedIds, ...allIds]);
      onSelectionChange([...merged]);
    }
  }

  // TABLE_COL SSOT + 전역 컬럼 프리프(표시/너비) — 컬럼 목록은 getStudentsTableColumnsDef와 동일한 def 기반
  const columns = useMemo(() => {
    const def = getStudentsTableColumnsDef(isDeletedTab);
    if (columnPrefs) {
      return [
        { key: "_checkbox", label: "", w: TABLE_COL.checkbox },
        ...columnPrefs.visibleColumns.map((c) => ({
          key: c.key,
          label: c.label,
          w: columnPrefs.columnWidths[c.key] ?? c.defaultWidth,
        })),
      ];
    }
    return [
      { key: "_checkbox", label: "", w: TABLE_COL.checkbox },
      ...def.map((c) => ({ key: c.key, label: c.label, w: c.defaultWidth })),
    ];
  }, [isDeletedTab, columnPrefs]);
  const tableWidth = useMemo(
    () => columns.reduce((sum, c) => sum + c.w, 0),
    [columns]
  );

  if (!data.length) {
    return (
      <EmptyState
        scope="panel"
        tone="empty"
        title="학생 정보가 없습니다."
        description="검색/필터 조건을 확인하거나, 새 학생을 등록해 주세요."
      />
    );
  }

  function sortHeader(colKey: string, label: string, w: number) {
    const isAsc = sort === colKey;
    const isDesc = sort === `-${colKey}`;
    const next = isAsc ? `-${colKey}` : isDesc ? "" : colKey;
    const content = (
      <span className="inline-flex items-center justify-center gap-2">
        {label}
        <span
          aria-hidden
          style={{
            fontSize: 11,
            opacity: isAsc || isDesc ? 1 : 0.35,
            color: "var(--color-primary)",
          }}
        >
          {isAsc ? "▲" : isDesc ? "▼" : "⇅"}
        </span>
      </span>
    );
    if (columnPrefs && colKey !== "tags") {
      return (
        <ResizableTh
          key={colKey}
          columnKey={colKey}
          width={w}
          minWidth={40}
          maxWidth={500}
          onWidthChange={columnPrefs.setColumnWidth}
          onClick={() => onSortChange(next)}
          aria-sort={isAsc ? "ascending" : isDesc ? "descending" : "none"}
          className="cursor-pointer select-none"
        >
          {content}
        </ResizableTh>
      );
    }
    return (
      <th
        key={colKey}
        onClick={() => onSortChange(next)}
        className="cursor-pointer select-none"
        aria-sort={isAsc ? "ascending" : isDesc ? "descending" : "none"}
        scope="col"
        style={{ width: w }}
      >
        {content}
      </th>
    );
  }

  const getCellContent = (colKey: string, s: any) => {
    switch (colKey) {
      case "name":
        return (
          <StudentNameWithLectureChip
            name={s.displayName ?? s.name ?? "-"}
            profilePhotoUrl={s.profilePhotoUrl}
            avatarSize={24}
            lectures={
              Array.isArray(s.enrollments) && s.enrollments.length > 0
                ? s.enrollments.map((en: { id: number; lectureName: string | null; lectureColor?: string | null; lectureChipLabel?: string | null }) => ({
                    lectureName: en.lectureName ?? "??",
                    color: en.lectureColor ?? undefined,
                    chipLabel: en.lectureChipLabel ?? undefined,
                  }))
                : undefined
            }
            chipSize={16}
            highlight={(text) => highlight(text, search)}
          />
        );
      case "parentPhone":
        return highlight(formatPhone(s.parentPhone), search);
      case "studentPhone":
        return highlight(formatStudentPhoneDisplay(s.studentPhone), search);
      case "school":
        return s.school || "-";
      case "schoolClass":
        return s.schoolClass || "-";
      case "registeredAt":
      case "deletedAt":
        return (s.deletedAt ?? s.registeredAt)?.slice(0, 10) || "-";
      case "tags":
        return Array.isArray(s.tags) && s.tags.length > 0 ? (
          <span className="flex flex-wrap gap-1 justify-center">
            {s.tags.slice(0, 3).map((t: { id: number; name: string; color: string }) => (
              <span
                key={t.id}
                className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-semibold truncate max-w-[70px]"
                style={{
                  backgroundColor: t.color ? `${t.color}22` : "var(--color-bg-surface-soft)",
                  color: t.color || "var(--color-text-secondary)",
                  border: t.color ? `1px solid ${t.color}44` : undefined,
                }}
                title={t.name}
              >
                {t.name}
              </span>
            ))}
            {s.tags.length > 3 && (
              <span className="text-[11px] text-[var(--color-text-muted)]">+{s.tags.length - 3}</span>
            )}
          </span>
        ) : (
          <span className="text-[var(--color-text-muted)]">-</span>
        );
      case "active":
        return onToggleActive ? (
          <button
            type="button"
            className="ds-status-badge ds-status-badge--action"
            data-status={s.active ? "active" : "inactive"}
            disabled={togglingId === s.id}
            onClick={(e) => {
              e.stopPropagation();
              onToggleActive(s.id, !s.active);
            }}
            aria-label={s.active ? "비활성으로 변경" : "활성으로 변경"}
          >
            {togglingId === s.id ? "…" : s.active ? "활성" : "비활성"}
          </button>
        ) : (
          <span className="ds-status-badge" data-status={s.active ? "active" : "inactive"}>
            {s.active ? "활성" : "비활성"}
          </span>
        );
      default:
        return "-";
    }
  };

  const dataColumns = columns.filter((c) => c.key !== "_checkbox");
  const cellClass = (key: string) => {
    if (key === "name") return "text-[15px] font-bold leading-6 text-[var(--color-text-primary)] truncate";
    if (key === "active") return "";
    if (key === "tags") return "text-[12px] leading-5";
    if (key === "registeredAt" || key === "deletedAt") return "text-[13px] leading-6 font-semibold text-[var(--color-text-muted)] truncate";
    return "text-[14px] leading-6 text-[var(--color-text-secondary)] truncate";
  };

  return (
    <DomainTable tableClassName="ds-table--flat ds-table--center" tableStyle={{ tableLayout: "fixed", width: tableWidth }}>
      <colgroup>
        {columns.map((c) => (
          <col key={c.key} style={{ width: c.w }} />
        ))}
      </colgroup>

      <thead>
        <tr>
          {columns.map((c) =>
            c.key === "_checkbox" ? (
              <th key="_checkbox" scope="col" style={{ width: TABLE_COL.checkbox }} className="ds-checkbox-cell" onClick={(e) => e.stopPropagation()}>
                {onSelectionChange ? (
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                    aria-label="전체 선택"
                    className="cursor-pointer"
                  />
                ) : null}
              </th>
            ) : c.key === "tags" ? (
              columnPrefs ? (
                <ResizableTh
                  key="tags"
                  columnKey="tags"
                  width={c.w}
                  minWidth={60}
                  maxWidth={400}
                  onWidthChange={columnPrefs.setColumnWidth}
                  className="cursor-default"
                >
                  태그
                </ResizableTh>
              ) : (
                <th key="tags" scope="col" style={{ width: c.w }}>
                  태그
                </th>
              )
            ) : (
              sortHeader(c.key, c.label, c.w)
            )
          )}
        </tr>
      </thead>

      <tbody>
        {data.map((s) => (
          <tr
            key={s.id}
            onClick={() => onRowClick(s.id)}
            tabIndex={0}
            role="button"
            className={`group cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)]/40 ${selectedSet.has(s.id) ? "ds-row-selected" : ""}`}
          >
            <td onClick={(e) => e.stopPropagation()} style={{ width: TABLE_COL.checkbox }} className="ds-checkbox-cell">
              {onSelectionChange ? (
                <input
                  type="checkbox"
                  checked={selectedSet.has(s.id)}
                  onChange={() => toggleSelect(s.id)}
                  onClick={(e) => e.stopPropagation()}
                  aria-label={`${s.displayName ?? s.name} 선택`}
                  className="cursor-pointer"
                />
              ) : null}
            </td>
            {dataColumns.map((c) => (
              <td
                key={c.key}
                style={{ width: c.w }}
                className={cellClass(c.key)}
                onClick={c.key === "active" ? (e) => e.stopPropagation() : undefined}
              >
                {getCellContent(c.key, s)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </DomainTable>
  );
}
