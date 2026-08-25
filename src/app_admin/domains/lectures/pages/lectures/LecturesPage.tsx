// PATH: src/app_admin/domains/lectures/pages/lectures/LecturesPage.tsx
// Design: docs/DESIGN_SSOT.md (강의 관리만 체크박스 없음 — 유일 예외)

import { useMemo, useState, useCallback, type CSSProperties, type DragEvent, type KeyboardEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { ChevronDown, ChevronUp, GripVertical, Settings } from "lucide-react";

import api from "@/shared/api/axios";
import { EmptyState, Button } from "@/shared/ui/ds";
import { DomainListToolbar, DomainTable, ResizableTh, useTableColumnPrefs } from "@/shared/ui/domain";
import type { TableColumnDef } from "@/shared/ui/domain";
import LectureChip from "@/shared/ui/chips/LectureChip";
import LectureCreateModal from "../../components/LectureCreateModal";
import LectureSettingsModal from "../../components/LectureSettingsModal";
import { adminLectureQueryKeys } from "../../queryKeys";
import { feedback } from "@/shared/ui/feedback/feedback";

/** 강의 목록 테이블 컬럼 정의 (useTableColumnPrefs SSOT) */
const LECTURES_TABLE_COLUMN_DEFS: TableColumnDef[] = [
  { key: "title", label: "강의 이름", defaultWidth: 180, minWidth: 120 },
  { key: "active_enrollment_count", label: "수강생", defaultWidth: 92, minWidth: 80 },
  { key: "subject", label: "과목", defaultWidth: 100, minWidth: 70 },
  { key: "name", label: "강사", defaultWidth: 80, minWidth: 70 },
  { key: "lecture_time", label: "강의 시간", defaultWidth: 120, minWidth: 100 },
  { key: "dateRange", label: "기간", defaultWidth: 170, minWidth: 150 },
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
  display_order: number;
  active_enrollment_count: number;
};

type LectureSortKey = "title" | "subject" | "name" | "lecture_time" | "dateRange" | "active_enrollment_count";

const REORDER_COLUMN_WIDTH = 52;
const ACTION_COLUMN_WIDTH = 52;
const REORDER_COLUMN_STYLE: CSSProperties = { width: REORDER_COLUMN_WIDTH };
const ACTION_COLUMN_STYLE: CSSProperties = { width: ACTION_COLUMN_WIDTH };

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

function normalizeLectureItem(value: unknown, fallbackOrder: number): LectureItem | null {
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
    display_order: toNumber(value.display_order) ?? fallbackOrder,
    active_enrollment_count: Math.max(0, toNumber(value.active_enrollment_count) ?? 0),
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
  return key === "title"
    || key === "subject"
    || key === "name"
    || key === "lecture_time"
    || key === "dateRange"
    || key === "active_enrollment_count";
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
  const [dragLectureId, setDragLectureId] = useState<number | null>(null);
  const [dragOverLectureId, setDragOverLectureId] = useState<number | null>(null);
  const { columnWidths, setColumnWidth } = useTableColumnPrefs("lectures-v2-order", LECTURES_TABLE_COLUMN_DEFS);

  const { data = [], isLoading, error, isFetching } = useQuery({
    queryKey: adminLectureQueryKeys.lectures,
    queryFn: async (): Promise<LectureItem[]> => {
      const res = await api.get("/lectures/lectures/");
      return extractLectureListPayload(res.data)
        .map((item, index) => normalizeLectureItem(item, index + 1))
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

    const byManualOrder = (a: LectureItem, b: LectureItem) =>
      a.display_order - b.display_order || a.id - b.id;
    active.sort(byManualOrder);
    past.sort(byManualOrder);

    return { activeLectures: active, pastLectures: past };
  }, [data]);

  const [settingsLecture, setSettingsLecture] = useState<LectureItem | null>(null);
  const [editLectureId, setEditLectureId] = useState<number | null>(null);
  const qc = useQueryClient();

  const reorderMutation = useMutation({
    mutationFn: async ({ scope, orderedIds }: { scope: "ACTIVE" | "PAST"; orderedIds: number[] }) => {
      const response = await api.post("/lectures/lectures/reorder/", {
        scope,
        ordered_ids: orderedIds,
      });
      return response.data;
    },
    onMutate: async ({ scope, orderedIds }) => {
      await qc.cancelQueries({ queryKey: adminLectureQueryKeys.lectures });
      const previous = qc.getQueryData<LectureItem[]>(adminLectureQueryKeys.lectures);
      qc.setQueryData<LectureItem[]>(adminLectureQueryKeys.lectures, (current) => {
        if (!current) return current;
        const isActiveScope = scope === "ACTIVE";
        const scoped = current
          .filter((lecture) => (lecture.is_active !== false) === isActiveScope)
          .sort((a, b) => a.display_order - b.display_order || a.id - b.id);
        const positions = scoped.map((lecture) => lecture.display_order).sort((a, b) => a - b);
        const nextPositionById = new Map(
          orderedIds.map((lectureId, index) => [lectureId, positions[index]]),
        );
        return current.map((lecture) => ({
          ...lecture,
          display_order: nextPositionById.get(lecture.id) ?? lecture.display_order,
        }));
      });
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        qc.setQueryData(adminLectureQueryKeys.lectures, context.previous);
      }
      feedback.error("강의 순서를 저장하지 못해 이전 순서로 되돌렸습니다.");
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: adminLectureQueryKeys.lectures });
    },
  });

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
        if (cmp !== 0) return asc ? cmp : -cmp;
        return a.display_order - b.display_order || a.id - b.id;
      }
      const cmp = Number(aVal) - Number(bVal);
      if (cmp !== 0) return asc ? cmp : -cmp;
      return a.display_order - b.display_order || a.id - b.id;
    });
  }, [tab, activeLectures, pastLectures, q, sort, toTime]);

  const manualScopeList = tab === "active" ? activeLectures : pastLectures;
  const hasDisplayTransform = q.trim().length > 0 || sort.length > 0;
  const canReorder = !hasDisplayTransform && !reorderMutation.isPending;
  const visibleEnrollmentCount = useMemo(
    () => list.reduce((sum, lecture) => sum + lecture.active_enrollment_count, 0),
    [list],
  );

  const persistMovedLecture = useCallback((lectureId: number, targetIndex: number) => {
    if (!canReorder) return;
    const sourceIndex = manualScopeList.findIndex((lecture) => lecture.id === lectureId);
    if (sourceIndex < 0) return;
    const boundedTarget = Math.max(0, Math.min(manualScopeList.length - 1, targetIndex));
    if (sourceIndex === boundedTarget) return;
    const next = [...manualScopeList];
    const [moved] = next.splice(sourceIndex, 1);
    next.splice(boundedTarget, 0, moved);
    reorderMutation.mutate({
      scope: tab === "active" ? "ACTIVE" : "PAST",
      orderedIds: next.map((lecture) => lecture.id),
    });
  }, [canReorder, manualScopeList, reorderMutation, tab]);

  const moveLectureBy = useCallback((lectureId: number, delta: -1 | 1) => {
    const sourceIndex = manualScopeList.findIndex((lecture) => lecture.id === lectureId);
    if (sourceIndex < 0) return;
    persistMovedLecture(lectureId, sourceIndex + delta);
  }, [manualScopeList, persistMovedLecture]);

  const handleOrderKeyDown = useCallback((event: KeyboardEvent<HTMLButtonElement>, lectureId: number) => {
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
    event.preventDefault();
    event.stopPropagation();
    moveLectureBy(lectureId, event.key === "ArrowUp" ? -1 : 1);
  }, [moveLectureBy]);

  const handleDrop = useCallback((event: DragEvent<HTMLTableRowElement>, targetLectureId: number) => {
    event.preventDefault();
    const sourceId = dragLectureId ?? Number(event.dataTransfer.getData("text/plain"));
    const targetIndex = manualScopeList.findIndex((lecture) => lecture.id === targetLectureId);
    if (Number.isFinite(sourceId) && targetIndex >= 0) {
      persistMovedLecture(sourceId, targetIndex);
    }
    setDragLectureId(null);
    setDragOverLectureId(null);
  }, [dragLectureId, manualScopeList, persistMovedLecture]);

  const tableWidth = useMemo(
    () =>
      LECTURES_TABLE_COLUMN_DEFS.reduce((sum, c) => sum + (columnWidths[c.key] ?? c.defaultWidth), 0)
      + REORDER_COLUMN_WIDTH
      + ACTION_COLUMN_WIDTH,
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
            isLoading
              ? "…"
              : isFetching
                ? "동기화 중…"
                : `강의 ${list.length}개 · 수강 등록 ${visibleEnrollmentCount}명`
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
          belowSlot={
            <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs text-[var(--color-text-muted)]" aria-live="polite">
              <span>
                {reorderMutation.isPending
                  ? "강의 순서를 저장하는 중입니다."
                  : hasDisplayTransform
                    ? "검색 또는 열 정렬 중에는 순서를 변경할 수 없습니다."
                    : "점 손잡이를 끌거나 눌러 강의 순서를 바꿀 수 있습니다. 방향키도 사용할 수 있습니다."}
              </span>
              {sort && (
                <Button size="sm" intent="secondary" onClick={() => setSort("")}>
                  기본 순서로 돌아가기
                </Button>
              )}
            </div>
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
            <div data-guide="lectures-table">
              <DomainTable
                tableClassName="ds-table--flat ds-table--center"
                tableStyle={{ tableLayout: "fixed", width: "100%", minWidth: tableWidth }}
              >
                <colgroup>
                  <col style={REORDER_COLUMN_STYLE} />
                  {LECTURES_TABLE_COLUMN_DEFS.map((c) => (
                    <col key={c.key} style={columnWidthStyle(columnWidths[c.key] ?? c.defaultWidth)} />
                  ))}
                  <col style={ACTION_COLUMN_STYLE} />
                </colgroup>
                <thead>
                  <tr>
                    <th scope="col" style={REORDER_COLUMN_STYLE}>순서</th>
                    <LectureSortableTh
                      colKey="title"
                      label="강의 이름"
                      widthKey="title"
                      width={columnWidths.title ?? 180}
                      sort={sort}
                      onSort={handleSort}
                      onWidthChange={setColumnWidth}
                    />
                    <LectureSortableTh
                      colKey="active_enrollment_count"
                      label="수강생"
                      widthKey="active_enrollment_count"
                      width={columnWidths.active_enrollment_count ?? 92}
                      sort={sort}
                      onSort={handleSort}
                      onWidthChange={setColumnWidth}
                    />
                    <LectureSortableTh
                      colKey="subject"
                      label="과목"
                      widthKey="subject"
                      width={columnWidths.subject ?? 100}
                      sort={sort}
                      onSort={handleSort}
                      onWidthChange={setColumnWidth}
                    />
                    <LectureSortableTh
                      colKey="name"
                      label="강사"
                      widthKey="name"
                      width={columnWidths.name ?? 80}
                      sort={sort}
                      onSort={handleSort}
                      onWidthChange={setColumnWidth}
                    />
                    <LectureSortableTh
                      colKey="lecture_time"
                      label="강의 시간"
                      widthKey="lecture_time"
                      width={columnWidths.lecture_time ?? 120}
                      sort={sort}
                      onSort={handleSort}
                      onWidthChange={setColumnWidth}
                    />
                    <LectureSortableTh
                      colKey="dateRange"
                      label="기간"
                      widthKey="dateRange"
                      width={columnWidths.dateRange ?? 170}
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
                      onClick={() => navigate(`/workspace/lectures/${lec.id}`)}
                      onDragOver={(event) => {
                        if (!canReorder || dragLectureId == null) return;
                        event.preventDefault();
                        setDragOverLectureId(lec.id);
                      }}
                      onDragLeave={() => setDragOverLectureId((current) => current === lec.id ? null : current)}
                      onDrop={(event) => handleDrop(event, lec.id)}
                      className={`cursor-pointer ${dragOverLectureId === lec.id ? "outline outline-2 outline-[var(--color-brand-primary)] outline-offset-[-2px]" : ""}`}
                    >
                      <td
                        onClick={(event) => event.stopPropagation()}
                        className="relative px-1 py-1"
                      >
                        <div className="group flex items-center justify-center">
                          <button
                            type="button"
                            draggable={canReorder}
                            disabled={!canReorder}
                            aria-label={`${lec.title} 순서 이동`}
                            title="끌기 · 누르기 · 방향키로 순서 이동"
                            className="inline-flex h-10 w-10 cursor-grab items-center justify-center rounded text-[var(--color-text-muted)] hover:bg-[var(--color-bg-surface-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-brand-primary)] disabled:cursor-not-allowed disabled:opacity-40"
                            onClick={(event) => event.stopPropagation()}
                            onKeyDown={(event) => {
                              if (event.key === "Escape") event.currentTarget.blur();
                              handleOrderKeyDown(event, lec.id);
                            }}
                            onDragStart={(event) => {
                              event.currentTarget.blur();
                              setDragLectureId(lec.id);
                              event.dataTransfer.effectAllowed = "move";
                              event.dataTransfer.setData("text/plain", String(lec.id));
                            }}
                            onDragEnd={() => {
                              setDragLectureId(null);
                              setDragOverLectureId(null);
                            }}
                          >
                            <GripVertical size={17} aria-hidden />
                          </button>
                          <div
                            role="group"
                            aria-label={`${lec.title} 순서 변경`}
                            className="absolute left-1/2 top-[calc(100%_-_2px)] z-20 hidden -translate-x-1/2 items-center gap-0.5 rounded-lg border border-[var(--color-border-divider)] bg-[var(--color-bg-surface)] p-1 shadow-lg group-focus-within:flex"
                          >
                            <button
                              type="button"
                              disabled={!canReorder || manualScopeList[0]?.id === lec.id}
                              aria-label={`${lec.title} 위로`}
                              title="위로"
                              className="inline-flex h-9 w-9 items-center justify-center rounded-md text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-surface-hover)] hover:text-[var(--color-text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-brand-primary)] disabled:cursor-not-allowed disabled:opacity-30 motion-reduce:transition-none"
                              onClick={(event) => {
                                event.stopPropagation();
                                event.currentTarget.blur();
                                moveLectureBy(lec.id, -1);
                              }}
                            >
                              <ChevronUp size={16} aria-hidden />
                            </button>
                            <button
                              type="button"
                              disabled={!canReorder || manualScopeList[manualScopeList.length - 1]?.id === lec.id}
                              aria-label={`${lec.title} 아래로`}
                              title="아래로"
                              className="inline-flex h-9 w-9 items-center justify-center rounded-md text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-surface-hover)] hover:text-[var(--color-text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-brand-primary)] disabled:cursor-not-allowed disabled:opacity-30 motion-reduce:transition-none"
                              onClick={(event) => {
                                event.stopPropagation();
                                event.currentTarget.blur();
                                moveLectureBy(lec.id, 1);
                              }}
                            >
                              <ChevronDown size={16} aria-hidden />
                            </button>
                          </div>
                        </div>
                      </td>
                      <td className="font-semibold">
                        <button
                          type="button"
                          aria-label={`${lec.title} 강의 열기`}
                          className="inline-flex items-center gap-[10px] rounded bg-transparent text-left text-inherit focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-brand-primary)]"
                          onClick={(event) => {
                            event.stopPropagation();
                            navigate(`/workspace/lectures/${lec.id}`);
                          }}
                        >
                          <LectureChip
                            lectureName={lec.title}
                            color={lec.color ?? undefined}
                            chipLabel={lec.chip_label}
                            size={32}
                          />
                          {lec.title}
                        </button>
                      </td>
                      <td>
                        <span className="inline-flex min-w-[56px] items-center justify-center rounded-full border border-[var(--color-border-divider)] bg-[var(--color-bg-elevated)] px-2 py-1 text-xs font-semibold text-[var(--color-text-primary)]">
                          {lec.active_enrollment_count}명
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
            navigate("/workspace/lectures/past");
          }}
          onAfterRestore={() => qc.invalidateQueries({ queryKey: adminLectureQueryKeys.lectures })}
          onAfterDelete={() => qc.invalidateQueries({ queryKey: adminLectureQueryKeys.lectures })}
        />
      )}
    </>
  );
}
