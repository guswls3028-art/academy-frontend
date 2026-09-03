/**
 * PATH: src/features/clinic/pages/OperationsConsolePage/ClinicConsoleSidebar.tsx
 * 운영 콘솔 좌측 — 미니 달력 + 해당일 클리닉 수업 목록
 * 재설계: 세션 항목에 출석 진행 미니 바 + 인원 상세 표시
 */

import { useMemo, type KeyboardEvent } from "react";
import dayjs from "dayjs";
import "dayjs/locale/ko";
import { Clock, MapPin, Plus, Copy, Pencil, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import { cx } from "@/shared/utils/cx";
import { isClinicSessionFull } from "@/shared/utils/clinicSessionCapacity";
import type { ClinicSessionTreeNode } from "../../api/clinicSessions.api";

dayjs.locale("ko");

const DOW = ["일", "월", "화", "수", "목", "금", "토"];

function buildMonthGrid(year: number, month: number): string[] {
  const first = dayjs(`${year}-${String(month).padStart(2, "0")}-01`);
  const gridStart = first.subtract(first.day(), "day");
  return Array.from({ length: 42 }, (_, index) =>
    gridStart.add(index, "day").format("YYYY-MM-DD")
  );
}

function moveCalendarFocus(event: KeyboardEvent<HTMLDivElement>) {
  const offsets: Record<string, number> = {
    ArrowLeft: -1,
    ArrowRight: 1,
    ArrowUp: -7,
    ArrowDown: 7,
  };
  const offset = offsets[event.key];
  if (!offset || !(event.target instanceof HTMLButtonElement)) return;
  const date = event.target.dataset.calendarDate;
  if (!date) return;
  const nextDate = dayjs(date).add(offset, "day").format("YYYY-MM-DD");
  const nextCell = event.currentTarget.querySelector<HTMLButtonElement>(
    `[data-calendar-date="${nextDate}"]`,
  );
  if (!nextCell) return;
  event.preventDefault();
  nextCell.focus();
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
  /** 정규 클리닉(반 편성 모드)에서만 활성. 필터 + 뱃지 노출 여부 */
  showSectionFilter?: boolean;
  /** 필터 값: null = 전체, "unassigned" = 미지정, number = section id */
  sectionFilter?: number | "unassigned" | null;
  onSectionFilterChange?: (value: number | "unassigned" | null) => void;
  /** 필터 칩 옵션. 부모가 전체 세션에서 파생해 전달(필터 걸려도 옵션은 유지) */
  sectionFilterOptions?: Array<{ value: number | "unassigned"; label: string }>;
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
  showSectionFilter = false,
  sectionFilter = null,
  onSectionFilterChange,
  sectionFilterOptions,
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

  /** 필터 옵션: 부모 전달값 우선, 없으면 표시 중 세션에서 파생 */
  const sectionOptions = useMemo(() => {
    if (sectionFilterOptions) return sectionFilterOptions;
    const seen = new Map<number, string>();
    let hasUnassigned = false;
    for (const s of sessions) {
      if (s.section != null && s.section_label) {
        if (!seen.has(s.section)) seen.set(s.section, s.section_label);
      } else {
        hasUnassigned = true;
      }
    }
    const options: Array<{ value: number | "unassigned"; label: string }> = Array.from(
      seen.entries(),
    )
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([id, label]) => ({ value: id, label: `${label}반` }));
    if (hasUnassigned) options.push({ value: "unassigned", label: "미지정" });
    return options;
  }, [sessions, sectionFilterOptions]);

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
      <div className="clinic-scheduler-panel__nav clinic-scheduler-panel__nav--sidebar">
        <button
          type="button"
          className="clinic-scheduler-panel__nav-btn"
          onClick={onPrevMonth}
          aria-label="이전 달"
        >
          <ChevronLeft size={16} />
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
          <ChevronRight size={16} />
        </button>
      </div>
      <div
        className="clinic-scheduler-panel__mini-cal clinic-scheduler-panel__mini-cal--sidebar"
        role="grid"
        aria-label={`${year}년 ${month}월 클리닉 월간 달력`}
        onKeyDown={moveCalendarFocus}
      >
        <div className="clinic-scheduler-panel__mini-cal-dow" role="row">
          {DOW.map((d) => (
            <span key={d} className="clinic-scheduler-panel__mini-cal-dow-cell" role="columnheader">
              {d}
            </span>
          ))}
        </div>
        <div className="clinic-scheduler-panel__mini-cal-grid">
          {Array.from({ length: 6 }, (_, weekIndex) => (
            <div key={weekIndex} className="clinic-scheduler-panel__mini-cal-week" role="row">
              {grid.slice(weekIndex * 7, weekIndex * 7 + 7).map((date) => {
                const isSelected = date === selectedDay;
                const isToday = date === todayISO;
                const isPast = date < todayISO;
                const isOutsideMonth = dayjs(date).month() + 1 !== month;
                const daySessions = sessionsByDate[date] ?? [];
                const count = daySessions.length;
                const isFull = count > 0 && daySessions.every(isClinicSessionFull);
                const availability = count === 0
                  ? "수업 없음"
                  : `${count}개, ${isFull ? "마감" : "예약 가능"}`;
                return (
                  <button
                    key={date}
                    type="button"
                    role="gridcell"
                    aria-label={`${dayjs(date).format("M월 D일 dddd")}, ${availability}`}
                    aria-current={isToday ? "date" : undefined}
                    aria-selected={isSelected}
                    data-calendar-date={date}
                    tabIndex={isSelected ? 0 : -1}
                    onClick={() => onSelectDay(date)}
                    className={cx(
                      "clinic-scheduler-panel__mini-cal-cell",
                      count > 0 && (isFull
                        ? "clinic-scheduler-panel__mini-cal-cell--status-full"
                        : "clinic-scheduler-panel__mini-cal-cell--status-normal"),
                      isSelected && "clinic-scheduler-panel__mini-cal-cell--selected",
                      isToday && "clinic-scheduler-panel__mini-cal-cell--today",
                      isPast && "clinic-scheduler-panel__mini-cal-cell--past",
                      isOutsideMonth && "clinic-scheduler-panel__mini-cal-cell--outside",
                    )}
                  >
                    {dayjs(date).format("D")}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {showSectionFilter && sectionOptions.length > 0 && (
        <div
          className="clinic-sidebar__section-filter"
          role="group"
          aria-label="반 필터"
        >
          {[
            { value: null as null, label: "전체" },
            ...sectionOptions,
          ].map((opt) => {
            const active =
              (opt.value === null && sectionFilter === null) ||
              (opt.value !== null && sectionFilter === opt.value);
            return (
              <button
                key={opt.value ?? "all"}
                type="button"
                onClick={() => onSectionFilterChange?.(opt.value)}
                className={cx(
                  "clinic-sidebar__section-filter-chip",
                  active && "clinic-sidebar__section-filter-chip--active"
                )}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      )}

      <div className="clinic-sidebar__session-section">
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
                  <Copy size={16} aria-hidden />
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
            className="clinic-empty-state__text clinic-sidebar__empty-text"
          >
            {selectedDay === todayISO ? "오늘 일정 없음" : "해당 날짜 일정 없음"}
          </p>
        ) : (
          <ul className="clinic-sidebar__session-list">
            {sessionsForDay.map((s) => {
              const time = (s.start_time || "").slice(0, 5) || "—";
              const isActive = selectedSessionId === s.id;
              const reserved = s.booked_count ?? 0;
              const approvalPending = s.pending_count ?? 0;
              const booked = s.booked_confirmed_count ?? Math.max(0, reserved - approvalPending);
              const total = s.participant_count ?? reserved;
              const noShow = s.no_show_count ?? 0;
              const attended = Math.max(0, total - booked - approvalPending - noShow);
              const progressPct =
                total > 0 ? ((attended + noShow) / total) * 100 : 0;
              const progressValue = Math.min(100, progressPct);

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
                          <Clock size={16} aria-hidden />
                          <span className="clinic-console__sidebar-session-time">
                            {time}
                          </span>
                          {showSectionFilter && s.section_label && (
                            <span
                              className="clinic-sidebar__session-section-badge"
                              aria-label={`${s.section_label}반`}
                            >
                              {s.section_label}반
                            </span>
                          )}
                          {s.location && (
                            <>
                              <MapPin
                                size={11}
                                aria-hidden
                                className="clinic-console__sidebar-session-location-icon"
                              />
                              <span className="clinic-console__sidebar-session-location">
                                {s.location}
                              </span>
                            </>
                          )}
                        </div>
                        {/* Mini progress bar */}
                        {total > 0 && (
                          <progress
                            className="clinic-sidebar__mini-progress"
                            value={progressValue}
                            max={100}
                            aria-label={`처리율 ${Math.round(progressValue)}%`}
                          />
                        )}
                      </div>
                      <div className="clinic-console__sidebar-session-meta">
                        {(booked > 0 || approvalPending > 0) && (
                          <span
                            className="clinic-console__sidebar-session-pending-dot"
                            aria-label={`승인 대기 ${approvalPending}명, 미확인 ${booked}명`}
                          />
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
