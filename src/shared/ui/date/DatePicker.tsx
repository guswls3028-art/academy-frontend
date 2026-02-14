// PATH: src/shared/ui/date/DatePicker.tsx
// 전역 SSOT: 프로젝트 내 모든 날짜 선택에서 사용하는 통일된 달력 UI (큼지막한 셀, 일관된 디자인)

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";
import dayjs, { type Dayjs } from "dayjs";
import "./DatePicker.css";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
const CELL_SIZE = 44;
const CALENDAR_MIN_WIDTH = 336;

export interface DatePickerProps {
  value: string; // YYYY-MM-DD
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  "data-testid"?: string;
}

function toDayjs(s: string): Dayjs | null {
  if (!s?.trim()) return null;
  const d = dayjs(s, "YYYY-MM-DD", true);
  return d.isValid() ? d : null;
}

function toValue(d: Dayjs): string {
  return d.format("YYYY-MM-DD");
}

export default function DatePicker({
  value,
  onChange,
  placeholder = "날짜 선택",
  disabled = false,
  id,
  "data-testid": dataTestId,
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState<Dayjs>(() => toDayjs(value) || dayjs());
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [dropdownStyle, setDropdownStyle] = useState<{ top?: number; bottom?: number; left: number } | null>(null);

  const selected = toDayjs(value);
  const today = dayjs();

  // value가 바뀌면 viewMonth 동기화
  useEffect(() => {
    const v = toDayjs(value);
    if (v) setViewMonth(v);
  }, [value]);

  // 포털로 body에 렌더해 overflow 잘림 방지. position: fixed 좌표 계산
  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const space = 8;
    const dropdownHeight = 380; // 대략적 달력 높이
    const viewportBottom = window.innerHeight - rect.bottom;
    const fitsBelow = viewportBottom >= dropdownHeight + space;
    if (fitsBelow) {
      setDropdownStyle({ top: rect.bottom + space, left: rect.left });
    } else {
      setDropdownStyle({ bottom: window.innerHeight - rect.top + space, left: rect.left });
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (containerRef.current && !containerRef.current.contains(target)) {
        const popup = document.querySelector(".shared-date-picker-dropdown--portaled");
        if (!popup?.contains(target)) setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const start = viewMonth.startOf("month");
  const end = viewMonth.endOf("month");
  const startCell = start.day();
  const daysInMonth = end.date();
  const prevMonth = viewMonth.subtract(1, "month");
  const nextMonth = viewMonth.add(1, "month");

  const cells: (number | null)[] = [];
  for (let i = 0; i < startCell; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  function handleSelect(d: number) {
    const d2 = viewMonth.date(d);
    onChange(toValue(d2));
    setOpen(false);
  }

  const displayText = value ? dayjs(value).format("YYYY년 MM월 DD일") : placeholder;

  return (
    <div ref={containerRef} className="shared-date-picker" style={{ position: "relative" }}>
      <button
        ref={triggerRef}
        type="button"
        id={id}
        data-testid={dataTestId}
        onClick={() => !disabled && setOpen((o) => !o)}
        disabled={disabled}
        className="shared-date-picker-trigger"
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span className={value ? "" : "shared-date-picker-placeholder"}>{displayText}</span>
      </button>

      {open && (
        <div
          className="shared-date-picker-dropdown"
          role="dialog"
          aria-label="날짜 선택"
          style={{
            minWidth: CALENDAR_MIN_WIDTH,
            width: "max-content",
          }}
        >
          <div className="shared-date-picker-header">
            <button
              type="button"
              className="shared-date-picker-nav"
              onClick={() => setViewMonth(prevMonth)}
              aria-label="이전 달"
            >
              ‹
            </button>
            <span className="shared-date-picker-title" aria-live="polite">
              {viewMonth.format("YYYY년 MM월")}
            </span>
            <button
              type="button"
              className="shared-date-picker-nav"
              onClick={() => setViewMonth(nextMonth)}
              aria-label="다음 달"
            >
              ›
            </button>
          </div>

          <div className="shared-date-picker-weekdays">
            {WEEKDAYS.map((w) => (
              <span key={w} className="shared-date-picker-weekday">
                {w}
              </span>
            ))}
          </div>

          <div
            className="shared-date-picker-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(7, 1fr)",
              gap: 4,
            }}
          >
            {cells.map((d, i) => {
              if (d === null) return <div key={`empty-${i}`} />;
              const cellDate = viewMonth.date(d);
              const valueStr = toValue(cellDate);
              const isSelected = selected && toValue(selected) === valueStr;
              const isToday = toValue(today) === valueStr;
              return (
                <button
                  key={valueStr}
                  type="button"
                  className={`shared-date-picker-cell ${isSelected ? "shared-date-picker-cell-selected" : ""} ${isToday ? "shared-date-picker-cell-today" : ""}`}
                  onClick={() => handleSelect(d)}
                  style={{ width: CELL_SIZE, height: CELL_SIZE }}
                >
                  {d}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
