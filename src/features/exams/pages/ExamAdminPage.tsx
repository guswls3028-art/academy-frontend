/**
 * 시험 (사이드바) — 전체 시험 목록 · 강의·차시 단위 시험 통합 조회
 * Design SSOT: students 도메인 (DomainLayout, DomainListToolbar, DomainTable ds-table--flat)
 */

import { useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchExams } from "../api/exams";
import { DomainLayout } from "@/shared/ui/layout";
import { DomainListToolbar, DomainTable, TABLE_COL, STATUS_ACTIVE_COLOR, STATUS_INACTIVE_COLOR, ResizableTh, useTableColumnPrefs } from "@/shared/ui/domain";
import type { TableColumnDef } from "@/shared/ui/domain";
import { Button, EmptyState } from "@/shared/ui/ds";

const EXAM_ADMIN_COLUMN_DEFS: TableColumnDef[] = [
  { key: "title", label: "시험명", defaultWidth: TABLE_COL.title, minWidth: 100 },
  { key: "subject", label: "과목", defaultWidth: TABLE_COL.subject, minWidth: 60 },
  { key: "exam_type", label: "유형", defaultWidth: TABLE_COL.short, minWidth: 50 },
  { key: "retake", label: "재응시", defaultWidth: TABLE_COL.status, minWidth: 60 },
  { key: "status", label: "상태", defaultWidth: TABLE_COL.status, minWidth: 60 },
  { key: "created_at", label: "개설일", defaultWidth: TABLE_COL.medium, minWidth: 80 },
  { key: "actions", label: "관리", defaultWidth: TABLE_COL.actions, minWidth: 72 },
];

