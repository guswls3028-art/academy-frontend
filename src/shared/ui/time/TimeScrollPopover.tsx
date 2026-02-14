// PATH: src/shared/ui/time/TimeScrollPopover.tsx
// [ 오전 | 24h롤러 ] — 우측 24h 48슬롯 롤링, 좌측 오전/오후 시각+클릭(같은 시각 AM↔PM ±12h).

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import "./TimeScrollPopover.css";

const ROW_HEIGHT = 48;
const VISIBLE_ROWS = 5;
const VISIBLE_HEIGHT = ROW_HEIGHT * VISIBLE_ROWS;

/** 24h 30분 단위 48슬롯 (00:00~23:30) */
const ALL_SLOTS = (() => {
  const out: string[] = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 30) {
      out.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
  }
  return out;
})();

/** 24h "HH:mm" → "오전 9:30" / "오후 2:00" (오후 = +12h 표현) */
export function format24To12Display(hhmm: string): string {
  if (!hhmm) return "오전 12:00";
  const [hStr, mStr] = hhmm.split(":");
  const h = parseInt(hStr ?? "0", 10);
  const m = parseInt(mStr ?? "0", 10);
  const period = h < 12 ? "오전" : "오후";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${period} ${h12}:${String(m).padStart(2, "0")}`;
}

/** 24h "HH:mm" → 시:분만 "12:00", "1:30" (좌측 오전/오후와 중복 방지용) */
function format24To12TimeOnly(hhmm: string): string {
  if (!hhmm) return "12:00";
  const [hStr, mStr] = hhmm.split(":");
  const h = parseInt(hStr ?? "0", 10);
  const m = parseInt(mStr ?? "0", 10);
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${String(m).padStart(2, "0")}`;
}

function slotIndex(hhmm: string): number {
  const [hStr, mStr] = (hhmm || "00:00").split(":");
  const h = parseInt(hStr ?? "0", 10);
  const m = parseInt(mStr ?? "0", 10);
  const idx = h * 2 + Math.round(m / 30);
  return Math.max(0, Math.min(47, idx));
}

