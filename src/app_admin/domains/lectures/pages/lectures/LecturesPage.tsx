// PATH: src/app_admin/domains/lectures/pages/lectures/LecturesPage.tsx
// Design: docs/DESIGN_SSOT.md (강의 관리만 체크박스 없음 — 유일 예외)

import { useMemo, useState, useCallback, type CSSProperties } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Settings } from "lucide-react";

import api from "@/shared/api/axios";
import { EmptyState, Button } from "@/shared/ui/ds";
import { DomainListToolbar, DomainTable, TABLE_COL, ResizableTh, useTableColumnPrefs } from "@/shared/ui/domain";
import type { TableColumnDef } from "@/shared/ui/domain";
import LectureChip from "@/shared/ui/chips/LectureChip";
import LectureCreateModal from "../../components/LectureCreateModal";
import LectureSettingsModal from "../../components/LectureSettingsModal";
import { adminLectureQueryKeys } from "../../queryKeys";

/** 강의 목록 테이블 컬럼 정의 (useTableColumnPrefs SSOT) */
const LECTURES_TABLE_COLUMN_DEFS: TableColumnDef[] = [
  { key: "title", label: "강의 이름", defaultWidth: TABLE_COL.title, minWidth: 100 },
  { key: "subject", label: "과목", defaultWidth: TABLE_COL.subject, minWidth: 60 },
  { key: "name", label: "강사", defaultWidth: TABLE_COL.medium, minWidth: 60 },
  { key: "lecture_time", label: "강의 시간", defaultWidth: TABLE_COL.timeRange, minWidth: 80 },
  { key: "dateRange", label: "기간", defaultWidth: TABLE_COL.dateRange, minWidth: 140 },
];

type LecturesPageProps = {
  tab?: "active" | "past";
};

type LectureItem = {
  id: number;
  title: string;
  subject?: string | null;
  name?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  lecture_time?: string | null;
  color?: string | null;
  chip_label?: string | null;
  is_active?: boolean;
};

type LectureSortKey = "title" | "subject" | "name" | "lecture_time" | "dateRange";

