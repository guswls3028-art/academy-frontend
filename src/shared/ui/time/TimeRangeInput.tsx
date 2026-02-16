// PATH: src/shared/ui/time/TimeRangeInput.tsx
// 전역 SSOT: 시작/종료 시간 — 12시간제(오전/오후) 원스크롤 순환, 시간 영역 클릭 시 피커, [+−30분·1시간].
// 모달 SSOT: startLabel "시작" / endLabel "종료" 시 트리거 빈값 문구는 "시작 시간" / "종료 시간" 단일진실.

import { useRef, useState } from "react";
import { Clock, ChevronDown } from "lucide-react";
import dayjs from "dayjs";
import { TimeScrollPopover, format24To12Display } from "./TimeScrollPopover";
import "@/styles/design-system/components/TimeRangeInput.css";

export interface TimeRangeInputProps {
  /** "HH:mm~HH:mm" 형식 */
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  startPlaceholder?: string;
  endPlaceholder?: string;
  /** 레이블 짧게 쓸 때 (모달 등): "시작" "종료" → 줄바꿈 방지 */
  startLabel?: string;
  endLabel?: string;
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

const SLOT_MINUTES = 30; // 30분 단위 순환 선택
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
  startLabel = "시작시간",
  endLabel = "종료시간",
}: TimeRangeInputProps) {
  const startAnchorRef = useRef<HTMLDivElement>(null);
  const endAnchorRef = useRef<HTMLDivElement>(null);
  const [openStart, setOpenStart] = useState(false);
  const [openEnd, setOpenEnd] = useState(false);
  const { start, end } = parseRange(value);

  /** 모달 SSOT: 레이블 "시작"/"종료"일 때 트리거 빈값 문구 "시작 시간"/"종료 시간" */
  const startTriggerPlaceholder =
    startLabel === "시작" ? "시작 시간" : startPlaceholder === "00:00" ? "오전 12:00" : startPlaceholder;
  const endTriggerPlaceholder =
    endLabel === "종료" ? "종료 시간" : endPlaceholder === "00:00" ? "오전 12:00" : endPlaceholder;

  const setStart = (v: string) => onChange(formatRange(toHHmm(v) || v, end));
  const setEnd = (v: string) => onChange(formatRange(start, toHHmm(v) || v));

  const addToEnd = (deltaMinutes: number) => {
    const base = end || start || "09:00";
    const effectiveStart = start || base;
    const nextEnd = addMinutes(base, deltaMinutes);
    onChange(formatRange(effectiveStart, nextEnd));
  };

  const subtractFromEnd = (deltaMinutes: number) => {
    const effectiveEnd = end || start || "09:30";
    const effectiveStart = start || "09:00";
    const nextEnd = clampEndAboveStart(effectiveEnd, effectiveStart, deltaMinutes);
    onChange(formatRange(effectiveStart, nextEnd));
  };

  return (
    <div className="shared-time-range">
      <div className="shared-time-range-card">
        <div className="shared-time-range-grid">
          <label className="shared-time-range-label">{startLabel}</label>
          <div className="shared-time-range-input-wrap">
            <div
              ref={startAnchorRef}
              role="button"
              tabIndex={disabled ? -1 : 0}
              className={`shared-time-range-trigger ${!start ? "shared-time-range-trigger--placeholder" : ""}`}
              onClick={() => {
                if (disabled) return;
                setOpenEnd(false);
                setOpenStart((prev) => !prev);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !disabled) {
                  setOpenEnd(false);
                  setOpenStart((prev) => !prev);
                }
              }}
              aria-label="시작 시간 선택"
            >
              <Clock className="shared-time-range-trigger-clock" size={20} aria-hidden />
              <span className="shared-time-range-trigger-text">
                {start ? format24To12Display(start) : startTriggerPlaceholder}
              </span>
              <ChevronDown className="shared-time-range-trigger-icon" size={18} aria-hidden />
            </div>
            {openStart && startAnchorRef.current && (
              <TimeScrollPopover
                value={start || "00:00"}
                slots={SLOTS}
                slotMinutes={SLOT_MINUTES}
                anchorEl={startAnchorRef.current}
                onSelect={(v) => setStart(v)}
                onClose={() => setOpenStart(false)}
              />
            )}
          </div>
          <div className="shared-time-range-quick">
            <button
              type="button"
              className="shared-time-range-btn"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                addToEnd(30);
              }}
              disabled={disabled}
            >
              +30분
            </button>
            <button
              type="button"
              className="shared-time-range-btn"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                addToEnd(60);
              }}
              disabled={disabled}
            >
              +1시간
            </button>
          </div>

          <label className="shared-time-range-label">{endLabel}</label>
          <div className="shared-time-range-input-wrap">
            <div
              ref={endAnchorRef}
              role="button"
              tabIndex={disabled ? -1 : 0}
              className={`shared-time-range-trigger ${!end ? "shared-time-range-trigger--placeholder" : ""}`}
              onClick={() => {
                if (disabled) return;
                setOpenStart(false);
                setOpenEnd((prev) => !prev);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !disabled) {
                  setOpenStart(false);
                  setOpenEnd((prev) => !prev);
                }
              }}
              aria-label="종료 시간 선택"
            >
              <Clock className="shared-time-range-trigger-clock" size={20} aria-hidden />
              <span className="shared-time-range-trigger-text">
                {end ? format24To12Display(end) : endTriggerPlaceholder}
              </span>
              <ChevronDown className="shared-time-range-trigger-icon" size={18} aria-hidden />
            </div>
            {openEnd && endAnchorRef.current && (
              <TimeScrollPopover
                value={end || "00:00"}
                slots={SLOTS}
                slotMinutes={SLOT_MINUTES}
                anchorEl={endAnchorRef.current}
                onSelect={(v) => setEnd(v)}
                onClose={() => setOpenEnd(false)}
              />
            )}
          </div>
          <div className="shared-time-range-quick">
            <button
              type="button"
              className="shared-time-range-btn"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                subtractFromEnd(30);
              }}
              disabled={disabled}
            >
              −30분
            </button>
            <button
              type="button"
              className="shared-time-range-btn"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                subtractFromEnd(60);
              }}
              disabled={disabled}
            >
              −1시간
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
