// PATH: src/shared/ui/date/DatePicker.tsx
// 전역 단일 SSOT: 차시 생성 모달(ModalDateSection)과 동일한 달력. 프로젝트 내 모든 날짜 선택에서 이 컴포넌트만 사용.
// AntD DatePicker 사용 금지. 포털 시 불투명 배경·테두리·그림자, 트리거 위로 열림(아래 필드 가리지 않음).

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
  const [dropdownStyle, setDropdownStyle] = useState<{
    bottom: number;
    left: number;
    maxHeight?: number;
    overflowY?: "auto";
  } | null>(null);

  const selected = toDayjs(value);
  const today = dayjs();

  // value가 바뀌면 viewMonth 동기화
  useEffect(() => {
    const v = toDayjs(value);
    if (v) setViewMonth(v);
  }, [value]);

  // 포털로 body에 렌더. 전역 SSOT: 항상 트리거 위로 열림(시작/종료 시간 필드 가리지 않음). 공간 부족 시 높이 제한·스크롤
  useLayoutEffect(() => {
    if (!open) {
      setDropdownStyle(null);
      return;
    }
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const space = 8;
    const dropdownHeight = 380;
    const spaceAbove = rect.top - space;
    const fitsAbove = spaceAbove >= dropdownHeight;
    setDropdownStyle({
      bottom: window.innerHeight - rect.top + space,
      left: rect.left,
      ...(fitsAbove ? {} : { maxHeight: Math.max(200, spaceAbove), overflowY: "auto" as const }),
    });
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
        <Calendar className="shared-date-picker-trigger-icon" size={18} aria-hidden />
        <span className={value ? "" : "shared-date-picker-placeholder"}>{displayText}</span>
      </button>

      {open && dropdownStyle && ReactDOM.createPortal(
        <div
          className="shared-date-picker-dropdown shared-date-picker-dropdown--portaled"
          role="dialog"
          aria-label="날짜 선택"
          style={{
            minWidth: CALENDAR_MIN_WIDTH,
            width: "max-content",
            position: "fixed",
            zIndex: 1200,
            backgroundColor: "var(--color-bg-surface, #ffffff)",
            bottom: dropdownStyle.bottom,
            left: dropdownStyle.left,
            maxHeight: dropdownStyle.maxHeight,
            overflowY: dropdownStyle.overflowY,
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
        </div>,
        document.body
      )}
    </div>
  );
}
