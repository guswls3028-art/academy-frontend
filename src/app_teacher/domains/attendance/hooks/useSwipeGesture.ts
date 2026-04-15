/**
 * PATH: src/app_teacher/domains/attendance/hooks/useSwipeGesture.ts
 * 터치 스와이프 제스처 훅 — 출석 카드용
 */
import { useRef, useCallback, useState } from "react";

interface SwipeConfig {
  threshold?: number; // px threshold for action (default: 80)
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
}

interface SwipeState {
  offsetX: number;
  isSwiping: boolean;
  direction: "left" | "right" | null;
}

export function useSwipeGesture({ threshold = 80, onSwipeLeft, onSwipeRight }: SwipeConfig) {
  const startX = useRef(0);
  const startY = useRef(0);
  const isTracking = useRef(false);
  const [state, setState] = useState<SwipeState>({ offsetX: 0, isSwiping: false, direction: null });

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    startX.current = touch.clientX;
    startY.current = touch.clientY;
    isTracking.current = true;
    setState({ offsetX: 0, isSwiping: false, direction: null });
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isTracking.current) return;
    const touch = e.touches[0];
    const dx = touch.clientX - startX.current;
    const dy = touch.clientY - startY.current;

    // If vertical movement is greater, cancel horizontal tracking
    if (Math.abs(dy) > Math.abs(dx) && Math.abs(dx) < 10) {
      isTracking.current = false;
      setState({ offsetX: 0, isSwiping: false, direction: null });
      return;
    }

    // Prevent scroll during swipe
    if (Math.abs(dx) > 10) {
      e.preventDefault();
    }

    const direction = dx > 0 ? "right" : dx < 0 ? "left" : null;
    setState({ offsetX: dx, isSwiping: true, direction });
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (!isTracking.current) return;
    isTracking.current = false;

    const dx = state.offsetX;
    if (Math.abs(dx) >= threshold) {
      if (dx > 0 && onSwipeRight) {
        onSwipeRight();
      } else if (dx < 0 && onSwipeLeft) {
        onSwipeLeft();
      }
    }

    setState({ offsetX: 0, isSwiping: false, direction: null });
  }, [state.offsetX, threshold, onSwipeLeft, onSwipeRight]);

  return {
    state,
    handlers: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
    },
  };
}
