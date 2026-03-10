/**
 * PATH: src/features/clinic/pages/OperationsConsolePage/ClinicConsoleSidebar.tsx
 * 운영 콘솔 좌측 — 미니 달력 + 해당일 클리닉 수업 목록 (SSOT: clinic.css 미니캘 그리드)
 */

import { useMemo } from "react";
import dayjs from "dayjs";
import "dayjs/locale/ko";
import { Clock } from "lucide-react";
import type { ClinicSessionTreeNode } from "../../api/clinicSessions.api";

dayjs.locale("ko");

const DOW = ["일", "월", "화", "수", "목", "금", "토"];

function buildMonthGrid(year: number, month: number): (string | null)[] {
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

function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

type Props = {
  sessions: ClinicSessionTreeNode[];
  selectedDay: string;
  todayISO: string;
  year: number;
  month: number;
  onSelectDay: (date: string) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  selectedSessionId: number | null;
  onSelectSession: (id: number) => void;
};

export default function ClinicConsoleSidebar({
  sessions,
  selectedDay,
  todayISO,
  year,
  month,
  onSelectDay,
  onPrevMonth,
  onNextMonth,
  selectedSessionId,
  onSelectSession,
}: Props) {
  const sessionsByDate = useMemo(() => {
    const map: Record<string, ClinicSessionTreeNode[]> = {};
    sessions.forEach((s) => {
      const key = dayjs(s.date).format("YYYY-MM-DD");
      map[key] = map[key] ?? [];
      map[key].push(s);
    });
    return map;
  }, [sessions]);

  const sessionsForDay = useMemo(() => {
    return (sessionsByDate[selectedDay] ?? []).sort(
      (a, b) => (a.start_time || "").localeCompare(b.start_time || "")
    );
  }, [sessionsByDate, selectedDay]);

  const monthLabelShort = dayjs(`${year}-${String(month).padStart(2, "0")}-01`).format("M월");
  const grid = useMemo(() => buildMonthGrid(year, month), [year, month]);

  return (
    <>
      <div className="clinic-scheduler-panel__nav" style={{ padding: "0 var(--space-4) var(--space-3)" }}>
        <button
          type="button"
          className="clinic-scheduler-panel__nav-btn"
          onClick={onPrevMonth}
          aria-label="이전 달"
        >
          ◀
        </button>
        <span className="clinic-scheduler-panel__month-label">{monthLabelShort}</span>
        <button
          type="button"
          className="clinic-scheduler-panel__nav-btn"
          onClick={onNextMonth}
          aria-label="다음 달"
        >
          ▶
        </button>
      </div>
      <div className="clinic-scheduler-panel__mini-cal" style={{ padding: "0 var(--space-4) var(--space-4)" }}>
        <div className="clinic-scheduler-panel__mini-cal-dow">
          {DOW.map((d) => (
            <span key={d} className="clinic-scheduler-panel__mini-cal-dow-cell">
              {d}
            </span>
          ))}
        </div>
        <div className="clinic-scheduler-panel__mini-cal-grid">
          {grid.map((date, i) => {
            if (!date) {
              return (
                <div
                  key={`empty-${i}`}
                  className="clinic-scheduler-panel__mini-cal-cell clinic-scheduler-panel__mini-cal-cell--empty"
                />
              );
            }
            const isSelected = date === selectedDay;
            const isToday = date === todayISO;
            const isPast = date < todayISO;
            const count = sessionsByDate[date]?.length ?? 0;
            const hasClinic = count > 0;
            return (
              <button
                key={date}
                type="button"
                onClick={() => onSelectDay(date)}
                className={cx(
                  "clinic-scheduler-panel__mini-cal-cell",
                  hasClinic && "clinic-scheduler-panel__mini-cal-cell--status-normal",
                  isSelected && "clinic-scheduler-panel__mini-cal-cell--selected",
                  isToday && "clinic-scheduler-panel__mini-cal-cell--today",
                  isPast && "clinic-scheduler-panel__mini-cal-cell--past"
                )}
              >
                {dayjs(date).format("D")}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ borderTop: "1px solid var(--color-border-divider)", padding: "var(--space-2) 0" }}>
        <div
          style={{
            padding: "var(--space-2) var(--space-4)",
            fontSize: 12,
            fontWeight: 700,
            color: "var(--color-text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.04em",
          }}
        >
          클리닉 수업
        </div>
        {sessionsForDay.length === 0 ? (
          <p
            className="clinic-empty-state__text"
            style={{ padding: "var(--space-4)", fontSize: 13, margin: 0 }}
          >
            {selectedDay === todayISO ? "오늘 일정 없음" : "해당 날짜 일정 없음"}
          </p>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: "0 var(--space-2) var(--space-2)" }}>
            {sessionsForDay.map((s) => {
              const time = (s.start_time || "").slice(0, 5) || "—";
              const isActive = selectedSessionId === s.id;
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => onSelectSession(s.id)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      width: "100%",
                      padding: "var(--space-2) var(--space-4)",
                      border: "none",
                      borderRadius: 0,
                      background: isActive
                        ? "color-mix(in srgb, var(--color-primary) 10%, var(--color-bg-surface))"
                        : "transparent",
                      color: isActive ? "var(--color-primary)" : "var(--color-text-secondary)",
                      fontWeight: isActive ? 600 : 500,
                      fontSize: 13,
                      textAlign: "left",
                      cursor: "pointer",
                      borderLeft: `3px solid ${isActive ? "var(--color-primary)" : "transparent"}`,
                    }}
                  >
                    <Clock size={14} aria-hidden />
                    <span>{time}</span>
                    <span
                      style={{
                        flex: 1,
                        minWidth: 0,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {s.location || "—"}
                    </span>
                    <span style={{ fontSize: 11, color: "var(--color-text-muted)" }}>
                      {s.booked_count ?? 0}명
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}