const FIT_CONTENT_STYLE: CSSProperties = { width: "fit-content" };
const ACTION_COLUMN_STYLE: CSSProperties = { width: 56 };

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function toStringOrNull(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function normalizeLectureItem(value: unknown): LectureItem | null {
  if (!isRecord(value)) return null;
  const id = toNumber(value.id);
  if (id == null) return null;
  return {
    id,
    title: toStringOrNull(value.title) ?? "",
    subject: toStringOrNull(value.subject),
    name: toStringOrNull(value.name),
    start_date: toStringOrNull(value.start_date),
    end_date: toStringOrNull(value.end_date),
    lecture_time: toStringOrNull(value.lecture_time),
    color: toStringOrNull(value.color),
    chip_label: toStringOrNull(value.chip_label),
    is_active: typeof value.is_active === "boolean" ? value.is_active : undefined,
  };
}

function extractLectureListPayload(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (isRecord(value) && Array.isArray(value.results)) return value.results;
  return [];
}

function columnWidthStyle(width: number): CSSProperties {
  return { width };
}

function isLectureSortKey(key: string): key is LectureSortKey {
  return key === "title" || key === "subject" || key === "name" || key === "lecture_time" || key === "dateRange";
}

function getLectureSortValue(lecture: LectureItem, key: LectureSortKey, toTime: (value?: string | null) => number): string | number {
  if (key === "dateRange") return toTime(lecture.start_date);
  return lecture[key] ?? "";
}

/** 지난 강의 = is_active === false 인 경우만. 종료일 자동 이동 로직 없음. */
function isPastLecture(lec: LectureItem) {
  return lec.is_active === false;
}

/** 컴포넌트를 페이지 밖에 두어 리사이즈 중 부모 리렌더 시에도 ResizableTh가 언마운트되지 않도록 함 */
function LectureSortableTh({
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
        <span
          aria-hidden
          className={`text-[11px] text-[var(--color-primary)] ${isAsc || isDesc ? "opacity-100" : "opacity-[0.35]"}`}
        >
          {isAsc ? "▲" : isDesc ? "▼" : "⇅"}
        </span>
      </span>
    </ResizableTh>
  );
}

export default function LecturesPage({ tab = "active" }: LecturesPageProps) {
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("");
  const { columnWidths, setColumnWidth } = useTableColumnPrefs("lectures", LECTURES_TABLE_COLUMN_DEFS);

  const { data = [], isLoading, error, isFetching } = useQuery({
    queryKey: adminLectureQueryKeys.lectures,
    queryFn: async (): Promise<LectureItem[]> => {
      const res = await api.get("/lectures/lectures/");
      return extractLectureListPayload(res.data)
        .map(normalizeLectureItem)
        .filter((item): item is LectureItem => item != null);
    },
  });

  const { activeLectures, pastLectures } = useMemo(() => {
    const active: LectureItem[] = [];
    const past: LectureItem[] = [];

    for (const lec of data) {
      if (isPastLecture(lec)) past.push(lec);
      else active.push(lec);
    }

    const toTime = (v?: string | null) => {
      if (!v) return 0;
      const t = new Date(v).getTime();
      return Number.isFinite(t) ? t : 0;
    };

    active.sort((a, b) => toTime(b.start_date) - toTime(a.start_date));
    past.sort((a, b) => toTime(b.start_date) - toTime(a.start_date));

    return { activeLectures: active, pastLectures: past };
  }, [data]);

  const [settingsLecture, setSettingsLecture] = useState<LectureItem | null>(null);
  const [editLectureId, setEditLectureId] = useState<number | null>(null);
  const qc = useQueryClient();

  const toTime = useCallback((v?: string | null) => {
    if (!v) return 0;
    const t = new Date(v).getTime();
    return Number.isFinite(t) ? t : 0;
  }, []);

  const list = useMemo(() => {
    const base = tab === "active" ? activeLectures : pastLectures;
    const keyword = q.trim().toLowerCase();
    const filtered = !keyword
      ? base
      : base.filter((lec) =>
          [
            lec.title,
            lec.subject ?? "",
            lec.name ?? "",
            lec.lecture_time ?? "",
            lec.start_date ?? "",
            lec.end_date ?? "",
          ]
            .join(" ")
            .toLowerCase()
            .includes(keyword)
        );
    if (!sort) return filtered;
    const key = sort.startsWith("-") ? sort.slice(1) : sort;
    if (!isLectureSortKey(key)) return filtered;
    const asc = !sort.startsWith("-");
    return [...filtered].sort((a, b) => {
      const aVal = getLectureSortValue(a, key, toTime);
      const bVal = getLectureSortValue(b, key, toTime);
      if (typeof aVal === "string" && typeof bVal === "string") {
        const cmp = aVal.localeCompare(String(bVal), "ko");
        return asc ? cmp : -cmp;
      }
      const cmp = Number(aVal) - Number(bVal);
      return asc ? cmp : -cmp;
    });
  }, [tab, activeLectures, pastLectures, q, sort, toTime]);

  const tableWidth = useMemo(
    () =>
      LECTURES_TABLE_COLUMN_DEFS.reduce((sum, c) => sum + (columnWidths[c.key] ?? c.defaultWidth), 0) + 56,
    [columnWidths]
  );

  const handleSort = useCallback((colKey: string) => {
    setSort((prev) => {
      if (prev === colKey) return `-${colKey}`;
      if (prev === `-${colKey}`) return "";
      return colKey;
    });
  }, []);

  return (
    <>
      <div className="flex flex-col gap-4">
        <DomainListToolbar
          totalLabel={
            isLoading ? "…" : isFetching ? "동기화 중…" : `총 ${list.length}개`
          }
          searchSlot={
            <input
              data-guide="lectures-search"
              placeholder="강의 검색 (강의명/과목/강사/기간)"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="ds-input max-w-[360px]"
            />
          }
          primaryAction={
            <Button data-guide="lectures-add-btn" intent="primary" onClick={() => setShowModal(true)}>
              강의 추가
            </Button>
          }
        />

        <div>
          {isLoading ? (
            <EmptyState scope="panel" tone="loading" title="불러오는 중…" />
          ) : error ? (
            <EmptyState scope="panel" tone="error" title="문제가 발생했습니다." />
          ) : list.length === 0 ? (
            <EmptyState scope="panel" tone="empty" title="표시할 강의가 없습니다." />
          ) : (
            <div data-guide="lectures-table" style={FIT_CONTENT_STYLE}>
              <DomainTable
                tableClassName="ds-table--flat ds-table--center"
                tableStyle={{ tableLayout: "fixed", width: tableWidth }}
              >
                <colgroup>
                  {LECTURES_TABLE_COLUMN_DEFS.map((c) => (
                    <col key={c.key} style={columnWidthStyle(columnWidths[c.key] ?? c.defaultWidth)} />
                  ))}
                  <col style={ACTION_COLUMN_STYLE} />
                </colgroup>
                <thead>
                  <tr>
                    <LectureSortableTh
                      colKey="title"
                      label="강의 이름"
                      widthKey="title"
                      width={columnWidths.title ?? TABLE_COL.title}
                      sort={sort}
                      onSort={handleSort}
                      onWidthChange={setColumnWidth}
                    />
                    <LectureSortableTh
                      colKey="subject"
                      label="과목"
                      widthKey="subject"
                      width={columnWidths.subject ?? TABLE_COL.subject}
                      sort={sort}
                      onSort={handleSort}
                      onWidthChange={setColumnWidth}
                    />
                    <LectureSortableTh
                      colKey="name"
                      label="강사"
                      widthKey="name"
                      width={columnWidths.name ?? TABLE_COL.medium}
                      sort={sort}
                      onSort={handleSort}
                      onWidthChange={setColumnWidth}
                    />
                    <LectureSortableTh
                      colKey="lecture_time"
                      label="강의 시간"
                      widthKey="lecture_time"
                      width={columnWidths.lecture_time ?? TABLE_COL.timeRange}
                      sort={sort}
                      onSort={handleSort}
                      onWidthChange={setColumnWidth}
                    />
                    <LectureSortableTh
                      colKey="dateRange"
                      label="기간"
                      widthKey="dateRange"
                      width={columnWidths.dateRange ?? TABLE_COL.dateRange}
                      sort={sort}
                      onSort={handleSort}
                      onWidthChange={setColumnWidth}
                    />
                    <th scope="col" aria-label="설정" style={ACTION_COLUMN_STYLE} />
                  </tr>
                </thead>
                <tbody>
                  {list.map((lec) => (
                    <tr
                      key={lec.id}
                      onClick={() => navigate(`/admin/lectures/${lec.id}`)}
                      tabIndex={0}
                      role="button"
                      className="cursor-pointer"
                    >
                      <td className="font-semibold">
                        <span className="inline-flex items-center gap-[10px]">
                          <LectureChip
                            lectureName={lec.title}
                            color={lec.color ?? undefined}
                            chipLabel={lec.chip_label}
                            size={32}
                          />
                          {lec.title}
                        </span>
                      </td>
                      <td>{lec.subject || <span className="text-[var(--color-text-muted)]">미입력</span>}</td>
                      <td>{lec.name || <span className="text-[var(--color-text-muted)]">미배정</span>}</td>
                      <td>{lec.lecture_time || <span className="text-[var(--color-text-muted)]">미설정</span>}</td>
                      <td className="font-semibold">
                        {lec.start_date && lec.end_date
                          ? `${lec.start_date} ~ ${lec.end_date}`
                          : lec.start_date
                            ? `${lec.start_date} ~`
                            : <span className="font-normal text-[var(--color-text-muted)]">미설정</span>}
                      </td>
                      <td onClick={(e) => e.stopPropagation()} className="align-middle px-2 py-1">
                        <button
                          type="button"
                          className="flex items-center justify-center w-9 h-9 rounded border border-[var(--color-border-divider)] bg-[var(--color-bg-surface)] hover:bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setSettingsLecture(lec);
                          }}
                          aria-label="설정"
                        >
                          <Settings size={18} strokeWidth={2} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </DomainTable>
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <LectureCreateModal
          isOpen
          onClose={() => setShowModal(false)}
          usedColors={data?.map((l) => l.color).filter((c): c is string => !!c) ?? []}
        />
      )}

      {editLectureId != null && (
        <LectureCreateModal
          isOpen
          lectureId={editLectureId}
          onClose={() => setEditLectureId(null)}
          usedColors={data?.map((l) => l.color).filter((c): c is string => !!c) ?? []}
        />
      )}

      {settingsLecture && (
        <LectureSettingsModal
          open
          onClose={() => setSettingsLecture(null)}
          lecture={settingsLecture}
          isPast={tab === "past"}
          onEdit={(id) => {
            setSettingsLecture(null);
            setEditLectureId(id);
          }}
          onAfterEnd={() => {
            qc.invalidateQueries({ queryKey: adminLectureQueryKeys.lectures });
            navigate("/admin/lectures/past");
          }}
          onAfterRestore={() => qc.invalidateQueries({ queryKey: adminLectureQueryKeys.lectures })}
          onAfterDelete={() => qc.invalidateQueries({ queryKey: adminLectureQueryKeys.lectures })}
        />
      )}
    </>
  );
}
