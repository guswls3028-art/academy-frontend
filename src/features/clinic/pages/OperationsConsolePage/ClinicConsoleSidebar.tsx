/**
 * PATH: src/features/clinic/pages/OperationsConsolePage/ClinicConsoleSidebar.tsx
 * 운영 콘솔 좌측 — 미니 달력 + 해당일 클리닉 수업 목록
 * 재설계: 세션 항목에 출석 진행 미니 바 + 인원 상세 표시
 */

import { useMemo } from "react";
import dayjs from "dayjs";
import "dayjs/locale/ko";
import { Clock, MapPin, Plus, Copy, Pencil, Trash2 } from "lucide-react";
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
  for (let i = 0; i < daysInMonth; i++)
    grid.push(first.add(i, "day").format("YYYY-MM-DD"));
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
  onCreateClick?: () => void;
  onImportClick?: () => void;
  onEditSession?: (sessionId: number) => void;
  onDeleteSession?: (sessionId: number, label: string) => void;
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
  onCreateClick,
  onImportClick,
  onEditSession,
  onDeleteSession,
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
    return (sessionsByDate[selectedDay] ?? []).sort((a, b) =>
      (a.start_time || "").localeCompare(b.start_time || "")
    );
  }, [sessionsByDate, selectedDay]);

  const monthLabelShort = dayjs(
    `${year}-${String(month).padStart(2, "0")}-01`
  ).format("M월");
  const grid = useMemo(() => buildMonthGrid(year, month), [year, month]);

  return (
    <>
      <div
        className="clinic-scheduler-panel__nav"
        style={{ padding: "0 var(--space-4) var(--space-3)" }}
      >
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
      <div
        className="clinic-scheduler-panel__mini-cal"
        style={{ padding: "0 var(--space-4) var(--space-4)" }}
      >
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
                  hasClinic &&
                    "clinic-scheduler-panel__mini-cal-cell--status-normal",
                  isSelected &&
                    "clinic-scheduler-panel__mini-cal-cell--selected",
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

      <div
        style={{
          borderTop: "1px solid var(--color-border-divider)",
          padding: "var(--space-2) 0",
        }}
      >
        <div className="clinic-sidebar__section-header">
          <div className="clinic-sidebar__section-label">
            클리닉 수업
          </div>
          {selectedDay >= todayISO && (
            <div className="clinic-sidebar__section-actions">
              {onImportClick && (
                <button
                  type="button"
                  className="clinic-sidebar__section-action-btn"
                  title="이전 주 불러오기"
                  onClick={onImportClick}
                >
                  <Copy size={13} aria-hidden />
                </button>
              )}
              {onCreateClick && (
                <button
                  type="button"
                  className="clinic-sidebar__section-action-btn clinic-sidebar__section-action-btn--primary"
                  title="클리닉 만들기"
                  onClick={onCreateClick}
                >
                  <Plus size={14} aria-hidden />
                </button>
              )}
            </div>
          )}
        </div>
        {sessionsForDay.length === 0 ? (
          <p
            className="clinic-empty-state__text"
            style={{ padding: "var(--space-4)", fontSize: 13, margin: 0 }}
          >
            {selectedDay === todayISO ? "오늘 일정 없음" : "해당 날짜 일정 없음"}
          </p>
        ) : (
          <ul
            style={{
              listStyle: "none",
              margin: 0,
              padding: "0 var(--space-2) var(--space-2)",
            }}
          >
            {sessionsForDay.map((s) => {
              const time = (s.start_time || "").slice(0, 5) || "—";
              const isActive = selectedSessionId === s.id;
              const booked = s.booked_count ?? 0;
              const total = s.participant_count ?? booked;
              const noShow = s.no_show_count ?? 0;
              // Derive attended from participant_count minus others
              // participant_count = all non-cancelled; booked = pending; no_show is separate
              // attended ≈ total - booked - no_show (approximate from tree data)
              const attended = Math.max(0, total - booked - noShow);
              const progressPct =
                total > 0 ? ((attended + noShow) / total) * 100 : 0;

              return (
                <li key={s.id}>
                  <div className={cx(
                    "clinic-console__sidebar-session-wrap",
                    isActive && "clinic-console__sidebar-session-wrap--active"
                  )}>
                    <button
                      type="button"
                      onClick={() => onSelectSession(s.id)}
                      className={cx(
                        "clinic-console__sidebar-session",
                        isActive && "clinic-console__sidebar-session--active"
                      )}
                    >
                      <div className="clinic-sidebar__session-content">
                        <div className="clinic-console__sidebar-session-top">
                          <Clock size={13} aria-hidden />
                          <span className="clinic-console__sidebar-session-time">
                            {time}
                          </span>
                          {s.location && (
                            <>
                              <MapPin
                                size={11}
                                aria-hidden
                                style={{ opacity: 0.6 }}
                              />
                              <span className="clinic-console__sidebar-session-location">
                                {s.location}
                              </span>
                            </>
                          )}
                        </div>
                        {/* Mini progress bar */}
                        {total > 0 && (
                          <div className="clinic-sidebar__mini-progress">
                            <div
                              className="clinic-sidebar__mini-progress-fill"
                              style={{ width: `${Math.min(100, progressPct)}%` }}
                            />
                          </div>
                        )}
                      </div>
                      <div className="clinic-console__sidebar-session-meta">
                        {booked > 0 && (
                          <span className="clinic-console__sidebar-session-pending-dot" aria-label={`미확인 ${booked}명`} />
                        )}
                        <span className="clinic-console__sidebar-session-badge">
                          {total}명
                        </span>
                      </div>
                    </button>
                    {selectedDay >= todayISO && isActive && (onEditSession || onDeleteSession) && (
                      <div className="clinic-sidebar__session-inline-actions">
                        {onEditSession && (
                          <button
                            type="button"
                            className="clinic-sidebar__session-inline-btn"
                            title="수정"
                            onClick={(e) => { e.stopPropagation(); onEditSession(s.id); }}
                          >
                            <Pencil size={12} aria-hidden />
                          </button>
                        )}
                        {onDeleteSession && (
                          <button
                            type="button"
                            className="clinic-sidebar__session-inline-btn clinic-sidebar__session-inline-btn--danger"
                            title="삭제"
                            onClick={(e) => {
                              e.stopPropagation();
                              const label = `${time} ${s.location || ""}`.trim();
                              onDeleteSession(s.id, label);
                            }}
                          >
                            <Trash2 size={12} aria-hidden />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}
