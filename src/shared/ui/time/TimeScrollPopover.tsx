// PATH: src/shared/ui/time/TimeScrollPopover.tsx
// 원테이크 스크롤: 00:00~24:00(23:45) 순환 시간 선택. 글자 깨짐 방지(폰트·줄바꿈 명시).

import { useEffect, useRef } from "react";
import "./TimeScrollPopover.css";

const ROW_HEIGHT = 44;
const VISIBLE_HEIGHT = 220;

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
