/**
 * 테이블 컬럼 표시/너비 사용자 설정 훅 (전역)
 * - localStorage에 tableId별로 저장 (academy-table-prefs-${tableId})
 * - 표시 컬럼 선택(엑셀처럼) + 컬럼 너비 조절 반영
 */

import { useCallback, useMemo, useState } from "react";

const STORAGE_PREFIX = "academy-table-prefs-";

export type TableColumnDef = {
  key: string;
  label: string;
  defaultWidth: number;
  minWidth?: number;
  maxWidth?: number;
};

function loadPrefs(tableId: string): { visible: string[]; widths: Record<string, number> } | null {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + tableId);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && Array.isArray(parsed.visible)) {
      return {
        visible: parsed.visible.filter((x: unknown) => typeof x === "string"),
        widths: parsed.widths && typeof parsed.widths === "object" ? parsed.widths : {},
      };
    }
  } catch {
    /* ignore */
  }
  return null;
}

function savePrefs(tableId: string, visible: string[], widths: Record<string, number>) {
  try {
    localStorage.setItem(
      STORAGE_PREFIX + tableId,
      JSON.stringify({ visible, widths })
    );
  } catch {
    /* ignore */
  }
}

export function useTableColumnPrefs(tableId: string, columns: TableColumnDef[]) {
  const columnKeys = useMemo(() => columns.map((c) => c.key), [columns]);
  const defaultWidths = useMemo(
    () => Object.fromEntries(columns.map((c) => [c.key, c.defaultWidth])),
    [columns]
  );

  const [prefs, setPrefs] = useState<{
    visible: string[];
    widths: Record<string, number>;
  }>(() => {
    const loaded = loadPrefs(tableId);
    if (loaded) {
      const visible = loaded.visible.filter((k) => columnKeys.includes(k));
      if (visible.length > 0) return { visible, widths: loaded.widths };
    }
    return {
      visible: columnKeys,
      widths: {},
    };
  });

  const visibleColumns = useMemo(
    () => columns.filter((c) => prefs.visible.includes(c.key)),
    [columns, prefs.visible]
  );

  const columnWidths = useMemo(() => {
    const w: Record<string, number> = {};
    columns.forEach((c) => {
      w[c.key] = prefs.widths[c.key] ?? c.defaultWidth;
    });
    return w;
  }, [columns, prefs.widths]);

  const setColumnVisible = useCallback(
    (key: string, visible: boolean) => {
      setPrefs((prev) => {
        const nextVisible = visible
          ? [...prev.visible, key].filter((k) => columnKeys.includes(k))
          : prev.visible.filter((k) => k !== key);
        if (nextVisible.length === 0) return prev;
        savePrefs(tableId, nextVisible, prev.widths);
        return { ...prev, visible: nextVisible };
      });
    },
    [tableId, columnKeys]
  );

  const setColumnWidth = useCallback(
    (key: string, width: number) => {
      const col = columns.find((c) => c.key === key);
      if (!col) return;
      const min = col.minWidth ?? 40;
      const max = col.maxWidth ?? 800;
      const clamped = Math.min(max, Math.max(min, width));
      setPrefs((prev) => {
        const nextWidths = { ...prev.widths, [key]: clamped };
        savePrefs(tableId, prev.visible, nextWidths);
        return { ...prev, widths: nextWidths };
      });
    },
    [tableId, columns]
  );

  const resetToDefaults = useCallback(() => {
    setPrefs({ visible: columnKeys, widths: {} });
    savePrefs(tableId, columnKeys, {});
  }, [tableId, columnKeys]);

  return {
    allColumns: columns,
    visibleColumns,
    columnWidths,
    visibleKeys: prefs.visible,
    setColumnVisible,
    setColumnWidth,
    resetToDefaults,
  };
}
