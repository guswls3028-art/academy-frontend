// PATH: src/features/students/components/StudentsTable.tsx
import { useMemo } from "react";
import { EmptyState } from "@/shared/ui/ds";
import { DomainTable } from "@/shared/ui/domain";
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
}: {
  data: any[];
  search: string;
  sort: string;
  onSortChange: (v: string) => void;
  onRowClick: (id: number) => void;
  selectedIds?: number[];
  onSelectionChange?: (ids: number[]) => void;
  isDeletedTab?: boolean;
  /** 학생 도메인 예외: 테이블에서 활성/비활성 클릭 토글 */
  onToggleActive?: (id: number, nextActive: boolean) => void;
  togglingId?: number | null;
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

  // 컬럼: 체크박스 타이트(28), 이름은 딱지 2개+아바타+이름, 전체 중앙정렬
  const columns = useMemo(
    () => [
      { key: "_checkbox", label: "", w: 28 },
      { key: "name", label: "이름", w: 168 },
      { key: "parentPhone", label: "학부모 전화", w: 130 },
      { key: "studentPhone", label: "학생 전화", w: 130 },
      { key: "school", label: "학교", w: 110 },
      { key: "schoolClass", label: "반", w: 65 },
      { key: isDeletedTab ? "deletedAt" : "registeredAt", label: isDeletedTab ? "삭제일" : "등록일", w: 110 },
      { key: "tags", label: "태그", w: 100 },
      ...(isDeletedTab ? [] : [{ key: "active", label: "상태", w: 92 }]),
    ],
    [isDeletedTab]
  );

  if (!data.length) {
    return (
      <EmptyState
        title="학생 정보가 없습니다."
        description="검색/필터 조건을 확인하거나, 새 학생을 등록해 주세요."
        scope="panel"
      />
    );
  }

  function sortHeader(colKey: string, label: string) {
    const isAsc = sort === colKey;
    const isDesc = sort === `-${colKey}`;
    const next = isAsc ? `-${colKey}` : isDesc ? "" : colKey;

    return (
      <th
        key={colKey}
        onClick={() => onSortChange(next)}
        className="cursor-pointer select-none"
        aria-sort={isAsc ? "ascending" : isDesc ? "descending" : "none"}
        scope="col"
      >
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
      </th>
    );
  }

  return (
    <div style={{ width: "fit-content" }}>
    <DomainTable tableClassName="ds-table--flat ds-table--center" tableStyle={{ tableLayout: "fixed", width: 913 }}>
      <colgroup>
        {columns.map((c) => (
          <col key={c.key} style={{ width: c.w }} />
        ))}
      </colgroup>

      <thead>
        <tr>
          {columns.map((c) =>
            c.key === "_checkbox" ? (
              <th key="_checkbox" scope="col" style={{ width: 28 }} className="ds-checkbox-cell" onClick={(e) => e.stopPropagation()}>
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
              <th key="tags" scope="col">
                태그
              </th>
            ) : (
              sortHeader(c.key, c.label)
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
              {/* 체크박스 — 타이트, 칸과 위치 일치 */}
              <td onClick={(e) => e.stopPropagation()} style={{ width: 28 }} className="ds-checkbox-cell">
                {onSelectionChange ? (
                  <input
                    type="checkbox"
                    checked={selectedSet.has(s.id)}
                    onChange={() => toggleSelect(s.id)}
                    onClick={(e) => e.stopPropagation()}
                    aria-label={`${s.name} 선택`}
                    className="cursor-pointer"
                  />
                ) : null}
              </td>
              {/* 이름 — 강의딱지·아바타·이름 */}
              <td className="text-[15px] font-bold leading-6 text-[var(--color-text-primary)] truncate">
                <StudentNameWithLectureChip
                  name={s.name ?? "-"}
                  profilePhotoUrl={s.profilePhotoUrl}
                  avatarSize={24}
                  lectures={
                    Array.isArray(s.enrollments) && s.enrollments.length > 0
                      ? s.enrollments.map((en: { id: number; lectureName: string | null; lectureColor?: string | null }) => ({
                          lectureName: en.lectureName ?? "??",
                          color: en.lectureColor ?? undefined,
                        }))
                      : undefined
                  }
                  chipSize={16}
                  highlight={(text) => highlight(text, search)}
                />
              </td>

              {/* 학부모 전화 */}
              <td className="text-[14px] leading-6 text-[var(--color-text-secondary)] truncate text-center align-middle">
                {highlight(formatPhone(s.parentPhone), search)}
              </td>

              {/* 학생 전화 */}
              <td className="text-[14px] leading-6 text-[var(--color-text-secondary)] truncate text-center align-middle">
                {highlight(formatStudentPhoneDisplay(s.studentPhone), search)}
              </td>

              {/* 학교 */}
              <td className="text-[14px] leading-6 text-[var(--color-text-secondary)] truncate text-center align-middle">
                {s.school || "-"}
              </td>

              {/* 반 */}
              <td className="text-[14px] leading-6 text-[var(--color-text-secondary)] truncate text-center align-middle">
                {s.schoolClass || "-"}
              </td>

              {/* 등록일 / 삭제일 */}
              <td className="text-[13px] leading-6 font-semibold text-[var(--color-text-muted)] truncate text-center align-middle">
                {(isDeletedTab ? s.deletedAt : s.registeredAt)?.slice(0, 10) || "-"}
              </td>

              {/* 태그 */}
              <td className="text-[12px] leading-5 text-center align-middle">
                {Array.isArray(s.tags) && s.tags.length > 0 ? (
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
                      <span className="text-[11px] text-[var(--color-text-muted)]">
                        +{s.tags.length - 3}
                      </span>
                    )}
                  </span>
                ) : (
                  <span className="text-[var(--color-text-muted)]">-</span>
                )}
              </td>

              {/* 상태 — 학생 도메인 예외: 클릭 시 토글(버튼형 연한 톤 뱃지) */}
              {!isDeletedTab && (
                <td className="text-center align-middle" onClick={(e) => e.stopPropagation()}>
                  {onToggleActive ? (
                    <button
                      type="button"
                      className="ds-status-badge ds-status-badge--action"
                      data-status={s.active ? "active" : "inactive"}
                      disabled={togglingId === s.id}
                      onClick={() => onToggleActive(s.id, !s.active)}
                      aria-label={s.active ? "비활성으로 변경" : "활성으로 변경"}
                    >
                      {togglingId === s.id ? "…" : s.active ? "활성" : "비활성"}
                    </button>
                  ) : (
                    <span
                      className="ds-status-badge"
                      data-status={s.active ? "active" : "inactive"}
                    >
                      {s.active ? "활성" : "비활성"}
                    </span>
                  )}
                </td>
              )}
            </tr>
          ))}
      </tbody>
    </DomainTable>
    </div>
  );
}
