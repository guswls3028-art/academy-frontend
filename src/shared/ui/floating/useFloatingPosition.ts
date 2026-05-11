// PATH: src/shared/ui/floating/useFloatingPosition.ts
// 전역 SSOT — popover/dropdown 위치 계산.
// flip(아래 공간 부족하면 위로) + viewport clamp(양 방향) + ResizeObserver + scroll/resize 자동 추적.
// 사용처: TimeScrollPopover / DatePicker / SessionBlock / SessionAttendancePage.
// 신규 popover는 반드시 이 hook을 사용. raw getBoundingClientRect + top:rect.bottom 패턴 금지.

import { useLayoutEffect, useState, type RefObject } from "react";

export interface FloatingPositionOptions {
  /** 선호 placement. 공간 충분하면 이쪽으로 열림. 부족하면 자동 flip */
  placement?: "bottom" | "top";
  /** trigger와 popover 사이 거리 (px) */
  gap?: number;
  /** viewport edge 안전 마진 (px) */
  margin?: number;
  /** popover 실측 전 임시 추정 height. ref가 mount되면 실측치 사용 */
  estimateHeight?: number;
  /** popover 실측 전 임시 추정 width */
  estimateWidth?: number;
  /** true면 우측 정렬(translateX(-100%) 등가). 기본 좌측 정렬 */
  alignRight?: boolean;
}

export interface FloatingPosition {
  top: number;
  left: number;
}

/**
 * triggerRect + popoverEl → viewport-safe (top, left) 계산
 * popoverEl이 null이면 estimate 사용 (1차 렌더용)
 */
export function computeFloatingPosition(
  triggerRect: DOMRect,
  popoverEl: HTMLElement | null,
  opts: FloatingPositionOptions = {},
): FloatingPosition {
  const {
    placement = "bottom",
    gap = 8,
    margin = 8,
    estimateHeight = 300,
    estimateWidth = 280,
    alignRight = false,
  } = opts;

  const measuredH = popoverEl?.offsetHeight ?? 0;
  const measuredW = popoverEl?.offsetWidth ?? 0;
  // 측정치가 비정상적으로 작으면(전환 중) 추정치 사용
  const popH = measuredH > 40 ? measuredH : estimateHeight;
  const popW = measuredW > 40 ? measuredW : estimateWidth;

  const spaceBelow = window.innerHeight - triggerRect.bottom;
  const spaceAbove = triggerRect.top;
  const preferBelow = placement === "bottom";
  const canFitBelow = spaceBelow >= popH + gap + margin;
  const canFitAbove = spaceAbove >= popH + gap + margin;

  let openDown: boolean;
  if (preferBelow) {
    openDown = canFitBelow || spaceBelow >= spaceAbove;
  } else {
    openDown = !canFitAbove && spaceBelow >= spaceAbove;
  }

  let top = openDown ? triggerRect.bottom + gap : triggerRect.top - popH - gap;
  // viewport 양방향 clamp
  if (top + popH > window.innerHeight - margin) {
    top = Math.max(margin, window.innerHeight - popH - margin);
  }
  if (top < margin) top = margin;

  let left: number;
  if (alignRight) {
    // 우측 정렬: popover의 우측 edge가 left 좌표에 옴 (translateX(-100%) 등가)
    left = triggerRect.right;
    if (left - popW < margin) left = Math.min(window.innerWidth - margin, popW + margin);
    if (left > window.innerWidth - margin) left = window.innerWidth - margin;
  } else {
    left = triggerRect.left;
    if (left + popW > window.innerWidth - margin) {
      left = Math.max(margin, window.innerWidth - popW - margin);
    }
    if (left < margin) left = margin;
  }

  return { top, left };
}

/**
 * Popover가 열려 있는 동안 trigger 위치 변화를 자동 추적.
 *
 * - 마운트 시 1회 계산 → setState
 * - popover mount → ResizeObserver로 실측 → 재계산
 * - window scroll/resize → 재계산
 * - open=false 시 cleanup + position=null
 *
 * 사용:
 * ```tsx
 * const triggerRef = useRef<HTMLButtonElement>(null);
 * const popRef = useRef<HTMLDivElement>(null);
 * const pos = useFloatingPosition(triggerRef, popRef, open, { placement: "bottom", estimateHeight: 380 });
 * ```
 */
export function useFloatingPosition(
  triggerRef: RefObject<HTMLElement | null>,
  popoverRef: RefObject<HTMLElement | null>,
  /** truthy=open. 동적 트리거(예: row id)일 때 값 변경 자체가 re-position 트리거 */
  open: boolean | number | string | null | undefined,
  opts: FloatingPositionOptions = {},
): FloatingPosition | null {
  const [pos, setPos] = useState<FloatingPosition | null>(null);

  // opts 객체 비교 비용 방지: 주요 필드를 디펜던시로
  const { placement, gap, margin, estimateHeight, estimateWidth, alignRight } = opts;

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) {
      setPos(null);
      return;
    }
    const compute = () => {
      if (!triggerRef.current) return;
      const rect = triggerRef.current.getBoundingClientRect();
      setPos(computeFloatingPosition(rect, popoverRef.current, opts));
    };
    compute();

    let ro: ResizeObserver | null = null;
    // popoverRef가 conditional render로 첫 useLayoutEffect 시점엔 null일 수 있음.
    // RAF로 다음 frame에 다시 시도 + 재측정 (이때 popover가 mount됨)
    let rafId: number | null = null;
    const attachRO = () => {
      if (popoverRef.current && typeof ResizeObserver !== "undefined" && !ro) {
        ro = new ResizeObserver(() => compute());
        ro.observe(popoverRef.current);
        compute(); // 첫 실측 보정
      } else if (!popoverRef.current) {
        rafId = requestAnimationFrame(attachRO);
      }
    };
    attachRO();

    const onScrollOrResize = () => compute();
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);

    return () => {
      ro?.disconnect();
      if (rafId != null) cancelAnimationFrame(rafId);
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, placement, gap, margin, estimateHeight, estimateWidth, alignRight]);

  return pos;
}
