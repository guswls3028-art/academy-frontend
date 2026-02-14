// PATH: src/shared/ui/time/TimeRangeInput.tsx
// 전역 SSOT: 시작/종료 시간 — 시간 영역 클릭 시 원테이크 스크롤 피커, [+−30분·1시간] 버튼.

import { useRef, useState, useEffect } from "react";
import dayjs from "dayjs";
import { TimeScrollPopover } from "./TimeScrollPopover";
import "./TimeRangeInput.css";

export interface TimeRangeInputProps {
  /** "HH:mm~HH:mm" 형식 */
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  startPlaceholder?: string;
  endPlaceholder?: string;
}

function parseRange(value: string): { start: string; end: string } {
  const s = (value || "").trim();
  const idx = s.indexOf("~");
  if (idx >= 0) {
    const start = s.slice(0, idx).trim();
    const end = s.slice(idx + 1).trim();
    return { start: toHHmm(start) || "", end: toHHmm(end) || "" };
  }
  if (s) {
    const t = toHHmm(s);
    return { start: t || "", end: "" };
  }
  return { start: "", end: "" };
}

function toHHmm(s: string): string {
  if (!s?.trim()) return "";
  const m = s.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return "";
  const h = Math.max(0, Math.min(23, parseInt(m[1], 10)));
  const min = Math.max(0, Math.min(59, parseInt(m[2], 10)));
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

function formatRange(start: string, end: string): string {
  if (!start) return "";
  if (!end) return start;
  return `${start}~${end}`;
}

function addMinutes(timeStr: string, minutes: number): string {
  if (!timeStr) return "";
  const [h, m] = timeStr.split(":").map((x) => parseInt(x, 10));
  const d = dayjs().hour(h).minute(m).add(minutes, "minute");
  return d.format("HH:mm");
}

/** end에서 분을 빼되, start보다 작아지지 않도록 함 */
function clampEndAboveStart(endStr: string, startStr: string, deltaMinutes: number): string {
  if (!endStr) return "";
  const next = addMinutes(endStr, -deltaMinutes);
  if (!startStr) return next;
  const startM = dayjs().hour(parseInt(startStr.slice(0, 2), 10)).minute(parseInt(startStr.slice(3), 10));
  const nextM = dayjs().hour(parseInt(next.slice(0, 2), 10)).minute(parseInt(next.slice(3), 10));
  if (nextM.isBefore(startM) || nextM.isSame(startM)) return startStr;
  return next;
}

const SLOT_MINUTES = 15;
const SLOTS = (() => {
  const out: string[] = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += SLOT_MINUTES) {
      out.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
  }
  return out;
})();

export default function TimeRangeInput({
  value,
  onChange,
  disabled = false,
  startPlaceholder = "00:00",
  endPlaceholder = "00:00",
}: TimeRangeInputProps) {
  const startAnchorRef = useRef<HTMLDivElement>(null);
  const endAnchorRef = useRef<HTMLDivElement>(null);
  const [openStart, setOpenStart] = useState(false);
  const [openEnd, setOpenEnd] = useState(false);
  const { start, end } = parseRange(value);

  const setStart = (v: string) => onChange(formatRange(toHHmm(v) || v, end));
  const setEnd = (v: string) => onChange(formatRange(start, toHHmm(v) || v));

  const addToEnd = (deltaMinutes: number) => {
    const base = end || start;
    if (!base) return;
    const nextEnd = addMinutes(base, deltaMinutes);
    onChange(formatRange(start, nextEnd));
  };

  const subtractFromEnd = (deltaMinutes: number) => {
    if (!end) return;
    const nextEnd = clampEndAboveStart(end, start, deltaMinutes);
    onChange(formatRange(start, nextEnd));
  };

  return (
    <div className="shared-time-range">
      <div className="shared-time-range-card">
        <div className="shared-time-range-grid">
          <label className="shared-time-range-label">시작시간</label>
          <div className="shared-time-range-input-wrap">
            <div
              ref={startAnchorRef}
              role="button"
              tabIndex={disabled ? -1 : 0}
              className={`shared-time-range-input shared-time-range-input-trigger ${!start ? "shared-time-range-input--placeholder" : ""}`}
              onClick={() => !disabled && setOpenStart(true)}
              onKeyDown={(e) => e.key === "Enter" && !disabled && setOpenStart(true)}
              aria-label="시작 시간 선택"
            >
              {start || startPlaceholder}
            </div>
            {openStart && startAnchorRef.current && (
              <TimeScrollPopover
                value={start || "00:00"}
                slots={SLOTS}
                slotMinutes={SLOT_MINUTES}
                anchorEl={startAnchorRef.current}
                onSelect={(v) => {
                  setStart(v);
                  setOpenStart(false);
                }}
                onClose={() => setOpenStart(false)}
              />
            )}
          </div>
          <div className="shared-time-range-quick">
            <button
              type="button"
              className="shared-time-range-btn"
              onClick={() => addToEnd(30)}
              disabled={disabled || !start}
            >
              +30분
            </button>
            <button
              type="button"
              className="shared-time-range-btn"
              onClick={() => addToEnd(60)}
              disabled={disabled || !start}
            >
              +1시간
            </button>
          </div>

          <label className="shared-time-range-label">종료시간</label>
          <div className="shared-time-range-input-wrap">
            <div
              ref={endAnchorRef}
              role="button"
              tabIndex={disabled ? -1 : 0}
              className="shared-time-range-input shared-time-range-input-trigger"
              onClick={() => !disabled && setOpenEnd(true)}
              onKeyDown={(e) => e.key === "Enter" && !disabled && setOpenEnd(true)}
              aria-label="종료 시간 선택"
            >
              {end || endPlaceholder}
            </div>
            {openEnd && endAnchorRef.current && (
              <TimeScrollPopover
                value={end || "00:00"}
                slots={SLOTS}
                slotMinutes={SLOT_MINUTES}
                anchorEl={endAnchorRef.current}
                onSelect={(v) => {
                  setEnd(v);
                  setOpenEnd(false);
                }}
                onClose={() => setOpenEnd(false)}
              />
            )}
          </div>
          <div className="shared-time-range-quick">
            <button
              type="button"
              className="shared-time-range-btn"
              onClick={() => subtractFromEnd(30)}
              disabled={disabled || !end || (!!start && !!end && end <= start)}
            >
              −30분
            </button>
            <button
              type="button"
              className="shared-time-range-btn"
              onClick={() => subtractFromEnd(60)}
              disabled={disabled || !end || (!!start && !!end && end <= start)}
            >
              −1시간
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
