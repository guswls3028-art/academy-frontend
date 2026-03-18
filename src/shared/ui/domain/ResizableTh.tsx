/**
 * 리사이즈 가능한 테이블 헤더 셀
 * - 헤더 오른쪽 가장자리 드래그로 너비 조절
 * - 드래그 중에는 로컬 상태로 즉시 반영해 부모 리렌더 대기 없이 부드럽게 동작
 */

import { useRef, useCallback, useState, useEffect } from "react";
import type { CSSProperties, ReactNode } from "react";

const RESIZE_HANDLE_WIDTH = 8;

type ResizableThProps = {
  columnKey: string;
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
  noWrap?: boolean;
};

export default function ResizableTh({
  columnKey,
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
  noWrap = false,
}: ResizableThProps) {
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

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLSpanElement>) => {
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

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isResizing) return;
      const delta = e.clientX - startX.current;
      if (Math.abs(delta) > 2) didResize.current = true;
      const next = Math.min(maxWidth, Math.max(minWidth, startWidth.current + delta));
      setLocalWidth(next);
      onWidthChange(columnKey, next);
    },
    [isResizing, columnKey, minWidth, maxWidth, onWidthChange]
  );

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
  }, []);

  useEffect(() => {
    if (!isResizing) return;
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing, handleMouseMove, handleMouseUp]);

  const displayWidth = isResizing ? localWidth : width;

  return (
    <th
      scope={scope}
      className={className}
      aria-sort={ariaSort}
      rowSpan={rowSpan}
      style={{
        ...style,
        width: displayWidth,
        minWidth,
        maxWidth,
        position: "relative",
        userSelect: isResizing ? "none" : undefined,
      }}
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
        aria-label={`${columnKey} 컬럼 너비 조절`}
        onMouseDown={handleMouseDown}
        className="data-table-resize-handle"
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          width: RESIZE_HANDLE_WIDTH,
          height: "100%",
          cursor: "col-resize",
        }}
      />
    </th>
  );
}
