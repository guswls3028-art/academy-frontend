// PATH: src/shared/ui/time/TimeScrollPopover.tsx
// 오전 | 12시간 스크롤 | 오후 — 스크롤 시 오전/오후 자동 반영, 클릭 시 반영.

import { useEffect, useRef, useState } from "react";
import "./TimeScrollPopover.css";

const ROW_HEIGHT = 48;
const VISIBLE_ROWS = 5;
const VISIBLE_HEIGHT = ROW_HEIGHT * VISIBLE_ROWS;
const SLOTS_PER_PERIOD = 24; // 12h * 2 (30min)

/** 24h "HH:mm" → "오전/오후 H:mm" (12시간제 표시) */
export function format24To12Display(hhmm: string): string {
  if (!hhmm) return "오전 12:00";
  const [hStr, mStr] = hhmm.split(":");
  const h = parseInt(hStr ?? "0", 10);
  const m = parseInt(mStr ?? "0", 10);
  const period = h < 12 ? "오전" : "오후";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${period} ${h12}:${String(m).padStart(2, "0")}`;
}

/** 24h "HH:mm" → 12시간 부분만 "12:00", "1:00" 등 */
function format24To12PartOnly(hhmm: string): string {
  if (!hhmm) return "12:00";
  const [hStr, mStr] = hhmm.split(":");
  const h = parseInt(hStr ?? "0", 10);
  const m = parseInt(mStr ?? "0", 10);
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${String(m).padStart(2, "0")}`;
}

export interface TimeScrollPopoverProps {
  value: string;
  slots: string[];
  slotMinutes: number;
  anchorEl: HTMLElement;
  onSelect: (value: string) => void;
  onClose: () => void;
}

function timeToNearestSlot(hhmm: string, slots: string[]): string {
  if (!hhmm) return slots[0] ?? "00:00";
  const [h, m] = hhmm.split(":").map((x) => parseInt(x, 10));
  const totalM = (h ?? 0) * 60 + (m ?? 0);
  let best = slots[0];
  let bestDiff = 24 * 60;
  for (const s of slots) {
    const [sh, sm] = s.split(":").map((x) => parseInt(x, 10));
    const stotal = sh * 60 + sm;
    const diff = Math.abs(totalM - stotal);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = s;
    }
  }
  return best;
}

function slotIndex(slots: string[], slot: string): number {
  const i = slots.indexOf(slot);
  return i >= 0 ? i : 0;
}

export function TimeScrollPopover({
  value,
  slots,
  anchorEl,
  onSelect,
  onClose,
}: TimeScrollPopoverProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [periodLabel, setPeriodLabel] = useState<"오전" | "오후">("오전");
  const blockLen = slots.length;

  const normalized = timeToNearestSlot(value, slots);
  const selectedIndex = slotIndex(slots, normalized);

  useEffect(() => {
    setPeriodLabel(selectedIndex < SLOTS_PER_PERIOD ? "오전" : "오후");
  }, [selectedIndex]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const blockHeight = blockLen * ROW_HEIGHT;
    const initialScroll = blockHeight + selectedIndex * ROW_HEIGHT - VISIBLE_HEIGHT / 2 + ROW_HEIGHT / 2;
    el.scrollTop = Math.max(0, Math.min(initialScroll, el.scrollHeight - VISIBLE_HEIGHT));
  }, [blockLen, selectedIndex]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const blockHeight = blockLen * ROW_HEIGHT;

    function onScroll() {
      const st = el.scrollTop;
      if (st < ROW_HEIGHT) {
        el.scrollTop = st + blockHeight;
      } else if (st > blockHeight * 2 - ROW_HEIGHT) {
        el.scrollTop = st - blockHeight;
      }
      const centerRow = (st + VISIBLE_HEIGHT / 2 - ROW_HEIGHT / 2) / ROW_HEIGHT;
      const idx = (Math.floor(centerRow) % blockLen + blockLen) % blockLen;
      setPeriodLabel(idx < SLOTS_PER_PERIOD ? "오전" : "오후");
    }
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [blockLen]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (anchorEl.contains(target)) return;
      if (scrollRef.current?.contains(target)) return;
      onClose();
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [anchorEl, onClose]);

  const rect = anchorEl.getBoundingClientRect();

  return (
    <div
      className="shared-time-scroll-popover"
      style={{
        position: "fixed",
        left: rect.left,
        bottom: window.innerHeight - rect.top + 6,
        width: Math.max(rect.width, 180),
        zIndex: 1100,
      }}
      role="listbox"
      aria-label="시간 선택"
    >
      <div className="shared-time-scroll-popover-layout">
        <div className="shared-time-scroll-popover-period" aria-live="polite">
          {periodLabel}
        </div>
        <div
          ref={scrollRef}
          className="shared-time-scroll-popover-list"
          style={{ height: VISIBLE_HEIGHT }}
        >
          {[0, 1, 2].map((block) =>
            slots.map((t) => (
              <button
                key={`${block}-${t}`}
                type="button"
                className="shared-time-scroll-popover-item"
                style={{ height: ROW_HEIGHT }}
                onClick={() => onSelect(t)}
              >
                {format24To12PartOnly(t)}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
