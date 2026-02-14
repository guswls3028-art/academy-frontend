// PATH: src/shared/ui/time/TimeScrollPopover.tsx
// 단일 롤러: 00:00~23:30 48슬롯, "오전 9:30" 등으로 표시. 스크롤·클릭으로 선택.

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import "./TimeScrollPopover.css";

const ROW_HEIGHT = 48;
const VISIBLE_ROWS = 5;
const VISIBLE_HEIGHT = ROW_HEIGHT * VISIBLE_ROWS;

/** 24h 30분 단위 48슬롯 */
const ALL_SLOTS = (() => {
  const out: string[] = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 30) {
      out.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
  }
  return out;
})();

/** 24h "HH:mm" → "오전 9:30" / "오후 2:00" */
export function format24To12Display(hhmm: string): string {
  if (!hhmm) return "오전 12:00";
  const [hStr, mStr] = hhmm.split(":");
  const h = parseInt(hStr ?? "0", 10);
  const m = parseInt(mStr ?? "0", 10);
  const period = h < 12 ? "오전" : "오후";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${period} ${h12}:${String(m).padStart(2, "0")}`;
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

  const initialIdx = slotIndex(value);
  const [selectedIdx, setSelectedIdx] = useState(initialIdx);

  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  const emit = useCallback((idx: number) => {
    onSelectRef.current(slotTo24h(idx));
  }, []);

  useEffect(() => {
    setSelectedIdx(slotIndex(value));
  }, [value]);

  useEffect(() => {
    emit(selectedIdx);
  }, [selectedIdx, emit]);

  // 초기 스크롤
  useLayoutEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const blockHeight = ALL_SLOTS.length * ROW_HEIGHT;
    el.scrollTop =
      blockHeight + initialIdx * ROW_HEIGHT - VISIBLE_HEIGHT / 2 + ROW_HEIGHT / 2;
  }, [initialIdx]);

  // 스크롤 → 인덱스 + 무한 순환
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const blockLen = ALL_SLOTS.length;
    const blockHeight = blockLen * ROW_HEIGHT;

    const handleScroll = () => {
      let st = el.scrollTop;
      if (st < blockHeight * 0.5) {
        el.scrollTop = st + blockHeight;
        st = el.scrollTop;
      } else if (st > blockHeight * 2 - blockHeight * 0.5) {
        el.scrollTop = st - blockHeight;
        st = el.scrollTop;
      }
      const centerY = st + VISIBLE_HEIGHT / 2;
      const row = Math.floor((centerY - ROW_HEIGHT / 2) / ROW_HEIGHT);
      const idx = ((row % blockLen) + blockLen) % blockLen;
      setSelectedIdx(idx);
    };

    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (anchorEl.contains(t) || popoverRef.current?.contains(t)) return;
      onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [anchorEl, onClose]);

  const scrollTo = useCallback((idx: number) => {
    const el = listRef.current;
    if (!el) return;
    const blockHeight = ALL_SLOTS.length * ROW_HEIGHT;
    const top = blockHeight + idx * ROW_HEIGHT - VISIBLE_HEIGHT / 2 + ROW_HEIGHT / 2;
    el.scrollTo({ top, behavior: "smooth" });
    setSelectedIdx(idx);
  }, []);

  const rect = anchorEl.getBoundingClientRect();

  return (
    <div
      ref={popoverRef}
      className="time-picker"
      style={{
        position: "fixed",
        left: rect.left,
        bottom: window.innerHeight - rect.top + 8,
        width: Math.max(rect.width, 220),
        zIndex: 1100,
      }}
      role="listbox"
      aria-label="시간 선택"
    >
      <div className="time-picker__body">
        <div className="time-picker__roller">
          <div className="time-picker__mask time-picker__mask--top" />
          <div className="time-picker__mask time-picker__mask--bottom" />
          <div className="time-picker__highlight" />
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
                  onClick={() => scrollTo(i)}
                >
                  {format24To12Display(slot)}
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
