// PATH: src/shared/ui/time/TimeScrollPopover.tsx
// 롤링 방식 완전 재작성: [ 오전 | 시간 ] — 오전/오후 클릭+휠 순환, 시간 스크롤 롤러.

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import "./TimeScrollPopover.css";

const ROW_HEIGHT = 48;
const VISIBLE_ROWS = 5;
const VISIBLE_HEIGHT = ROW_HEIGHT * VISIBLE_ROWS;
const PERIOD_SLOTS = ["오전", "오후"] as const;
const TIME_12_SLOTS = (() => {
  const out: string[] = [];
  for (let i = 0; i < 24; i++) {
    const totalMin = i * 30;
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    out.push(`${h === 0 ? 12 : h}:${String(m).padStart(2, "0")}`);
  }
  return out;
})();

export function format24To12Display(hhmm: string): string {
  if (!hhmm) return "오전 12:00";
  const [hStr, mStr] = hhmm.split(":");
  const h = parseInt(hStr ?? "0", 10);
  const m = parseInt(mStr ?? "0", 10);
  const period = h < 12 ? "오전" : "오후";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${period} ${h12}:${String(m).padStart(2, "0")}`;
}

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

function from24h(hhmm: string): { periodIndex: number; timeIndex: number } {
  const [hStr, mStr] = (hhmm || "00:00").split(":");
  const h = parseInt(hStr ?? "0", 10);
  const m = parseInt(mStr ?? "0", 10);
  const periodIndex = h < 12 ? 0 : 1;
  const timeTotalMin = h < 12 ? h * 60 + m : (h - 12) * 60 + m;
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

function parseValueToNearest(value: string): { periodIndex: number; timeIndex: number } {
  const [hStr, mStr] = (value || "00:00").split(":");
  const h = parseInt(hStr ?? "0", 10);
  const m = parseInt(mStr ?? "0", 10);
  return from24h(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
}

export function TimeScrollPopover({
  value,
  anchorEl,
  onSelect,
  onClose,
}: TimeScrollPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const timeListRef = useRef<HTMLDivElement>(null);

  const parsed = parseValueToNearest(value);
  const [periodIdx, setPeriodIdx] = useState(parsed.periodIndex);
  const [timeIdx, setTimeIdx] = useState(parsed.timeIndex);

  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  const emit = useCallback((p: number, t: number) => {
    onSelectRef.current(to24h(p, t));
  }, []);

  // 외부 value 변경 시 동기화
  useEffect(() => {
    const { periodIndex, timeIndex } = parseValueToNearest(value);
    setPeriodIdx(periodIndex);
    setTimeIdx(timeIndex);
  }, [value]);

  // 선택값 변경 시 부모에 전달
  useEffect(() => {
    emit(periodIdx, timeIdx);
  }, [periodIdx, timeIdx, emit]);

  // ===== 시간 롤러: 초기 스크롤 위치 =====
  useLayoutEffect(() => {
    const el = timeListRef.current;
    if (!el) return;
    const blockLen = TIME_12_SLOTS.length;
    const blockHeight = blockLen * ROW_HEIGHT;
    const targetScroll =
      blockHeight + timeIdx * ROW_HEIGHT - VISIBLE_HEIGHT / 2 + ROW_HEIGHT / 2;
    el.scrollTop = Math.max(0, Math.min(targetScroll, el.scrollHeight - VISIBLE_HEIGHT));
  }, [timeIdx]);

  // ===== 시간 롤러: 스크롤 이벤트 → 인덱스 반영 + 무한 순환 =====
  useEffect(() => {
    const el = timeListRef.current;
    if (!el) return;
    const blockLen = TIME_12_SLOTS.length;
    const blockHeight = blockLen * ROW_HEIGHT;

    const handleScroll = () => {
      let st = el.scrollTop;
      // 무한 순환: 양 끝에서 중간 블록으로 점프
      if (st < blockHeight * 0.5) {
        el.scrollTop = st + blockHeight;
        st = el.scrollTop;
      } else if (st > blockHeight * 2 - blockHeight * 0.5) {
        el.scrollTop = st - blockHeight;
        st = el.scrollTop;
      }
      const centerY = st + VISIBLE_HEIGHT / 2;
      const rowIndex = Math.floor((centerY - ROW_HEIGHT / 2) / ROW_HEIGHT);
      const idx = ((rowIndex % blockLen) + blockLen) % blockLen;
      setTimeIdx(idx);
    };

    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, []);

  // ===== 오전/오후: 휠 이벤트 → 순환 =====
  const handlePeriodWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setPeriodIdx((prev) => (e.deltaY > 0 ? (prev + 1) % 2 : (prev - 1 + 2) % 2));
  }, []);

  // ===== 바깥 클릭 시 닫기 =====
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (anchorEl.contains(t) || popoverRef.current?.contains(t)) return;
      onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [anchorEl, onClose]);

  // ===== 시간 클릭 시 해당 슬롯으로 스크롤 =====
  const scrollToTime = useCallback((idx: number) => {
    const el = timeListRef.current;
    if (!el) return;
    const blockHeight = TIME_12_SLOTS.length * ROW_HEIGHT;
    const target = blockHeight + idx * ROW_HEIGHT - VISIBLE_HEIGHT / 2 + ROW_HEIGHT / 2;
    el.scrollTo({ top: target, behavior: "smooth" });
    setTimeIdx(idx);
  }, []);

  const rect = anchorEl.getBoundingClientRect();

  return (
    <div
      ref={popoverRef}
      className="time-picker"
      style={{
        position: "fixed",
        left: rect.left,
        bottom: window.innerHeight - rect.top + 8,
        width: Math.max(rect.width, 260),
        zIndex: 1100,
      }}
      role="listbox"
      aria-label="시간 선택"
    >
      <div className="time-picker__body">
        {/* 왼쪽: 오전/오후 — 클릭 + 휠 순환 */}
        <div
          className="time-picker__period"
          onWheel={handlePeriodWheel}
          style={{ touchAction: "none" }}
        >
          <div className="time-picker__period-list">
            {PERIOD_SLOTS.map((label, i) => (
              <button
                key={label}
                type="button"
                className={`time-picker__period-item ${
                  periodIdx === i ? "time-picker__period-item--active" : ""
                }`}
                onClick={() => setPeriodIdx(i)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="time-picker__divider" aria-hidden>
          |
        </div>

        {/* 오른쪽: 시간 롤러 — 12h 표시, 24h 내부 */}
        <div className="time-picker__time">
          <div className="time-picker__time-mask time-picker__time-mask--top" />
          <div className="time-picker__time-mask time-picker__time-mask--bottom" />
          <div className="time-picker__time-highlight" />
          <div
            ref={timeListRef}
            className="time-picker__time-list"
            style={{ height: VISIBLE_HEIGHT }}
          >
            {[0, 1, 2].map((block) =>
              TIME_12_SLOTS.map((t, i) => (
                <button
                  key={`${block}-${t}`}
                  type="button"
                  className="time-picker__time-item"
                  style={{ height: ROW_HEIGHT }}
                  onClick={() => scrollToTime(i)}
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