function slotTo24h(idx: number): string {
  const i = ((idx % 48) + 48) % 48;
  const h = Math.floor(i / 2);
  const m = (i % 2) * 30;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** idx 0-23 = 오전, 24-47 = 오후 */
function isAfternoon(idx: number): boolean {
  return idx >= 24;
}

/** 오전↔오후 토글: 같은 12h 시각, ±12h */
function flipPeriod(idx: number): number {
  if (idx < 24) return idx + 24; // 오전 → 오후
  return idx - 24; // 오후 → 오전
}

export interface TimeScrollPopoverProps {
  value: string;
  slots: string[];
  slotMinutes: number;
  anchorEl: HTMLElement;
  onSelect: (value: string) => void;
  onClose: () => void;
}

export function TimeScrollPopover({
  value,
  slots: _slots,
  slotMinutes: _slotMinutes,
  anchorEl,
  onSelect,
  onClose,
}: TimeScrollPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const isMountedRef = useRef(false);
  const isJumpingRef = useRef(false);
  const lastIdxRef = useRef(slotIndex(value));
  const scrollEndTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isUserScrollingRef = useRef(false);
  const wheelAccumRef = useRef(0);

  const initialIdx = slotIndex(value);
  const [selectedIdx, setSelectedIdx] = useState(initialIdx);

  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  const emit = useCallback((idx: number) => {
    onSelectRef.current(slotTo24h(idx));
  }, []);

  const scrollToIdx = useCallback((idx: number) => {
    const el = listRef.current;
    if (!el) return;
    isUserScrollingRef.current = false;
    if (scrollEndTimeoutRef.current) {
      clearTimeout(scrollEndTimeoutRef.current);
      scrollEndTimeoutRef.current = null;
    }
    lastIdxRef.current = idx;
    const blockHeight = ALL_SLOTS.length * ROW_HEIGHT;
    const top = blockHeight + idx * ROW_HEIGHT - VISIBLE_HEIGHT / 2 + ROW_HEIGHT / 2;
    el.scrollTop = Math.max(0, Math.min(top, el.scrollHeight - VISIBLE_HEIGHT));
    setSelectedIdx(idx);
    emit(idx);
  }, [emit]);

  // 외부 value 변경 시 동기화 (스크롤 중에는 덮어쓰지 않음)
  useEffect(() => {
    if (isUserScrollingRef.current) return;
    const idx = slotIndex(value);
    lastIdxRef.current = idx;
    setSelectedIdx(idx);
  }, [value]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (scrollEndTimeoutRef.current) {
        clearTimeout(scrollEndTimeoutRef.current);
        scrollEndTimeoutRef.current = null;
      }
    };
  }, []);

  // 초기 스크롤 (마운트 시 1회)
  useLayoutEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const blockHeight = ALL_SLOTS.length * ROW_HEIGHT;
    el.scrollTop =
      blockHeight + initialIdx * ROW_HEIGHT - VISIBLE_HEIGHT / 2 + ROW_HEIGHT / 2;
  }, [initialIdx]);

  // 스크롤 → 인덱스 반영 + 무한 순환 + 스크롤 종료 시에만 emit
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const blockLen = ALL_SLOTS.length;
    const blockHeight = blockLen * ROW_HEIGHT;
    const EMIT_DELAY_MS = 120;

    const handleScroll = () => {
      isUserScrollingRef.current = true;
      if (scrollEndTimeoutRef.current) {
        clearTimeout(scrollEndTimeoutRef.current);
      }
      if (isJumpingRef.current) {
        isJumpingRef.current = false;
      }
      let st = el.scrollTop;
      if (st < blockHeight * 0.5) {
        isJumpingRef.current = true;
        el.scrollTop = st + blockHeight;
        st = el.scrollTop;
      } else if (st > blockHeight * 2 - blockHeight * 0.5) {
        isJumpingRef.current = true;
        el.scrollTop = st - blockHeight;
        st = el.scrollTop;
      }
      const centerY = st + VISIBLE_HEIGHT / 2;
      const row = Math.floor((centerY - ROW_HEIGHT / 2) / ROW_HEIGHT);
      const idx = ((row % blockLen) + blockLen) % blockLen;
      if (idx !== lastIdxRef.current) {
        lastIdxRef.current = idx;
        setSelectedIdx(idx);
      }
      scrollEndTimeoutRef.current = setTimeout(() => {
        scrollEndTimeoutRef.current = null;
        isUserScrollingRef.current = false;
        if (isMountedRef.current) {
          emit(lastIdxRef.current);
        }
      }, EMIT_DELAY_MS);
    };

    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", handleScroll);
      if (scrollEndTimeoutRef.current) {
        clearTimeout(scrollEndTimeoutRef.current);
        scrollEndTimeoutRef.current = null;
      }
    };
  }, [emit]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (anchorEl.contains(t) || popoverRef.current?.contains(t)) return;
      onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [anchorEl, onClose]);

  const handlePeriodClick = useCallback(
    (wantAfternoon: boolean) => {
      const currentlyAfternoon = isAfternoon(selectedIdx);
      if (currentlyAfternoon === wantAfternoon) return;
      const newIdx = flipPeriod(selectedIdx);
      scrollToIdx(newIdx);
    },
    [selectedIdx, scrollToIdx]
  );

  const rect = anchorEl.getBoundingClientRect();
  const isPM = isAfternoon(selectedIdx);

  return (
    <div
      ref={popoverRef}
      className="time-picker"
      style={{
        position: "fixed",
        left: rect.left,
        bottom: window.innerHeight - rect.top + 8,
        width: Math.max(rect.width, 260),
        zIndex: 1100,
      }}
      role="listbox"
      aria-label="시간 선택"
    >
      <div className="time-picker__body">
        {/* 좌측: 오전/오후 시각 + 클릭(같은 시각 AM↔PM) */}
        <div className="time-picker__period">
          <button
            type="button"
            className={`time-picker__period-btn ${!isPM ? "time-picker__period-btn--active" : ""}`}
            onClick={() => handlePeriodClick(false)}
          >
            오전
          </button>
          <button
            type="button"
            className={`time-picker__period-btn ${isPM ? "time-picker__period-btn--active" : ""}`}
            onClick={() => handlePeriodClick(true)}
          >
            오후
          </button>
        </div>

        <div className="time-picker__divider" aria-hidden />

        {/* 우측: 24h 롤러 (시:분만 표시) */}
        <div className="time-picker__roller">
          <div className="time-picker__highlight" aria-hidden />
          <div
            ref={listRef}
            className="time-picker__list"
            style={{ height: VISIBLE_HEIGHT }}
          >
            {[0, 1, 2].map((block) =>
              ALL_SLOTS.map((slot, i) => (
                <button
                  key={`${block}-${slot}`}
                  type="button"
                  className="time-picker__item"
                  style={{ height: ROW_HEIGHT }}
                  onClick={() => scrollToIdx(i)}
                >
                  {format24To12TimeOnly(slot)}
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
