/**
 * 영상 (사이드바) — 강의별 영상 진입점 · 차시 내 영상은 각 강의 > 차시에서 관리
 * Design: 저장소 양식 통일 (DomainLayout + wrap 구조)
 */

import { useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchLectures } from "@/features/lectures/api/sessions";
import { DomainLayout } from "@/shared/ui/layout";
import { DomainListToolbar, DomainTable, TABLE_COL, STATUS_ACTIVE_COLOR, STATUS_INACTIVE_COLOR, ResizableTh, useTableColumnPrefs } from "@/shared/ui/domain";
import type { TableColumnDef } from "@/shared/ui/domain";
import { Button, EmptyState } from "@/shared/ui/ds";
import styles from "@/shared/ui/domain/StorageStyleTabs.module.css";

const VIDEO_ADMIN_COLUMN_DEFS: TableColumnDef[] = [
  { key: "title", label: "강의명", defaultWidth: TABLE_COL.title, minWidth: 100 },
  { key: "subject", label: "과목", defaultWidth: TABLE_COL.subject, minWidth: 60 },
  { key: "dateRange", label: "기간", defaultWidth: TABLE_COL.medium, minWidth: 80 },
  { key: "status", label: "상태", defaultWidth: TABLE_COL.status, minWidth: 60 },
  { key: "actions", label: "관리", defaultWidth: TABLE_COL.actions, minWidth: 72 },
];

export default function VideoAdminPage() {
  const navigate = useNavigate();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("");
  const { columnWidths, setColumnWidth } = useTableColumnPrefs("videos", VIDEO_ADMIN_COLUMN_DEFS);

  const { data: lectures = [], isLoading } = useQuery({
    queryKey: ["admin-videos-lectures"],
    queryFn: () => fetchLectures({ is_active: undefined }),
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return lectures;
    const k = search.trim().toLowerCase();
    return lectures.filter(
      (l) =>
        (l.title && l.title.toLowerCase().includes(k)) ||
        (l.name && l.name.toLowerCase().includes(k)) ||
        (l.subject && l.subject.toLowerCase().includes(k))
    );
  }, [lectures, search]);

  const sortedFiltered = useMemo(() => {
    if (!sort) return filtered;
    const key = sort.startsWith("-") ? sort.slice(1) : sort;
    const asc = !sort.startsWith("-");
    return [...filtered].sort((a, b) => {
      let aVal: string | number = "";
      let bVal: string | number = "";
      if (key === "dateRange") {
        aVal = a.start_date ? new Date(a.start_date).getTime() : 0;
        bVal = b.start_date ? new Date(b.start_date).getTime() : 0;
      } else if (key === "status") {
        aVal = a.is_active ? 1 : 0;
        bVal = b.is_active ? 1 : 0;
      } else {
        aVal = (a as Record<string, unknown>)[key] ?? "";
        bVal = (b as Record<string, unknown>)[key] ?? "";
      }
      if (typeof aVal === "string" && typeof bVal === "string") {
        return asc ? aVal.localeCompare(String(bVal), "ko") : -aVal.localeCompare(String(bVal), "ko");
      }
      return asc ? Number(aVal) - Number(bVal) : Number(bVal) - Number(aVal);
    });
  }, [filtered, sort]);

  const handleSort = useCallback((colKey: string) => {
    setSort((prev) => (prev === colKey ? `-${colKey}` : prev === `-${colKey}` ? "" : colKey));
  }, []);

  const totalWidth =
    (columnWidths.title ?? TABLE_COL.title) +
    (columnWidths.subject ?? TABLE_COL.subject) +
    (columnWidths.dateRange ?? TABLE_COL.medium) +
    (columnWidths.status ?? TABLE_COL.status) +
    (columnWidths.actions ?? TABLE_COL.actions);

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

  return (
    <DomainLayout
      title="영상"
      description="강의·차시 단위 영상을 관리합니다. 영상 업로드·재생 정책은 각 강의 > 차시에서 설정하세요."
    >
      <div className={styles.wrap}>
        <DomainListToolbar
          totalLabel={isLoading ? "…" : `총 ${filtered.length}개 강의`}
          searchSlot={
            <input
              className="ds-input"
              placeholder="강의명 · 과목 검색"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onBlur={() => setSearch(searchInput)}
              onKeyDown={(e) => e.key === "Enter" && setSearch(searchInput)}
              style={{ maxWidth: 280 }}
            />
          }
          primaryAction={
            <Button intent="primary" onClick={() => navigate("/admin/lectures")}>
              강의 목록
            </Button>
          }
        />

        {isLoading ? (
          <EmptyState scope="panel" tone="loading" title="불러오는 중…" />
        ) : !filtered.length ? (
          <EmptyState
            scope="panel"
            tone="empty"
            title="강의가 없습니다"
            description="강의를 추가한 뒤, 각 강의 > 차시에서 영상을 업로드하고 재생 정책을 설정할 수 있습니다."
            actions={
              <Button intent="primary" onClick={() => navigate("/admin/lectures")}>
                강의 목록
              </Button>
            }
          />
        ) : (
          <DomainTable tableClassName="ds-table--flat ds-table--center" tableStyle={{ tableLayout: "fixed", width: totalWidth }}>
            <colgroup>
              <col style={{ width: columnWidths.title ?? TABLE_COL.title }} />
              <col style={{ width: columnWidths.subject ?? TABLE_COL.subject }} />
              <col style={{ width: columnWidths.dateRange ?? TABLE_COL.medium }} />
              <col style={{ width: columnWidths.status ?? TABLE_COL.status }} />
              <col style={{ width: columnWidths.actions ?? TABLE_COL.actions }} />
            </colgroup>
            <thead>
              <tr>
                <SortableTh colKey="title" label="강의명" widthKey="title" width={columnWidths.title ?? TABLE_COL.title} />
                <SortableTh colKey="subject" label="과목" widthKey="subject" width={columnWidths.subject ?? TABLE_COL.subject} />
                <SortableTh colKey="dateRange" label="기간" widthKey="dateRange" width={columnWidths.dateRange ?? TABLE_COL.medium} />
                <SortableTh colKey="status" label="상태" widthKey="status" width={columnWidths.status ?? TABLE_COL.status} />
                <th scope="col" style={{ width: columnWidths.actions ?? TABLE_COL.actions }} aria-label="관리" />
              </tr>
            </thead>
            <tbody>
              {sortedFiltered.map((l) => (
                <tr
                  key={l.id}
                  className="cursor-pointer hover:bg-[var(--color-bg-surface-hover)]"
                  onClick={() => navigate(`/admin/lectures/${l.id}`)}
                >
                  <td className="font-semibold text-[var(--color-text-primary)] truncate" title={l.title || l.name}>
                    {l.title || l.name || "—"}
                  </td>
                  <td className="text-[var(--color-text-secondary)] truncate">{l.subject || "—"}</td>
                  <td className="text-[var(--color-text-muted)]">
                    {l.start_date && l.end_date
                      ? `${l.start_date} ~ ${l.end_date}`
                      : l.start_date || "—"}
                  </td>
                  <td>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: l.is_active ? STATUS_ACTIVE_COLOR : STATUS_INACTIVE_COLOR,
                      }}
                    >
                      {l.is_active ? "활성" : "비활성"}
                    </span>
                  </td>
                  <td onClick={(ev) => ev.stopPropagation()}>
                    <Button
                      intent="primary"
                      size="sm"
                      onClick={() => navigate(`/admin/lectures/${l.id}`)}
                    >
                      영상 관리
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </DomainTable>
        )}
      </div>
    </DomainLayout>
  );
}
