// PATH: src/shared/ui/time/TimeScrollPopover.tsx
// 오전 | 시간 롤링 — 둘 다 같은 원통형 롤러, 스크롤/마우스로 선택.

import { useCallback, useEffect, useRef, useState } from "react";
import "./TimeScrollPopover.css";

const ROW_HEIGHT = 48;
const VISIBLE_ROWS = 5;
const VISIBLE_HEIGHT = ROW_HEIGHT * VISIBLE_ROWS;
const PERIOD_SLOTS = ["오전", "오후"] as const;

/** 12시간제 슬롯 (30분 간격): 12:00, 12:30, 1:00, ..., 11:30 */
const TIME_12_SLOTS = (() => {
  const out: string[] = [];
  for (let i = 0; i < 24; i++) {
    const totalMin = i * 30;
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    const h12 = h === 0 ? 12 : h;
    out.push(`${h12}:${String(m).padStart(2, "0")}`);
  }
  return out;
})();

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

/** periodIndex(0=오전,1=오후) + timeIndex(0~23) → 24h "HH:mm" */
function to24h(periodIndex: number, timeIndex: number): string {
  const totalMin = timeIndex * 30;
  const h12 = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  const h24 =
    periodIndex === 0
      ? (h12 === 0 ? 0 : h12)
      : (h12 === 0 ? 12 : 12 + h12);
  return `${String(h24).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** 24h "HH:mm" → periodIndex, timeIndex */
function from24h(hhmm: string): { periodIndex: number; timeIndex: number } {
  const [hStr, mStr] = (hhmm || "00:00").split(":");
  const h = parseInt(hStr ?? "0", 10);
  const m = parseInt(mStr ?? "0", 10);
  const totalMin = h * 60 + m;
  const periodIndex = h < 12 ? 0 : 1;
  const timeTotalMin = h < 12 ? totalMin : totalMin - 12 * 60;
  const timeIndex = Math.round(timeTotalMin / 30) % 24;
  return { periodIndex, timeIndex: Math.max(0, Math.min(23, timeIndex)) };
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

export function TimeScrollPopover({
  value,
  slots,
  anchorEl,
  onSelect,
  onClose,
}: TimeScrollPopoverProps) {
  const periodScrollRef = useRef<HTMLDivElement>(null);
  const timeScrollRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const normalized = timeToNearestSlot(value, slots);
  const { periodIndex, timeIndex } = from24h(normalized);

  const commitValue = useCallback(
    (pIdx: number, tIdx: number) => {
      onSelect(to24h(pIdx, tIdx));
    },
    [onSelect]
  );

  // 무한 순환 스크롤 설정
  const setupCycleScroll = useCallback(
    (
      el: HTMLDivElement | null,
      itemCount: number,
      selectedIndex: number,
      onIndexChange: (idx: number) => void
    ) => {
      if (!el) return;
      const blockHeight = itemCount * ROW_HEIGHT;
      const initScroll =
        blockHeight +
        selectedIndex * ROW_HEIGHT -
        VISIBLE_HEIGHT / 2 +
        ROW_HEIGHT / 2;
      el.scrollTop = Math.max(
        0,
        Math.min(initScroll, el.scrollHeight - VISIBLE_HEIGHT)
      );

      const handler = () => {
        const st = el.scrollTop;
        if (st < ROW_HEIGHT) el.scrollTop = st + blockHeight;
        else if (st > blockHeight * 2 - ROW_HEIGHT) el.scrollTop = st - blockHeight;
        const centerRow =
          (st + VISIBLE_HEIGHT / 2 - ROW_HEIGHT / 2) / ROW_HEIGHT;
        const idx =
          (Math.floor(centerRow) % itemCount + itemCount) % itemCount;
        onIndexChange(idx);
      };

      el.addEventListener("scroll", handler, { passive: true });
      return () => el.removeEventListener("scroll", handler);
    },
    []
  );

  const [periodIdx, setPeriodIdx] = useState(periodIndex);
  const [timeIdx, setTimeIdx] = useState(timeIndex);

  useEffect(() => {
    setPeriodIdx(periodIndex);
    setTimeIdx(timeIndex);
  }, [periodIndex, timeIndex, value]);

  useEffect(() => {
    const unsubP = setupCycleScroll(
      periodScrollRef.current,
      PERIOD_SLOTS.length,
      periodIdx,
      setPeriodIdx
    );
    return () => unsubP?.();
  }, [setupCycleScroll, PERIOD_SLOTS.length]);

  useEffect(() => {
    const unsubT = setupCycleScroll(
      timeScrollRef.current,
      TIME_12_SLOTS.length,
      timeIdx,
      setTimeIdx
    );
    return () => unsubT?.();
  }, [setupCycleScroll, TIME_12_SLOTS.length]);

  useEffect(() => {
    commitValue(periodIdx, timeIdx);
  }, [periodIdx, timeIdx, commitValue]);

  useEffect(() => {
    const elP = periodScrollRef.current;
    const elT = timeScrollRef.current;
    if (!elP || !elT) return;
    const blockP = PERIOD_SLOTS.length * ROW_HEIGHT;
    const blockT = TIME_12_SLOTS.length * ROW_HEIGHT;
    elP.scrollTop =
      blockP +
      periodIdx * ROW_HEIGHT -
      VISIBLE_HEIGHT / 2 +
      ROW_HEIGHT / 2;
    elT.scrollTop =
      blockT +
      timeIdx * ROW_HEIGHT -
      VISIBLE_HEIGHT / 2 +
      ROW_HEIGHT / 2;
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (anchorEl.contains(target)) return;
      if (popoverRef.current?.contains(target)) return;
      onClose();
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [anchorEl, onClose]);

  const rect = anchorEl.getBoundingClientRect();

  return (
    <div
      ref={popoverRef}
      className="shared-time-scroll-popover shared-time-scroll-popover--cylinder"
      style={{
        position: "fixed",
        left: rect.left,
        bottom: window.innerHeight - rect.top + 8,
        width: Math.max(rect.width, 240),
        zIndex: 1100,
      }}
      role="listbox"
      aria-label="시간 선택"
    >
      <div className="shared-time-scroll-popover-layout">
        {/* 오전 | 오후 롤러 — 시간과 같은 원통형 디자인 */}
        <div className="shared-time-scroll-popover-cylinder shared-time-scroll-popover-cylinder--period">
          <div
            className="shared-time-scroll-popover-mask shared-time-scroll-popover-mask--top"
            aria-hidden
          />
          <div
            className="shared-time-scroll-popover-mask shared-time-scroll-popover-mask--bottom"
            aria-hidden
          />
          <div
            ref={periodScrollRef}
            className="shared-time-scroll-popover-list"
            style={{ height: VISIBLE_HEIGHT }}
          >
            {[0, 1, 2].map((block) =>
              PERIOD_SLOTS.map((label) => (
                <button
                  key={`${block}-${label}`}
                  type="button"
                  className="shared-time-scroll-popover-item"
                  style={{ height: ROW_HEIGHT }}
                  onClick={() => {
                    const idx = PERIOD_SLOTS.indexOf(label);
                    setPeriodIdx(idx);
                    commitValue(idx, timeIdx);
                    const el = periodScrollRef.current;
                    if (el) {
                      const blockHeight = PERIOD_SLOTS.length * ROW_HEIGHT;
                      el.scrollTop =
                        blockHeight +
                        idx * ROW_HEIGHT -
                        VISIBLE_HEIGHT / 2 +
                        ROW_HEIGHT / 2;
                    }
                  }}
                >
                  {label}
                </button>
              ))
            )}
          </div>
        </div>

        <div className="shared-time-scroll-popover-divider" aria-hidden>
          |
        </div>

        {/* 시간 롤러 */}
        <div className="shared-time-scroll-popover-cylinder">
          <div
            className="shared-time-scroll-popover-mask shared-time-scroll-popover-mask--top"
            aria-hidden
          />
          <div
            className="shared-time-scroll-popover-mask shared-time-scroll-popover-mask--bottom"
            aria-hidden
          />
          <div
            ref={timeScrollRef}
            className="shared-time-scroll-popover-list"
            style={{ height: VISIBLE_HEIGHT }}
          >
            {[0, 1, 2].map((block) =>
              TIME_12_SLOTS.map((t) => (
                <button
                  key={`${block}-${t}`}
                  type="button"
                  className="shared-time-scroll-popover-item"
                  style={{ height: ROW_HEIGHT }}
                  onClick={() => {
                    const idx = TIME_12_SLOTS.indexOf(t);
                    setTimeIdx(idx);
                    commitValue(periodIdx, idx);
                    const el = timeScrollRef.current;
                    if (el) {
                      const blockHeight = TIME_12_SLOTS.length * ROW_HEIGHT;
                      el.scrollTop =
                        blockHeight +
                        idx * ROW_HEIGHT -
                        VISIBLE_HEIGHT / 2 +
                        ROW_HEIGHT / 2;
                    }
                  }}
                >
                  {t}
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
