/**
 * YouTube-style double-tap seek gesture controller.
 * State machine: IDLE | WAITING_FOR_SECOND_TAP | STACKING | ANIMATING | COOLDOWN
 * Uses pointer events; 300ms double-tap window; 600ms stacking; 50% left/right zones.
 */
import { useCallback, useRef, useState } from "react";

const DOUBLE_TAP_MS = 300;
const STACK_WINDOW_MS = 600;
const OVERLAY_FADE_AFTER_MS = 800;
const COOLDOWN_MS = 400;
const DRAG_THRESHOLD_PX = 10;

export type TapZone = 0 | 1 | 2; // 0=left, 1=center, 2=right

export type SeekOverlayState = {
  delta: number;
  side: "left" | "right";
  key: number;
} | null;

type State = "IDLE" | "WAITING_FOR_SECOND_TAP" | "STACKING" | "ANIMATING" | "COOLDOWN";

function getZone(clientX: number, rect: DOMRect): TapZone {
  const mid = rect.left + rect.width / 2;
  if (clientX < mid) return 0;
  if (clientX > mid) return 2;
  return 1;
}

export interface UseDoubleTapSeekOptions {
  getRect: () => DOMRect | null;
  allowSeek: boolean;
  onSingleTap: (zone: TapZone) => void;
  onSeek: (deltaSeconds: number) => void;
  shouldIgnorePointer: (target: EventTarget | null) => boolean;
  isDrag: (down: { x: number; y: number }, up: { x: number; y: number }) => boolean;
}

