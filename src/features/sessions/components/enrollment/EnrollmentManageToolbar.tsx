// PATH: src/features/sessions/components/enrollment/EnrollmentManageToolbar.tsx

import type { EnrollmentRow } from "./types";
import { Button } from "@/shared/ui/ds";

export default function EnrollmentManageToolbar({
  keyword,
  onKeywordChange,
  selectedCount,
  totalCount,
  sessionId,
  readOnly,
  rows,
  selectedIds,
  onToggle,
  onSetSelected,
}: {
  keyword: string;
  onKeywordChange: (v: string) => void;
  selectedCount: number;
  totalCount: number;
  sessionId: number;
  readOnly: boolean;
  rows: EnrollmentRow[];
  selectedIds: Set<number>;
  onToggle?: (id: number) => void;
  onSetSelected?: (next: Set<number>) => void;
}) {
  const selectAll = () => {
    if (readOnly) return;

    if (onSetSelected) {
      const next = new Set(selectedIds);
      rows.forEach((r) => next.add(r.enrollment_id));
      onSetSelected(next);
      return;
    }

    rows.forEach((r) => {
      if (!selectedIds.has(r.enrollment_id))
        onToggle?.(r.enrollment_id);
    });
  };

  const clearAll = () => {
    if (readOnly) return;

    if (onSetSelected) {
      const next = new Set(selectedIds);
      rows.forEach((r) => next.delete(r.enrollment_id));
      onSetSelected(next);
      return;
    }

    rows.forEach((r) => {
      if (selectedIds.has(r.enrollment_id))
        onToggle?.(r.enrollment_id);
    });
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <input
        value={keyword}
        onChange={(e) => onKeywordChange(e.target.value)}
        placeholder="학생 이름 검색"
        className="h-9 w-[240px] rounded border border-[var(--border-divider)] bg-[var(--bg-app)] px-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
      />

      <div className="text-xs text-[var(--text-secondary)]">
        선택됨: <b>{selectedCount}</b>명 / 전체 {totalCount}명
        <span className="ml-2 text-[var(--text-muted)]">
          session #{sessionId}
        </span>
      </div>

      {!readOnly && (
        <div className="flex gap-2">
          <Button type="button" intent="secondary" size="sm" onClick={selectAll}>
            현재 목록 전체 선택
          </Button>
          <Button type="button" intent="secondary" size="sm" onClick={clearAll}>
            현재 목록 전체 해제
          </Button>
        </div>
      )}
    </div>
  );
}
