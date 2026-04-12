// PATH: src/app_admin/domains/clinic/components/OperationsSessionTree.tsx
// SaaS 스타일 좌측 스케줄러 — 헤더(연도) + ◀ N월 ▶ + 미니 캘린더 (오늘 테두리, 지난 날짜 클릭 가능)

import { useMemo } from "react";
import dayjs from "dayjs";
import "dayjs/locale/ko";
import type { ClinicSessionTreeNode } from "../api/clinicSessions.api";

dayjs.locale("ko");

function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

const DOW = ["일", "월", "화", "수", "목", "금", "토"];

/** 날짜별 상태: 🟢 정상 | 🟡 예약 거의 찼음 | 🔴 마감 */
export type DateStatus = "normal" | "almost" | "full";

function getSessionStatus(s: ClinicSessionTreeNode): DateStatus {
  const max = s.max_participants;
  if (max == null || max <= 0) return "normal";
  const booked = s.booked_count ?? 0;
  if (booked >= max) return "full";
  if (booked >= Math.ceil(max * 0.8)) return "almost";
  return "normal";
}

function getDateStatus(sessions: ClinicSessionTreeNode[]): DateStatus {
  if (!sessions.length) return "normal";
  let status: DateStatus = "normal";
  for (const s of sessions) {
    const sStatus = getSessionStatus(s);
    if (sStatus === "full") return "full";
    if (sStatus === "almost") status = "almost";
  }
  return status;
}

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

export default function OperationsSessionTree({
  sessions,
  selectedDay,
  onSelectDay,
  year,
  month,
  todayISO,
  onPrevMonth,
  onNextMonth,
}: {
  sessions: ClinicSessionTreeNode[];
  selectedDay: string;
  onSelectDay: (date: string) => void;
  year: number;
  month: number;
  todayISO: string;
  onPrevMonth: () => void;
  onNextMonth: () => void;
}) {
  const sessionsByDate = useMemo(() => {
    const map: Record<string, ClinicSessionTreeNode[]> = {};
    sessions.forEach((s) => {
      const raw = s.date;
      const key =
        typeof raw === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw)
          ? raw
          : dayjs(raw).isValid()
            ? dayjs(raw).format("YYYY-MM-DD")
            : null;
      if (key) {
        map[key] ??= [];
        map[key].push(s);
      }
    });
    return map;
  }, [sessions]);

  const dateStatusByDate = useMemo(() => {
    const out: Record<string, DateStatus> = {};
    Object.entries(sessionsByDate).forEach(([date, list]) => {
      out[date] = getDateStatus(list);
    });
    return out;
  }, [sessionsByDate]);

  const totalClinicsInMonth = sessions.length;
  const monthLabelShort = dayjs(`${year}-${String(month).padStart(2, "0")}-01`).format("M월");
  const grid = useMemo(() => buildMonthGrid(year, month), [year, month]);

  return (
    <div className="clinic-scheduler-panel ds-card-modal clinic-panel shrink-0 overflow-hidden flex flex-col">
      {/* 헤더: 클리닉 스케줄러 + 연도 */}
      <div className="clinic-scheduler-panel__header">
        <div className="ds-card-modal__accent" aria-hidden />
        <div className="clinic-scheduler-panel__header-inner">
          <h2 className="clinic-scheduler-panel__title">클리닉 스케줄러 {year}</h2>
          <p className="clinic-scheduler-panel__count">
            {totalClinicsInMonth}개 클리닉 일정
          </p>
        </div>
      </div>

      <div className="clinic-scheduler-panel__body flex flex-col min-h-0">
        {/* ◀ N월 ▶ */}
        <div className="clinic-scheduler-panel__nav">
          <button
            type="button"
            className="clinic-scheduler-panel__nav-btn"
            onClick={onPrevMonth}
            aria-label="이전 달"
          >
            ◀
          </button>
          <span className="clinic-scheduler-panel__month-label">
            {monthLabelShort}
          </span>
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
              const isPast = date < todayISO;
              const count = (sessionsByDate[date]?.length ?? 0);
              const status = dateStatusByDate[date] ?? "normal";
              return (
                <button
                  key={date}
                  type="button"
                  onClick={() => onSelectDay(date)}
                  className={cx(
                    "clinic-scheduler-panel__mini-cal-cell",
                    count > 0 && status === "normal" && "clinic-scheduler-panel__mini-cal-cell--status-normal",
                    count > 0 && status === "almost" && "clinic-scheduler-panel__mini-cal-cell--status-almost",
                    count > 0 && status === "full" && "clinic-scheduler-panel__mini-cal-cell--status-full",
                    isSelected && "clinic-scheduler-panel__mini-cal-cell--selected",
                    isToday && "clinic-scheduler-panel__mini-cal-cell--today",
                    isPast && "clinic-scheduler-panel__mini-cal-cell--past"
                  )}
                  title={
                    isPast
                      ? "지난 날짜 (일정 조회만 가능)"
                      : status === "full"
                        ? "마감"
                        : status === "almost"
                          ? "예약 거의 찼음"
                          : "정상"
                  }
                >
                  {dayjs(date).format("D")}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
