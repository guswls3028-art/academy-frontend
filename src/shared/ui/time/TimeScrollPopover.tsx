// PATH: src/shared/ui/time/TimeScrollPopover.tsx
// 원스크롤 순환: 오전 12:00 ~ 오후 11:45 (12시간제). 글자 깨짐 방지.

import { useEffect, useRef } from "react";
import "./TimeScrollPopover.css";

const ROW_HEIGHT = 44;
const VISIBLE_HEIGHT = 220;

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
  const blockLen = slots.length;
  const totalRows = blockLen * 3;

  const normalized = timeToNearestSlot(value, slots);
  const selectedIndex = slotIndex(slots, normalized);

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
        width: Math.max(rect.width, 140),
        zIndex: 1100,
      }}
      role="listbox"
      aria-label="시간 선택"
    >
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
              {t}
            </button>
          ))
        )}
      </div>
    </div>
  );
}
