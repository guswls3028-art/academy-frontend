// PATH: src/shared/ui/date/DatePicker.tsx
// 전역 단일 SSOT: 차시 생성 모달(ModalDateSection)에 쓰는 달력과 동일한 컴포넌트. 그대로 사용만 하고, 여기서 창조·추가 로직 금지.

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";
import dayjs, { type Dayjs } from "dayjs";
import { Calendar } from "lucide-react";
import "@/styles/design-system/components/DatePicker.css";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
const CELL_SIZE = 44;
const CALENDAR_MIN_WIDTH = 336;

export interface DatePickerProps {
  value: string; // YYYY-MM-DD
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  /** true면 드롭다운을 트리거 아래로만 열림 (예: 클리닉 생성) */
  openBelow?: boolean;
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
  openBelow = false,
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

  useLayoutEffect(() => {
    if (!open) {
      setDropdownStyle(null);
      return;
    }
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const space = 8;
    if (openBelow) {
      setDropdownStyle({ top: rect.bottom + space, left: rect.left });
    } else {
      setDropdownStyle({
        bottom: window.innerHeight - rect.top + space,
        left: rect.left,
      });
    }
  }, [open, openBelow]);

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
        <Calendar className="shared-date-picker-trigger-icon" size={18} aria-hidden />
        <span className={value ? "" : "shared-date-picker-placeholder"}>{displayText}</span>
      </button>

      {open && dropdownStyle && ReactDOM.createPortal(
        <div
          className={`shared-date-picker-dropdown shared-date-picker-dropdown--portaled ${openBelow ? "shared-date-picker-dropdown--open-below" : ""}`}
          role="dialog"
          aria-label="날짜 선택"
          style={{
            minWidth: CALENDAR_MIN_WIDTH,
            width: "max-content",
            position: "fixed",
            zIndex: 1200,
            background: "#ffffff",
            ...(dropdownStyle.top != null
              ? { top: dropdownStyle.top, left: dropdownStyle.left }
              : { bottom: dropdownStyle.bottom, left: dropdownStyle.left }),
          }}
        >
          {/* 달력 본체 전역 디자인 격리: 열리는 위치와 관계없이 동일한 토큰 사용 */}
          <div className="shared-date-picker-dropdown__ds">
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
        </div>,
        document.body
      )}
    </div>
  );
}