export function useDoubleTapSeek({
  getRect,
  allowSeek,
  onSingleTap,
  onSeek,
  shouldIgnorePointer,
  isDrag,
}: UseDoubleTapSeekOptions) {
  const [overlay, setOverlayState] = useState<SeekOverlayState>(null);

  const stateRef = useRef<State>("IDLE");
  const lastTapRef = useRef<{ time: number; x: number; y: number; zone: TapZone } | null>(null);
  const stackAccumRef = useRef<number>(0);
  const stackSideRef = useRef<"left" | "right" | null>(null);
  const pointersRef = useRef<Map<number, { x: number; y: number; time: number }>>(new Map());
  const waitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const overlayHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cooldownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearWaitTimer = useCallback(() => {
    if (waitTimerRef.current) {
      clearTimeout(waitTimerRef.current);
      waitTimerRef.current = null;
    }
  }, []);

  const clearStackTimer = useCallback(() => {
    if (stackTimerRef.current) {
      clearTimeout(stackTimerRef.current);
      stackTimerRef.current = null;
    }
  }, []);

  const clearOverlayHideTimer = useCallback(() => {
    if (overlayHideTimerRef.current) {
      clearTimeout(overlayHideTimerRef.current);
      overlayHideTimerRef.current = null;
    }
  }, []);

  const clearCooldownTimer = useCallback(() => {
    if (cooldownTimerRef.current) {
      clearTimeout(cooldownTimerRef.current);
      cooldownTimerRef.current = null;
    }
  }, []);

  const showOverlay = useCallback((delta: number, side: "left" | "right") => {
    clearOverlayHideTimer();
    setOverlayState({ delta, side, key: Date.now() });
    overlayHideTimerRef.current = setTimeout(() => {
      overlayHideTimerRef.current = null;
      setOverlayState(null);
      stateRef.current = "COOLDOWN";
      cooldownTimerRef.current = setTimeout(() => {
        cooldownTimerRef.current = null;
        stateRef.current = "IDLE";
      }, COOLDOWN_MS);
    }, OVERLAY_FADE_AFTER_MS);
  }, [clearOverlayHideTimer]);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (shouldIgnorePointer(e.target)) return;
      const rect = getRect();
      if (!rect) return;
      pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY, time: Date.now() });
    },
    [getRect, shouldIgnorePointer]
  );

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    const rec = pointersRef.current.get(e.pointerId);
    if (rec) {
      rec.x = e.clientX;
      rec.y = e.clientY;
    }
  }, []);

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      const rec = pointersRef.current.get(e.pointerId);
      pointersRef.current.delete(e.pointerId);
      if (!rec) return;
      if (shouldIgnorePointer(e.target)) return;
      const rect = getRect();
      if (!rect) return;

      const zone = getZone(e.clientX, rect);
      const now = Date.now();
      const moved = Math.abs(e.clientX - rec.x) + Math.abs(e.clientY - rec.y) > DRAG_THRESHOLD_PX;
      if (moved) return;

      const state = stateRef.current;

      if (state === "COOLDOWN" || state === "ANIMATING") return;

      if (state === "IDLE") {
        lastTapRef.current = { time: now, x: e.clientX, y: e.clientY, zone };
        stateRef.current = "WAITING_FOR_SECOND_TAP";
        clearWaitTimer();
        waitTimerRef.current = setTimeout(() => {
          waitTimerRef.current = null;
          const singleZone = lastTapRef.current?.zone ?? 1;
          lastTapRef.current = null;
          stateRef.current = "IDLE";
          onSingleTap(singleZone);
        }, DOUBLE_TAP_MS);
        return;
      }

      if (state === "WAITING_FOR_SECOND_TAP") {
        const first = lastTapRef.current;
        if (!first) return;
        const elapsed = now - first.time;
        if (elapsed > DOUBLE_TAP_MS) {
          onSingleTap(first.zone);
          lastTapRef.current = { time: now, x: e.clientX, y: e.clientY, zone };
          waitTimerRef.current = setTimeout(() => {
            waitTimerRef.current = null;
            onSingleTap(zone);
            lastTapRef.current = null;
            stateRef.current = "IDLE";
          }, DOUBLE_TAP_MS);
          return;
        }
        clearWaitTimer();
        if (!allowSeek || zone === 1) {
          lastTapRef.current = null;
          stateRef.current = "IDLE";
          onSingleTap(zone);
          return;
        }
        const delta = zone === 0 ? -10 : 10;
        onSeek(delta);
        stackAccumRef.current = delta;
        stackSideRef.current = zone === 0 ? "left" : "right";
        showOverlay(Math.abs(delta), zone === 0 ? "left" : "right");
        stateRef.current = "STACKING";
        clearStackTimer();
        stackTimerRef.current = setTimeout(() => {
          stackTimerRef.current = null;
          stateRef.current = "ANIMATING";
          stackAccumRef.current = 0;
          stackSideRef.current = null;
        }, STACK_WINDOW_MS);
        return;
      }

      if (state === "STACKING") {
        if (!allowSeek || zone === 1) return;
        const side = stackSideRef.current;
        if ((side === "left" && zone !== 0) || (side === "right" && zone !== 2)) return;
        const delta = zone === 0 ? -10 : 10;
        stackAccumRef.current += delta;
        onSeek(delta);
        showOverlay(Math.abs(stackAccumRef.current), side ?? (zone === 0 ? "left" : "right"));
        clearStackTimer();
        stackTimerRef.current = setTimeout(() => {
          stackTimerRef.current = null;
          stateRef.current = "ANIMATING";
          stackAccumRef.current = 0;
          stackSideRef.current = null;
        }, STACK_WINDOW_MS);
      }
    },
    [
      allowSeek,
      getRect,
      onSingleTap,
      onSeek,
      shouldIgnorePointer,
      showOverlay,
      clearWaitTimer,
      clearStackTimer,
    ]
  );

  const handlePointerCancel = useCallback(
    (e: React.PointerEvent) => {
      pointersRef.current.delete(e.pointerId);
    },
    []
  );

  return {
    onPointerDown: handlePointerDown,
    onPointerUp: handlePointerUp,
    onPointerMove: handlePointerMove,
    onPointerCancel: handlePointerCancel,
    overlay,
  };
}
