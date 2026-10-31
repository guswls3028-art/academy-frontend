import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ResizeObserverPolyfill from "resize-observer-polyfill";
import type { TableColumnDef } from "@/shared/ui/domain";
import { getLocalItem, setLocalItem } from "@/shared/utils/safeLocalStorage";

const MODE_KEY = "academy-scores-table-width-mode";

/** Fit the available container without shrinking score editors below their usable width. */
export function useScoreTableLayout(
  columns: TableColumnDef[],
  preferredWidths: Record<string, number>,
  saveWidth: (key: string, width: number) => void,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [availableWidth, setAvailableWidth] = useState(0);
  const [autoFit, setAutoFit] = useState(() => getLocalItem(MODE_KEY) !== "manual");

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    // Measure the scroll viewport, excluding its border, rather than the table itself.
    const viewport = container.querySelector<HTMLElement>(".ds-table-wrap");
    if (!viewport) return;
    const measure = () => setAvailableWidth(viewport.clientWidth);
    measure();
    // Assessment menus use the same browser API; install the existing shim for both.
    if (typeof window.ResizeObserver === "undefined") window.ResizeObserver = ResizeObserverPolyfill;
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  const widths = useMemo(() => {
    if (!autoFit || !availableWidth) return preferredWidths;
    const minimums = columns.map((column) => {
      // Phone headers also contain two 48px touch targets for column ordering.
      const touchHeader = availableWidth < 640 && /^(exam_\d+_|hw_\d+_)/.test(column.key);
      return touchHeader ? Math.max(column.defaultWidth, column.minWidth ?? 64) : column.minWidth ?? 64;
    });
    const preferred = columns.map((column, i) => Math.max(minimums[i], preferredWidths[column.key] ?? column.defaultWidth));
    const minimumTotal = minimums.reduce((sum, width) => sum + width, 0);
    const preferredTotal = preferred.reduce((sum, width) => sum + width, 0);
    const room = Math.max(0, availableWidth - minimumTotal);
    const ratio = preferredTotal > minimumTotal ? Math.min(1, room / (preferredTotal - minimumTotal)) : 1;
    const fitted = minimums.map((minimum, i) => Math.floor(minimum + (preferred[i] - minimum) * ratio));
    // Sparse score sheets should use the available workspace too. Keep utility
    // columns compact and give spare space to student names and assessment data.
    const flexible = columns.flatMap((column, i) => ["select", "attendance", "clinic_target"].includes(column.key) ? [] : [i]);
    const extra = Math.max(0, availableWidth - fitted.reduce((sum, width) => sum + width, 0));
    const weight = flexible.reduce((sum, i) => sum + preferred[i], 0);
    let distributed = 0;
    flexible.forEach((i, index) => {
      const share = index === flexible.length - 1 ? extra - distributed : Math.floor(extra * preferred[i] / weight);
      fitted[i] += share;
      distributed += share;
    });
    return Object.fromEntries(columns.map((column, i) => [column.key, fitted[i]]));
  }, [autoFit, availableWidth, columns, preferredWidths]);

  const changeAutoFit = useCallback((value: boolean) => {
    setAutoFit(value);
    setLocalItem(MODE_KEY, value ? "fit" : "manual");
  }, []);

  const resizeColumn = useCallback((key: string, width: number) => {
    if (autoFit) {
      // Start dragging at the displayed widths, so unrelated columns do not jump.
      columns.forEach((column) => saveWidth(column.key, widths[column.key]));
      changeAutoFit(false);
    }
    saveWidth(key, width);
  }, [autoFit, columns, widths, saveWidth, changeAutoFit]);

  return { containerRef, widths, autoFit, changeAutoFit, resizeColumn };
}
