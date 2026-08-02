// PATH: src/shared/ui/modal/useDraggableModal.ts
// 모달 헤더 드래그 이동 + 하단 최소화 존 감지 훅
import { useCallback, useRef, useState } from "react";

const MINIMIZE_ZONE_PX = 80;

type Options = {
  /** 하단 드래그 최소화 활성화 (기본: true) */
  enableMinimize?: boolean;
};

type DragBounds = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function useDraggableModal(
  handleSelector = ".modal-header",
  options?: Options,
) {
  const enableMinimize = options?.enableMinimize !== false;
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const offsetRef = useRef({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [inMinimizeZone, setInMinimizeZone] = useState(false);
  /** AdminModal이 매 렌더마다 최신 minimize 콜백을 할당 */
  const onMinimizeRef = useRef<(() => void) | null>(null);

  const tryStart = useCallback(
    (clientX: number, clientY: number, target: HTMLElement) => {
      if (!target.closest(handleSelector)) return null;
      if (target.closest("button, input, select, textarea, a, [role='button']"))
        return null;
      return {
        startX: clientX,
        startY: clientY,
        baseX: offsetRef.current.x,
        baseY: offsetRef.current.y,
        bounds: (() => {
          const modal = target.closest<HTMLElement>(".ant-modal");
          if (!modal) return null;
          const rect = modal.getBoundingClientRect();
          const originalLeft = rect.left - offsetRef.current.x;
          const originalTop = rect.top - offsetRef.current.y;
          const margin = 8;
          return {
            minX: margin - originalLeft,
            maxX: window.innerWidth - margin - originalLeft - rect.width,
            minY: margin - originalTop,
            maxY: window.innerHeight - margin - originalTop - rect.height,
          } satisfies DragBounds;
        })(),
      };
    },
    [handleSelector],
  );

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      const s = tryStart(e.clientX, e.clientY, e.target as HTMLElement);
      if (!s) return;
      e.preventDefault();
      document.body.style.userSelect = "none";
      setDragging(true);

      const { startX, startY, baseX, baseY, bounds } = s;
      const onMove = (ev: MouseEvent) => {
        const raw = {
          x: baseX + ev.clientX - startX,
          y: baseY + ev.clientY - startY,
        };
        const next = bounds
          ? {
              x: clamp(raw.x, Math.min(bounds.minX, bounds.maxX), Math.max(bounds.minX, bounds.maxX)),
              y: clamp(raw.y, Math.min(bounds.minY, bounds.maxY), Math.max(bounds.minY, bounds.maxY)),
            }
          : raw;
        offsetRef.current = next;
        setOffset(next);
        if (enableMinimize) {
          setInMinimizeZone(
            ev.clientY > window.innerHeight - MINIMIZE_ZONE_PX,
          );
        }
      };
      const onUp = (ev: MouseEvent) => {
        document.body.style.userSelect = "";
        setDragging(false);
        setInMinimizeZone(false);
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        if (
          enableMinimize &&
          ev.clientY > window.innerHeight - MINIMIZE_ZONE_PX
        ) {
          onMinimizeRef.current?.();
        }
      };
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    },
    [tryStart, enableMinimize],
  );

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      const touch = e.touches[0];
      const s = tryStart(touch.clientX, touch.clientY, e.target as HTMLElement);
      if (!s) return;
      setDragging(true);

      const { startX, startY, baseX, baseY, bounds } = s;
      const onMove = (ev: TouchEvent) => {
        ev.preventDefault();
        const t = ev.touches[0];
        const raw = {
          x: baseX + t.clientX - startX,
          y: baseY + t.clientY - startY,
        };
        const next = bounds
          ? {
              x: clamp(raw.x, Math.min(bounds.minX, bounds.maxX), Math.max(bounds.minX, bounds.maxX)),
              y: clamp(raw.y, Math.min(bounds.minY, bounds.maxY), Math.max(bounds.minY, bounds.maxY)),
            }
          : raw;
        offsetRef.current = next;
        setOffset(next);
        if (enableMinimize) {
          setInMinimizeZone(
            t.clientY > window.innerHeight - MINIMIZE_ZONE_PX,
          );
        }
      };
      const onEnd = (ev: TouchEvent) => {
        setDragging(false);
        setInMinimizeZone(false);
        document.removeEventListener("touchmove", onMove);
        document.removeEventListener("touchend", onEnd);
        const last = ev.changedTouches[0];
        if (
          enableMinimize &&
          last &&
          last.clientY > window.innerHeight - MINIMIZE_ZONE_PX
        ) {
          onMinimizeRef.current?.();
        }
      };
      document.addEventListener("touchmove", onMove, { passive: false });
      document.addEventListener("touchend", onEnd);
    },
    [tryStart, enableMinimize],
  );

  const reset = useCallback(() => {
    offsetRef.current = { x: 0, y: 0 };
    setOffset({ x: 0, y: 0 });
    setDragging(false);
    setInMinimizeZone(false);
  }, []);

  return {
    offset,
    onMouseDown,
    onTouchStart,
    dragging,
    inMinimizeZone,
    reset,
    onMinimizeRef,
  };
}