function ExamSortableTh({
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
      maxWidth={600}
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

function formatDate(s: string | null): string {
  if (!s) return "—";
  try {
    const d = new Date(s);
    return d.toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" });
  } catch {
    return "—";
  }
}

export default function ExamAdminPage() {
  const navigate = useNavigate();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("");
  const { columnWidths, setColumnWidth } = useTableColumnPrefs("exams", EXAM_ADMIN_COLUMN_DEFS);

  const { data: list = [], isLoading } = useQuery({
    queryKey: ["admin-exams"],
    queryFn: () => fetchExams(),
  });

  // 클라이언트 검색: 시험명·과목
  const filtered = useMemo(() => {
    if (!search.trim()) return list;
    const k = search.trim().toLowerCase();
    return list.filter(
      (e) =>
        (e.title && e.title.toLowerCase().includes(k)) ||
        (e.subject && e.subject.toLowerCase().includes(k))
    );
  }, [list, search]);

  const sortedFiltered = useMemo(() => {
    if (!sort) return filtered;
    const key = sort.startsWith("-") ? sort.slice(1) : sort;
    const asc = !sort.startsWith("-");
    return [...filtered].sort((a, b) => {
      let aVal: string | number = (a as Record<string, unknown>)[key] ?? "";
      let bVal: string | number = (b as Record<string, unknown>)[key] ?? "";
      if (key === "created_at") {
        aVal = a.created_at ? new Date(a.created_at).getTime() : 0;
        bVal = b.created_at ? new Date(b.created_at).getTime() : 0;
      } else if (key === "status") {
        aVal = a.is_active ? 1 : 0;
        bVal = b.is_active ? 1 : 0;
      }
      if (typeof aVal === "string" && typeof bVal === "string") {
        return asc ? String(aVal).localeCompare(String(bVal), "ko") : -String(aVal).localeCompare(String(bVal), "ko");
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
    (columnWidths.exam_type ?? TABLE_COL.short) +
    (columnWidths.retake ?? TABLE_COL.status) +
    (columnWidths.status ?? TABLE_COL.status) +
    (columnWidths.created_at ?? TABLE_COL.medium) +
    (columnWidths.actions ?? TABLE_COL.actions);

  return (
    <DomainLayout
      title="시험"
      description="강의·차시 단위 시험을 한 화면에서 조회합니다. 시험 생성·관리는 각 강의 > 차시에서 진행하세요."
    >
      <div className="flex flex-col gap-4">
        <DomainListToolbar
          totalLabel={isLoading ? "…" : `총 ${filtered.length}건`}
          searchSlot={
            <input
              className="ds-input"
              placeholder="시험명 · 과목 검색"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onBlur={() => setSearch(searchInput)}
              onKeyDown={(e) => e.key === "Enter" && setSearch(searchInput)}
              style={{ maxWidth: 280 }}
            />
          }
          primaryAction={
            <Button intent="primary" onClick={() => navigate("/admin/lectures")}>
              강의로 이동
            </Button>
          }
        />

        {isLoading ? (
          <EmptyState scope="panel" tone="loading" title="불러오는 중…" />
        ) : !filtered.length ? (
          <EmptyState
            scope="panel"
            tone="empty"
            title="시험이 없습니다"
            description="각 강의 > 차시에서 시험을 추가하고 운영할 수 있습니다."
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
              <col style={{ width: columnWidths.exam_type ?? TABLE_COL.short }} />
              <col style={{ width: columnWidths.retake ?? TABLE_COL.status }} />
              <col style={{ width: columnWidths.status ?? TABLE_COL.status }} />
              <col style={{ width: columnWidths.created_at ?? TABLE_COL.medium }} />
              <col style={{ width: columnWidths.actions ?? TABLE_COL.actions }} />
            </colgroup>
            <thead>
              <tr>
                <ExamSortableTh colKey="title" label="시험명" widthKey="title" width={columnWidths.title ?? TABLE_COL.title} sort={sort} onSort={handleSort} onWidthChange={setColumnWidth} />
                <ExamSortableTh colKey="subject" label="과목" widthKey="subject" width={columnWidths.subject ?? TABLE_COL.subject} sort={sort} onSort={handleSort} onWidthChange={setColumnWidth} />
                <ExamSortableTh colKey="exam_type" label="유형" widthKey="exam_type" width={columnWidths.exam_type ?? TABLE_COL.short} sort={sort} onSort={handleSort} onWidthChange={setColumnWidth} />
                <ExamSortableTh colKey="retake" label="재응시" widthKey="retake" width={columnWidths.retake ?? TABLE_COL.status} sort={sort} onSort={handleSort} onWidthChange={setColumnWidth} />
                <ExamSortableTh colKey="status" label="상태" widthKey="status" width={columnWidths.status ?? TABLE_COL.status} sort={sort} onSort={handleSort} onWidthChange={setColumnWidth} />
                <ExamSortableTh colKey="created_at" label="개설일" widthKey="created_at" width={columnWidths.created_at ?? TABLE_COL.medium} sort={sort} onSort={handleSort} onWidthChange={setColumnWidth} />
                <th scope="col" style={{ width: columnWidths.actions ?? TABLE_COL.actions }} aria-label="관리" />
              </tr>
            </thead>
            <tbody>
              {sortedFiltered.map((e) => (
                <tr
                  key={e.id}
                  className="cursor-pointer hover:bg-[var(--color-bg-surface-hover)]"
                  onClick={() => navigate("/admin/lectures")}
                >
                  <td className="font-semibold text-[var(--color-text-primary)] truncate" title={e.title}>
                    {e.title || "—"}
                  </td>
                  <td className="text-[var(--color-text-secondary)] truncate">{e.subject || "—"}</td>
                  <td className="text-[var(--color-text-secondary)]">
                    {e.exam_type === "template" ? "템플릿" : "일반"}
                  </td>
                  <td className="text-[var(--color-text-secondary)]">
                    {e.allow_retake ? `최대 ${e.max_attempts}회` : "불가"}
                  </td>
                  <td>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: e.is_active ? STATUS_ACTIVE_COLOR : STATUS_INACTIVE_COLOR,
                      }}
                    >
                      {e.is_active ? "활성" : "비활성"}
                    </span>
                  </td>
                  <td className="text-[var(--color-text-muted)]">{formatDate(e.created_at)}</td>
                  <td onClick={(ev) => ev.stopPropagation()}>
                    <Button
                      intent="ghost"
                      size="sm"
                      onClick={() => navigate("/admin/lectures")}
                    >
                      관리
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
