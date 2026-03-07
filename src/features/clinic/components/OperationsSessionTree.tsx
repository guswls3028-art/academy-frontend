// PATH: src/features/clinic/components/OperationsSessionTree.tsx
// SaaS 스타일 좌측 스케줄러 — 미니 캘린더, 날짜 카드, Today, 검색, hover 인터랙션

import { useMemo, useState } from "react";
import dayjs from "dayjs";
import type { ClinicSessionTreeNode } from "../api/clinicSessions.api";

function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

const DOW = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function buildMonthGrid(year: number, month: number) {
  const first = dayjs(`${year}-${String(month).padStart(2, "0")}-01`);
  const daysInMonth = first.daysInMonth();
  const startDow = first.day();
  const leadingEmpty = startDow;
  const totalCells = Math.ceil((leadingEmpty + daysInMonth) / 7) * 7;
  const grid: (string | null)[] = [];
  for (let i = 0; i < leadingEmpty; i++) grid.push(null);
  for (let i = 0; i < daysInMonth; i++) grid.push(first.add(i, "day").format("YYYY-MM-DD"));
  while (grid.length < totalCells) grid.push(null);
  return grid;
}

function buildMonthDays(year: number, month: number) {
  const first = dayjs(`${year}-${String(month).padStart(2, "0")}-01`);
  return Array.from({ length: first.daysInMonth() }, (_, i) =>
    first.add(i, "day").format("YYYY-MM-DD")
  );
}

export default function OperationsSessionTree({
  sessions,
  selectedDay,
  onSelectDay,
  year,
  month,
  todayISO,
  onToday,
  onPrevMonth,
  onNextMonth,
}: {
  sessions: ClinicSessionTreeNode[];
  selectedDay: string;
  onSelectDay: (date: string) => void;
  year: number;
  month: number;
  todayISO: string;
  onToday: () => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
}) {
  const [search, setSearch] = useState("");

  const sessionsByDate = useMemo(() => {
    const map: Record<string, ClinicSessionTreeNode[]> = {};
    sessions.forEach((s) => {
      map[s.date] ??= [];
      map[s.date].push(s);
    });
    return map;
  }, [sessions]);

  const totalClinicsInMonth = sessions.length;
  const monthLabel = dayjs(`${year}-${String(month).padStart(2, "0")}-01`).format("MMMM YYYY");
  const monthLabelShort = `${year}-${String(month).padStart(2, "0")}`;

  const grid = useMemo(() => buildMonthGrid(year, month), [year, month]);
  const daysList = useMemo(() => buildMonthDays(year, month), [year, month]);

  const filteredDays = useMemo(() => {
    if (!search.trim()) return daysList;
    const q = search.trim().toLowerCase();
    return daysList.filter((d) => {
      const dObj = dayjs(d);
      const dateNum = dObj.format("D");
      const dow = dObj.format("ddd");
      const full = d;
      return (
        dateNum.includes(q) ||
        dow.toLowerCase().includes(q) ||
        full.includes(q)
      );
    });
  }, [daysList, search]);

  return (
    <div className="clinic-scheduler-panel ds-card-modal clinic-panel w-[320px] shrink-0 overflow-hidden flex flex-col">
      {/* 헤더: 제목 + 월 + 총 클리닉 수 */}
      <div className="clinic-scheduler-panel__header">
        <div className="ds-card-modal__accent" aria-hidden />
        <div className="clinic-scheduler-panel__header-inner">
          <h2 className="clinic-scheduler-panel__title">Clinic Scheduler</h2>
          <p className="clinic-scheduler-panel__meta">
            {monthLabel}
          </p>
          <p className="clinic-scheduler-panel__count">
            {totalClinicsInMonth} {totalClinicsInMonth === 1 ? "clinic" : "clinics"} scheduled
          </p>
        </div>
      </div>

      <div className="clinic-scheduler-panel__body flex flex-col min-h-0">
        {/* ◀ Today ▶ */}
        <div className="clinic-scheduler-panel__nav">
          <button
            type="button"
            className="clinic-scheduler-panel__nav-btn"
            onClick={onPrevMonth}
            aria-label="이전 달"
          >
            ◀
          </button>
          <button
            type="button"
            className="clinic-scheduler-panel__today-btn"
            onClick={onToday}
          >
            Today
          </button>
          <button
            type="button"
            className="clinic-scheduler-panel__nav-btn"
            onClick={onNextMonth}
            aria-label="다음 달"
          >
            ▶
          </button>
        </div>

        {/* 미니 캘린더 */}
        <div className="clinic-scheduler-panel__mini-cal">
          <div className="clinic-scheduler-panel__mini-cal-dow">
            {DOW.map((d) => (
              <span key={d} className="clinic-scheduler-panel__mini-cal-dow-cell">{d}</span>
            ))}
          </div>
          <div className="clinic-scheduler-panel__mini-cal-grid">
            {grid.map((date, i) => {
              if (!date) {
                return <div key={`empty-${i}`} className="clinic-scheduler-panel__mini-cal-cell clinic-scheduler-panel__mini-cal-cell--empty" />;
              }
              const isSelected = date === selectedDay;
              const isToday = date === todayISO;
              const count = (sessionsByDate[date]?.length ?? 0);
              return (
                <button
                  key={date}
                  type="button"
                  onClick={() => onSelectDay(date)}
                  className={cx(
                    "clinic-scheduler-panel__mini-cal-cell",
                    isSelected && "clinic-scheduler-panel__mini-cal-cell--selected",
                    isToday && "clinic-scheduler-panel__mini-cal-cell--today"
                  )}
                >
                  {dayjs(date).format("D")}
                  {count > 0 && <span className="clinic-scheduler-panel__mini-cal-dot" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* 검색 */}
        <div className="clinic-scheduler-panel__search">
          <span className="clinic-scheduler-panel__search-icon" aria-hidden>🔍</span>
          <input
            type="text"
            placeholder="Search date"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="clinic-scheduler-panel__search-input"
          />
        </div>

        <div className="clinic-scheduler-panel__divider" aria-hidden />

        {/* 날짜 카드 리스트 */}
        <div className="clinic-scheduler-panel__list">
          {filteredDays.map((date) => {
            const list = sessionsByDate[date] ?? [];
            const count = list.length;
            const isSelected = date === selectedDay;
            const isToday = date === todayISO;
            const dObj = dayjs(date);
            const dayNum = dObj.format("D");
            const dow = dObj.format("ddd");

            return (
              <button
                key={date}
                type="button"
                onClick={() => onSelectDay(date)}
                className={cx(
                  "clinic-scheduler-panel__day-card",
                  isSelected && "clinic-scheduler-panel__day-card--selected",
                  isToday && "clinic-scheduler-panel__day-card--today"
                )}
              >
                <span className="clinic-scheduler-panel__day-card-accent" aria-hidden />
                <div className="clinic-scheduler-panel__day-card-inner">
                  <span className="clinic-scheduler-panel__day-card-date">
                    {dayNum} {dow}
                    {count > 0 && (
                      <span className="clinic-scheduler-panel__day-card-dots">
                        {Array.from({ length: Math.min(count, 3) }, (_, i) => (
                          <span key={i} className="clinic-scheduler-panel__day-card-dot" />
                        ))}
                      </span>
                    )}
                  </span>
                  <span className="clinic-scheduler-panel__day-card-meta">
                    {count === 0 ? "No clinics" : count === 1 ? "1 clinic" : `${count} clinics`}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
