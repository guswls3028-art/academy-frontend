/**
 * 리사이즈 가능한 테이블 헤더 셀
 * - 헤더 오른쪽 가장자리 드래그로 너비 조절
 */

import { useRef, useCallback, useState, useEffect } from "react";

const RESIZE_HANDLE_WIDTH = 6;

type ResizableThProps = {
  columnKey: string;
  width: number;
  minWidth?: number;
  maxWidth?: number;
  onWidthChange: (key: string, width: number) => void;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
  "aria-sort"?: "ascending" | "descending" | "none";
  scope?: "col";
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
  onClick,
  "aria-sort": ariaSort,
  scope = "col",
}: ResizableThProps) {
  const startX = useRef(0);
  const startWidth = useRef(0);
  const [isResizing, setIsResizing] = useState(false);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      startX.current = e.clientX;
      startWidth.current = width;
      setIsResizing(true);
    },
    [width]
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isResizing) return;
      const delta = e.clientX - startX.current;
      const next = Math.min(maxWidth, Math.max(minWidth, startWidth.current + delta));
      onWidthChange(columnKey, next);
    },
    [isResizing, columnKey, minWidth, maxWidth, onWidthChange]
  );

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
  }, []);

  React.useEffect(() => {
    if (!isResizing) return;
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing, handleMouseMove, handleMouseUp]);

  return (
    <th
      scope={scope}
      className={className}
      aria-sort={ariaSort}
      style={{
        ...style,
        width,
        minWidth,
        maxWidth,
        position: "relative",
        userSelect: isResizing ? "none" : undefined,
      }}
      onClick={onClick}
    >
      <span className="inline-flex items-center justify-center gap-2">{children}</span>
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

// React import for useEffect
import * as React from "react";
