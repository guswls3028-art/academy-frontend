// PATH: src/shared/ui/time/TimeRangeInput.tsx
// 전역 SSOT: 시작/종료 시간 + 시계(타임 피커) 열기 / [+−30분·1시간] 버튼. 마우스 조작 친화.

import { useRef } from "react";
import { Clock } from "lucide-react";
import dayjs from "dayjs";
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

export default function TimeRangeInput({
  value,
  onChange,
  disabled = false,
  startPlaceholder = "00:00",
  endPlaceholder = "00:00",
}: TimeRangeInputProps) {
  const startInputRef = useRef<HTMLInputElement>(null);
  const endInputRef = useRef<HTMLInputElement>(null);
  const { start, end } = parseRange(value);

  const openStartPicker = () => {
    if (typeof startInputRef.current?.showPicker === "function") {
      startInputRef.current.showPicker();
    } else {
      startInputRef.current?.focus();
    }
  };
  const openEndPicker = () => {
    if (typeof endInputRef.current?.showPicker === "function") {
      endInputRef.current.showPicker();
    } else {
      endInputRef.current?.focus();
    }
  };

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
            <input
              ref={startInputRef}
              type="time"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              disabled={disabled}
              className="shared-time-range-input"
              placeholder={startPlaceholder}
              aria-label="시작 시간 선택"
            />
            <button
              type="button"
              className="shared-time-range-picker-trigger"
              onClick={openStartPicker}
              disabled={disabled}
              aria-label="시작 시간 시계로 선택"
              title="시계로 시간 선택"
            >
              <span className="shared-time-range-picker-icon" aria-hidden>🕐</span>
            </button>
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
            <input
              ref={endInputRef}
              type="time"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              disabled={disabled}
              className="shared-time-range-input"
              placeholder={endPlaceholder}
              aria-label="종료 시간 선택"
            />
            <button
              type="button"
              className="shared-time-range-picker-trigger"
              onClick={openEndPicker}
              disabled={disabled}
              aria-label="종료 시간 시계로 선택"
              title="시계로 시간 선택"
            >
              <span className="shared-time-range-picker-icon" aria-hidden>🕐</span>
            </button>
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
