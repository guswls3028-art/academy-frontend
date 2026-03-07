/**
 * 테이블 컬럼 표시 선택기 (엑셀처럼 표시할 컬럼 선택)
 * - Popover로 전체 컬럼 목록 + 체크박스
 * - 기본값 복원 버튼
 */

import { useState } from "react";
import { Columns3 } from "lucide-react";
import { Button } from "@/shared/ui/ds";
import type { TableColumnDef } from "./useTableColumnPrefs";

type TableColumnPickerProps = {
  allColumns: TableColumnDef[];
  visibleKeys: string[];
  onToggle: (key: string, visible: boolean) => void;
  onReset: () => void;
  triggerLabel?: string;
  className?: string;
};

export default function TableColumnPicker({
  allColumns,
  visibleKeys,
  onToggle,
  onReset,
  triggerLabel = "컬럼 표시",
  className,
}: TableColumnPickerProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className={`relative ${className ?? ""}`}>
      <Button
        type="button"
        intent="secondary"
        size="sm"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="true"
        className="inline-flex items-center gap-1.5"
      >
        <Columns3 size={16} aria-hidden />
        {triggerLabel}
      </Button>
      {open && (
        <>
          <div
            className="fixed inset-0 z-[90]"
            aria-hidden
            onClick={() => setOpen(false)}
          />
          <div
            className="absolute right-0 top-full z-[91] mt-1 min-w-[220px] rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-lg py-2"
            role="dialog"
            aria-label="표시할 컬럼 선택"
          >
            <div className="px-3 py-1.5 text-xs font-semibold text-[var(--color-text-muted)] border-b border-[var(--color-border-divider)] mb-2">
              표시할 컬럼
            </div>
            <ul className="max-h-[280px] overflow-y-auto px-2 space-y-0.5">
              {allColumns.map((col) => (
                <li key={col.key}>
                  <label className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-[var(--color-bg-surface-soft)] cursor-pointer text-sm">
                    <input
                      type="checkbox"
                      checked={visibleKeys.includes(col.key)}
                      onChange={(e) => {
                        const next = e.target.checked;
                        if (!next && visibleKeys.length <= 1) return;
                        onToggle(col.key, next);
                      }}
                      className="rounded border-[var(--color-border)]"
                    />
                    <span className="truncate">{col.label}</span>
                  </label>
                </li>
              ))}
            </ul>
            <div className="border-t border-[var(--color-border-divider)] mt-2 pt-2 px-2">
              <Button
                type="button"
                intent="ghost"
                size="sm"
                onClick={() => {
                  onReset();
                  setOpen(false);
                }}
                className="w-full justify-center"
              >
                기본값 복원
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
