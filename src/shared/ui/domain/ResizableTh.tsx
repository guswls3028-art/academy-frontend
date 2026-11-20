/**
 * 리사이즈 가능한 테이블 헤더 셀
 * - 헤더 오른쪽 가장자리 드래그로 너비 조절
 * - 드래그 중에는 로컬 상태로 즉시 반영해 부모 리렌더 대기 없이 부드럽게 동작
 */

import { useRef, useCallback, useState, useEffect } from "react";
import type { CSSProperties, ReactNode } from "react";
import { cx } from "@/shared/utils/cx";

type ResizableThProps = {
  columnKey: string;
  resizeLabel?: string;
  width: number;
  minWidth?: number;
  maxWidth?: number;
  onWidthChange: (key: string, width: number) => void;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  title?: string;
  onClick?: () => void;
  "aria-sort"?: "ascending" | "descending" | "none";
  scope?: "col";
  rowSpan?: number;
  colSpan?: number;
  noWrap?: boolean;
  /** th에 data-* 속성 부여 (data-col-type, data-group-start 등) */
  dataAttributes?: Record<string, string>;
};

function getResizableThStyle(
  baseStyle: CSSProperties | undefined,
  width: number,
  minWidth: number,
  maxWidth: number,
): CSSProperties {
  return {
    ...baseStyle,
    width,
    minWidth,
    maxWidth,
  };
}

export default function ResizableTh({
  columnKey,
  resizeLabel = columnKey,
  width,
  minWidth = 40,
  maxWidth = 800,
  onWidthChange,
  children,
  className,
  style,
  title,
  onClick,
  "aria-sort": ariaSort,
  scope = "col",
  rowSpan,
  colSpan,
  noWrap = false,
  dataAttributes,
}: ResizableThProps) {
  const activePointer = useRef<number | null>(null);
  const startX = useRef(0);
  const startWidth = useRef(0);
  const [isResizing, setIsResizing] = useState(false);
  /** 리사이즈 직후 click 이벤트 무시용 플래그 */
  const didResize = useRef(false);
  /** 드래그 중 표시 너비 — 부모 상태 대기 없이 즉시 반영 */
  const [localWidth, setLocalWidth] = useState(width);

  useEffect(() => {
    if (!isResizing && localWidth !== width) setLocalWidth(width);
  }, [isResizing, width, localWidth]);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLSpanElement>) => {
      if (!e.isPrimary || e.button !== 0 || activePointer.current !== null) return;
      activePointer.current = e.pointerId;
      e.currentTarget.setPointerCapture(e.pointerId);
      e.preventDefault();
      e.stopPropagation();
      startX.current = e.clientX;
      startWidth.current = width;
      setLocalWidth(width);
      setIsResizing(true);
      didResize.current = false;
    },
    [width]
  );

  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
      if (!isResizing || e.pointerId !== activePointer.current) return;
      const delta = e.clientX - startX.current;
      if (Math.abs(delta) > 2) didResize.current = true;
      const next = Math.min(maxWidth, Math.max(minWidth, startWidth.current + delta));
      setLocalWidth(next);
      onWidthChange(columnKey, next);
    },
    [isResizing, columnKey, minWidth, maxWidth, onWidthChange]
  );

  const handlePointerUp = useCallback((e: PointerEvent) => {
    if (e.pointerId !== activePointer.current) return;
    activePointer.current = null;
    setIsResizing(false);
  }, []);

  useEffect(() => {
    if (!isResizing) return;
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, [isResizing, handlePointerMove, handlePointerUp]);

  const displayWidth = isResizing ? localWidth : width;

  return (
    <th
      scope={scope}
      className={cx("ds-resizable-th", className)}
      aria-sort={ariaSort}
      rowSpan={rowSpan}
      colSpan={colSpan}
      {...(dataAttributes ?? {})}
      data-resizing={isResizing ? "true" : undefined}
      style={getResizableThStyle(style, displayWidth, minWidth, maxWidth)}
      title={title}
      onClick={() => {
        if (didResize.current) { didResize.current = false; return; }
        onClick?.();
      }}
    >
      {noWrap ? children : <span className="inline-flex items-center justify-center gap-2">{children}</span>}
      <span
        role="separator"
        aria-orientation="vertical"
        aria-label={`${resizeLabel} 컬럼 너비 조절`}
        aria-valuemin={minWidth} aria-valuemax={maxWidth} aria-valuenow={displayWidth}
        tabIndex={0}
        onPointerDown={handlePointerDown}
        onKeyDown={event => {
          const step = event.shiftKey ? 32 : 8;
          const target = {ArrowLeft: width - step, ArrowRight: width + step, Home: minWidth, End: maxWidth}[event.key as "ArrowLeft" | "ArrowRight" | "Home" | "End"];
          if (target === undefined) return;
          event.preventDefault();
          event.stopPropagation();
          onWidthChange(columnKey, Math.min(maxWidth, Math.max(minWidth, target)));
        }}
        className="data-table-resize-handle"
      />
    </th>
  );
}
