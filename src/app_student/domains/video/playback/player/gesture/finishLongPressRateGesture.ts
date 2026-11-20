type TimerRef = { current: ReturnType<typeof setTimeout> | null };
type SavedRateRef = { current: number | null };

/** Consume the gesture before restoring so repeated end/cancel events are inert. */
export function finishLongPressRateGesture(
  timer: TimerRef,
  savedRate: SavedRateRef,
  restore?: (rate: number) => void,
) {
  if (timer.current !== null) clearTimeout(timer.current);
  timer.current = null;
  const previousRate = savedRate.current;
  savedRate.current = null;
  if (previousRate !== null) restore?.(previousRate);
}
