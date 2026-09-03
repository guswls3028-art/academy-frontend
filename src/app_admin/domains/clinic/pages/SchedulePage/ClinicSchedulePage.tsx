import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import "dayjs/locale/ko";
import {
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Copy,
  MapPin,
  RefreshCcw,
  Settings,
  Users,
} from "lucide-react";

import { AdminModal, ModalHeader } from "@/shared/ui/modal";
import { Button, EmptyState, ICON, ICON_FOR_BUTTON } from "@/shared/ui/ds";
import StudentNameWithLectureChip from "@/shared/ui/chips/StudentNameWithLectureChip";
import StudentDetailLink from "@admin/domains/students/public/StudentDetailLink";

import { fetchClinicSessions, type ClinicSessionDetail } from "../../api/clinicSessions.api";
import type { ClinicParticipant } from "../../api/clinicParticipants.api";
import { useClinicParticipants } from "../../hooks/useClinicParticipants";
import { clinicQueryKeys } from "../../queryKeys";
import ClinicCreatePanel from "../../components/ClinicCreatePanel";
import { clinicChangeNoticeNavigationState } from "../../components/clinicChangeNoticeNavigation";
import PreviousWeekImportModal from "../../components/PreviousWeekImportModal";
import styles from "./ClinicSchedulePage.module.css";

dayjs.locale("ko");

const ACTIVE_STATUSES = new Set(["pending", "booked", "attended", "no_show"]);
const DAY_LABELS = ["월", "화", "수", "목", "금", "토", "일"];
const MONTH_DAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

function mondayOfWeek(value: string) {
  const date = dayjs(value).startOf("day");
  return date.subtract((date.day() + 6) % 7, "day");
}

function sessionEndTime(session: ClinicSessionDetail) {
  const start = dayjs(`${session.date}T${session.start_time}`);
  if (!start.isValid()) return "";
  return start.add(session.duration_minutes, "minute").format("HH:mm");
}

function activeParticipants(rows: ClinicParticipant[]) {
  return rows.filter((row) => ACTIVE_STATUSES.has(row.status));
}

function participantLectures(participant: ClinicParticipant) {
  if (!participant.lecture_title) return [];
  return [{
    lectureName: participant.lecture_title,
    color: participant.lecture_color,
    chipLabel: participant.lecture_chip_label,
  }];
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

export default function ClinicSchedulePage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const today = dayjs().format("YYYY-MM-DD");
  const requestedInitialDate = searchParams.get("date");
  const initialDate = requestedInitialDate
    && /^\d{4}-\d{2}-\d{2}$/.test(requestedInitialDate)
    && dayjs(requestedInitialDate).isValid()
    ? requestedInitialDate
    : today;
  const [weekAnchor, setWeekAnchor] = useState(initialDate);
  const weekStart = useMemo(() => mondayOfWeek(weekAnchor), [weekAnchor]);
  const weekEnd = useMemo(() => weekStart.add(6, "day"), [weekStart]);
  const weekFrom = weekStart.format("YYYY-MM-DD");
  const weekTo = weekEnd.format("YYYY-MM-DD");
  const days = useMemo(
    () => Array.from({ length: 7 }, (_, index) => weekStart.add(index, "day")),
    [weekStart]
  );
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [monthAnchor, setMonthAnchor] = useState(initialDate);
  const monthStart = useMemo(() => dayjs(monthAnchor).startOf("month"), [monthAnchor]);
  const monthGridStart = useMemo(
    () => monthStart.subtract(monthStart.day(), "day"),
    [monthStart]
  );
  const monthDays = useMemo(
    () => Array.from({ length: 42 }, (_, index) => monthGridStart.add(index, "day")),
    [monthGridStart]
  );
  const monthFrom = monthGridStart.format("YYYY-MM-DD");
  const monthTo = monthGridStart.add(41, "day").format("YYYY-MM-DD");

  const sessionsQ = useQuery({
    queryKey: clinicQueryKeys.sessionsMonthRange(weekFrom, weekTo),
    queryFn: () =>
      fetchClinicSessions({
        date_from: weekFrom,
        date_to: weekTo,
        ordering: "date,start_time,id",
      }),
    staleTime: 30_000,
  });
  const participantsQ = useClinicParticipants({
    session_date_from: weekFrom,
    session_date_to: weekTo,
  });
  const monthSessionsQ = useQuery({
    queryKey: clinicQueryKeys.sessionsMonthRange(monthFrom, monthTo),
    queryFn: () =>
      fetchClinicSessions({
        date_from: monthFrom,
        date_to: monthTo,
        ordering: "date,start_time,id",
      }),
    staleTime: 30_000,
  });
  const sessionsByDate = useMemo(() => {
    const grouped = new Map<string, ClinicSessionDetail[]>();
    for (const session of sessionsQ.data ?? []) {
      const list = grouped.get(session.date) ?? [];
      list.push(session);
      grouped.set(session.date, list);
    }
    for (const list of grouped.values()) {
      list.sort((a, b) => a.start_time.localeCompare(b.start_time));
    }
    return grouped;
  }, [sessionsQ.data]);
  const monthSessionsByDate = useMemo(() => {
    const grouped = new Map<string, ClinicSessionDetail[]>();
    for (const session of monthSessionsQ.data ?? []) {
      const list = grouped.get(session.date) ?? [];
      list.push(session);
      grouped.set(session.date, list);
    }
    return grouped;
  }, [monthSessionsQ.data]);

  const participantsBySession = useMemo(() => {
    const grouped = new Map<number, ClinicParticipant[]>();
    for (const participant of participantsQ.listQ.data ?? []) {
      const list = grouped.get(participant.session) ?? [];
      list.push(participant);
      grouped.set(participant.session, list);
    }
    return grouped;
  }, [participantsQ.listQ.data]);

  const [createDate, setCreateDate] = useState<string | null>(null);
  const [copySource, setCopySource] = useState<ClinicSessionDetail | null>(null);
  const [editingSession, setEditingSession] = useState<ClinicSessionDetail | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  useEffect(() => {
    if (searchParams.get("create") !== "1") return;

    const requestedDate = searchParams.get("date");
    const date = requestedDate && /^\d{4}-\d{2}-\d{2}$/.test(requestedDate)
      && dayjs(requestedDate).isValid()
      ? requestedDate
      : today;
    setWeekAnchor(date);
    setMonthAnchor(date);
    setSelectedDate(date);
    setCreateDate(date);

    const next = new URLSearchParams(searchParams);
    next.delete("create");
    next.set("date", date);
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, today]);

  const openCreate = (date: string, source?: ClinicSessionDetail) => {
    setCreateDate(date);
    setCopySource(source ?? null);
  };

  const closeCreate = () => {
    setCreateDate(null);
    setCopySource(null);
    setEditingSession(null);
  };

  const refreshWeek = () => {
    queryClient.invalidateQueries({ queryKey: clinicQueryKeys.sessionsMonth });
    queryClient.invalidateQueries({ queryKey: clinicQueryKeys.participants });
  };

  const selectCalendarDate = (dateISO: string) => {
    setMonthAnchor(dateISO);
    setWeekAnchor(dateISO);
    setSelectedDate(dateISO);
    const next = new URLSearchParams(searchParams);
    next.set("date", dateISO);
    setSearchParams(next, { replace: true });
  };

  const loading = sessionsQ.isLoading || participantsQ.listQ.isLoading;
  const isCurrentMonth = dayjs(today).isSame(monthStart, "month");
  const monthHasSessions = (monthSessionsQ.data ?? []).some((session) =>
    dayjs(session.date).isSame(monthStart, "month")
  );
  const rangeLabel = weekStart.month() === weekEnd.month()
    ? `${weekStart.format("YYYY년 M월 D일")} – ${weekEnd.format("D일")}`
    : `${weekStart.format("YYYY년 M월 D일")} – ${weekEnd.format("M월 D일")}`;

  const selectedDaySessions = sessionsByDate.get(selectedDate) ?? [];

  return (
    <div className={`clinic-page ${styles.page}`}>
      <section className={styles.shell} aria-labelledby="clinic-schedule-title">
        <header className={styles.header}>
          <div>
            <h2 id="clinic-schedule-title" className={styles.title}>예약 일정</h2>
            <p className={styles.description}>
              달력에서 날짜를 고르고, 그날의 시간대와 예약 학생을 관리하세요.
            </p>
          </div>
          <div className={styles.headerActions}>
            <Button
              intent="secondary"
              size="md"
              leftIcon={<Copy size={ICON_FOR_BUTTON.md} />}
              onClick={() => setImportOpen(true)}
            >
              이전 주 복사
            </Button>
            <Button
              intent="primary"
              size="md"
              leftIcon={<CalendarPlus size={ICON_FOR_BUTTON.md} />}
              onClick={() => openCreate(selectedDate)}
            >
              클리닉 만들기
            </Button>
          </div>
        </header>

        <section
          className={styles.monthOverview}
          aria-label="월간 날짜 탐색"
        >
          <div id="clinic-month-calendar" className={styles.monthPanel}>
              <div className={styles.monthOverviewHeader}>
                <strong className={styles.monthTitle}>{monthStart.format("YYYY년 M월")}</strong>
                <div className={styles.monthControls} aria-label="월간 이동">
                  <Button
                    intent="ghost"
                    size="sm"
                    iconOnly
                    aria-label="이전 달"
                    leftIcon={<ChevronLeft size={ICON_FOR_BUTTON.sm} />}
                    onClick={() => selectCalendarDate(monthStart.subtract(1, "month").format("YYYY-MM-DD"))}
                  />
                  <Button
                    intent="secondary"
                    size="sm"
                    disabled={isCurrentMonth}
                    onClick={() => selectCalendarDate(today)}
                  >
                    이번 달
                  </Button>
                  <Button
                    intent="ghost"
                    size="sm"
                    iconOnly
                    aria-label="다음 달"
                    leftIcon={<ChevronRight size={ICON_FOR_BUTTON.sm} />}
                    onClick={() => selectCalendarDate(monthStart.add(1, "month").format("YYYY-MM-DD"))}
                  />
                  <Button
                    intent="ghost"
                    size="sm"
                    iconOnly
                    aria-label="일정 새로고침"
                    leftIcon={<RefreshCcw size={ICON_FOR_BUTTON.sm} />}
                    onClick={refreshWeek}
                  />
                </div>
              </div>

              <div className={styles.monthStatus} aria-live="polite">
                {monthSessionsQ.isLoading ? (
                  <span>월간 일정을 불러오는 중입니다.</span>
                ) : monthSessionsQ.isError ? (
                  <>
                    <span>월간 일정을 확인하지 못했습니다.</span>
                    <Button
                      intent="ghost"
                      size="sm"
                      aria-label="월간 일정 다시 불러오기"
                      onClick={() => monthSessionsQ.refetch()}
                    >
                      다시 불러오기
                    </Button>
                  </>
                ) : monthHasSessions ? (
                  <span>
                    선택 {dayjs(selectedDate).format("M월 D일")} · 시간대 {selectedDaySessions.length}개
                  </span>
                ) : (
                  <span>이번 달에 열린 시간대가 없습니다.</span>
                )}
              </div>

              <div
                className={styles.monthCalendar}
                role="grid"
                aria-label={`${monthStart.format("YYYY년 M월")} 클리닉 월간 달력`}
                onKeyDown={moveCalendarFocus}
              >
                <div className={styles.monthWeekdays} role="row">
                  {MONTH_DAY_LABELS.map((label) => (
                    <span key={label} role="columnheader">{label}</span>
                  ))}
                </div>
                {Array.from({ length: 6 }, (_, weekIndex) => (
                  <div key={weekIndex} className={styles.monthWeek} role="row">
                    {monthDays.slice(weekIndex * 7, weekIndex * 7 + 7).map((date) => {
                      const dateISO = date.format("YYYY-MM-DD");
                      const dateSessions = monthSessionsByDate.get(dateISO) ?? [];
                      const sessionCount = dateSessions.length;
                      const isFull = sessionCount > 0 && dateSessions.every((session) =>
                        session.max_participants > 0
                        && (session.booked_count ?? session.participant_count ?? 0) >= session.max_participants
                      );
                      const isSelected = dateISO === selectedDate;
                      const isToday = dateISO === today;
                      const isOutsideMonth = !date.isSame(monthStart, "month");
                      const loadLabel = monthSessionsQ.isLoading
                        ? "일정 불러오는 중"
                        : monthSessionsQ.isError
                          ? "일정 확인 실패"
                          : sessionCount === 0
                            ? "열린 클리닉 없음"
                            : `클리닉 ${sessionCount}개, ${isFull ? "마감" : "예약 가능"}`;

                      return (
                        <button
                          key={dateISO}
                          type="button"
                          role="gridcell"
                          className={`${styles.monthDay} ${
                            isSelected ? styles.monthDaySelected : ""
                          } ${isToday ? styles.monthDayToday : ""} ${
                            isOutsideMonth ? styles.monthDayOutside : ""
                          } ${sessionCount > 0 ? (isFull ? styles.monthDayFull : styles.monthDayOpen) : ""
                          }`}
                          aria-label={`${date.format("M월 D일")} ${MONTH_DAY_LABELS[date.day()]}요일, ${loadLabel}`}
                          aria-current={isToday ? "date" : undefined}
                          aria-selected={isSelected}
                          data-calendar-date={dateISO}
                          tabIndex={isSelected ? 0 : -1}
                          onClick={() => selectCalendarDate(dateISO)}
                        >
                          <span className={styles.monthDayNumber}>{date.format("D")}</span>
                          {(monthSessionsQ.isLoading || monthSessionsQ.isError || sessionCount > 0) && (
                            <span className={styles.monthDayCount}>
                              {monthSessionsQ.isLoading
                                ? "—"
                                : monthSessionsQ.isError
                                  ? "확인 실패"
                                  : `${sessionCount}개`}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
        </section>

        <section aria-labelledby="clinic-week-title">
          <div className={styles.toolbar}>
            <div className={styles.weekControls}>
              <Button intent="ghost" size="sm" iconOnly aria-label="이전 주"
                leftIcon={<ChevronLeft size={ICON_FOR_BUTTON.sm} />}
                onClick={() => selectCalendarDate(weekStart.subtract(7, "day").format("YYYY-MM-DD"))}
              />
              <Button intent="secondary" size="sm" onClick={() => selectCalendarDate(today)}>이번 주</Button>
              <Button intent="ghost" size="sm" iconOnly aria-label="다음 주"
                leftIcon={<ChevronRight size={ICON_FOR_BUTTON.sm} />}
                onClick={() => selectCalendarDate(weekStart.add(7, "day").format("YYYY-MM-DD"))}
              />
              <strong id="clinic-week-title" className={styles.range}>{rangeLabel}</strong>
            </div>
            <span className={styles.summary}>
              선택 {dayjs(selectedDate).format("M월 D일 (ddd)")}
            </span>
          </div>

          {loading ? (
            <div className={styles.loading}>주간 예약 일정을 불러오는 중입니다.</div>
          ) : sessionsQ.isError || participantsQ.listQ.isError ? (
            <div className={styles.error}>
              <EmptyState title="주간 예약 일정을 불러오지 못했습니다." description="잠시 후 다시 시도해주세요." />
              <Button intent="secondary" size="sm" onClick={refreshWeek}>다시 불러오기</Button>
            </div>
          ) : (
            <div className={styles.boardViewport} data-clinic-board-viewport>
              <div className={styles.board} role="grid" aria-label={`${rangeLabel} 클리닉 예약 일정`}>
                {days.map((date, index) => {
                  const dateISO = date.format("YYYY-MM-DD");
                  const daySessions = sessionsByDate.get(dateISO) ?? [];
                  const dayParticipants = activeParticipants(
                    daySessions.flatMap((session) => participantsBySession.get(session.id) ?? [])
                  );
                  const dayCapacity = daySessions.reduce(
                    (sum, session) => sum + Math.max(0, session.max_participants || 0),
                    0
                  );
                  const isToday = dateISO === today;
                  return (
                    <section key={dateISO} className={`${styles.day} ${isToday ? styles.today : ""}`}
                      role="gridcell" aria-label={`${date.format("M월 D일")} ${DAY_LABELS[index]}요일`}>
                      <div className={styles.dayHeader}>
                        <div>
                          <span className={styles.dayName}>
                            {DAY_LABELS[index]}
                            {isToday && <span className={styles.todayBadge}>오늘</span>}
                          </span>
                          <strong className={styles.dayDate}>{date.format("M/D")}</strong>
                        </div>
                        <span className={styles.dayLoad}>
                          <strong>{daySessions.length}개</strong>
                          <span>{dayParticipants.length}/{dayCapacity || 0}명</span>
                        </span>
                      </div>
                      <div className={styles.dayBody}>
                        {daySessions.length > 0 && (
                          <button type="button" className={styles.dayAddButton}
                            onClick={() => openCreate(dateISO)}>
                            <CalendarPlus size={ICON.sm} aria-hidden />
                            <span>시간대 추가</span>
                          </button>
                        )}
                        {daySessions.length === 0 ? (
                          <div className={styles.emptyDay}>
                            <Clock3 size={ICON.lg} aria-hidden />
                            <strong>열린 시간대가 없습니다</strong>
                            <Button intent="ghost" size="sm" onClick={() => openCreate(dateISO)}>시간대 만들기</Button>
                          </div>
                        ) : daySessions.map((session) => {
                          const rows = activeParticipants(participantsBySession.get(session.id) ?? []);
                          const capacity = Math.max(1, session.max_participants || 1);
                          const fillPercent = Math.min(100, Math.round((rows.length / capacity) * 100));
                          return (
                            <article key={session.id} className={styles.sessionCard}>
                              <div className={styles.cardTop}>
                                <span className={styles.time}><Clock3 size={ICON.sm} aria-hidden />
                                  {session.start_time.slice(0, 5)}–{sessionEndTime(session)}
                                </span>
                                <div className={styles.cardMetaActions}>
                                  <span className={`${styles.capacity} ${rows.length >= capacity ? styles.capacityFull : ""}`}>
                                    <Users size={ICON.sm} aria-hidden />{rows.length}/{session.max_participants || 0}
                                  </span>
                                  <Button intent="ghost" size="sm" iconOnly title="일정 수정"
                                    aria-label={`${session.title || "클리닉"} 일정 수정`}
                                    leftIcon={<Settings size={ICON_FOR_BUTTON.sm} />}
                                    onClick={() => setEditingSession(session)} />
                                  <Button intent="ghost" size="sm" iconOnly title="설정 복사"
                                    aria-label={`${session.title || "클리닉"} 설정 복사`}
                                    leftIcon={<Copy size={ICON_FOR_BUTTON.sm} />}
                                    onClick={() => openCreate(session.date, session)} />
                                </div>
                              </div>
                              <h3 className={styles.sessionTitle}>{session.title || "클리닉"}</h3>
                              <p className={styles.location}><MapPin size={ICON.sm} aria-hidden />{session.location || "장소 미정"}</p>
                              <div className={styles.progress} aria-label={`정원 ${fillPercent}% 예약`}>
                                {/* eslint-disable-next-line no-restricted-syntax -- 예약률은 API 데이터에 따라 연속적으로 변한다. */}
                                <span style={{ width: `${fillPercent}%` }} />
                              </div>
                              <div className={styles.participants}>
                                {rows.length === 0 ? <span className={styles.noParticipants}>예약 학생이 없습니다.</span>
                                  : rows.map((participant) => (
                                    <StudentDetailLink key={participant.id} studentId={participant.student}
                                      studentName={participant.student_name}>
                                      <StudentNameWithLectureChip name={participant.student_name}
                                        lectures={participantLectures(participant)}
                                        profilePhotoUrl={participant.profile_photo_url} avatarSize={20}
                                        enrollmentId={participant.enrollment_id}
                                        clinicHighlight={participant.name_highlight_clinic_target}
                                        density="compact" maxLectureChips={1} />
                                    </StudentDetailLink>
                                  ))}
                              </div>
                              <div className={styles.cardActions}>
                                <Button intent="primary" size="sm"
                                  onClick={() => navigate(`/workspace/clinic/operations?scope=day&date=${session.date}&session=${session.id}`)}>
                                  학생 관리
                                </Button>
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    </section>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      </section>

      <AdminModal
        open={!!createDate || !!editingSession}
        onClose={() => !editSaving && closeCreate()}
        closeDisabled={editSaving}
        width={520}
      >
        {(createDate || editingSession) && (
          <>
            <ModalHeader
              title={editingSession
                ? "클리닉 일정 수정"
                : copySource
                  ? "클리닉 설정 복사"
                  : "클리닉 만들기"}
              description={editingSession
                ? "날짜·시간·장소·정원을 바꾼 뒤 저장하세요."
                : copySource
                  ? "시간·장소·정원 설정을 불러왔습니다. 필요한 항목을 바꾼 뒤 새로 만드세요."
                  : `${dayjs(createDate).format("M월 D일 (ddd)")}에 새 시간대를 만듭니다.${
                      (sessionsByDate.get(createDate ?? "")?.length ?? 0) > 0
                        ? ` 현재 ${sessionsByDate.get(createDate ?? "")?.length ?? 0}개 시간대가 있습니다.`
                        : ""
                    }`}
            />
            <div className={styles.createModal}>
              <ClinicCreatePanel
                key={editingSession
                  ? `edit-${editingSession.id}`
                  : `${createDate}-${copySource?.id ?? "new"}`}
                asModal
                date={editingSession?.date ?? createDate ?? undefined}
                editSession={editingSession ?? undefined}
                copySession={copySource ?? undefined}
                onPendingChange={setEditSaving}
                onCreated={() => {
                  closeCreate();
                  refreshWeek();
                }}
                onUpdated={(notice) => {
                  const shouldOpenNotice = notice.changed && (editingSession?.participant_count ?? 0) > 0;
                  closeCreate();
                  refreshWeek();
                  if (shouldOpenNotice) {
                    navigate(`/workspace/clinic/operations?date=${notice.date}&session=${notice.sessionId}`, {
                      state: clinicChangeNoticeNavigationState(notice),
                    });
                  }
                }}
              />
            </div>
          </>
        )}
      </AdminModal>

      <PreviousWeekImportModal
        open={importOpen}
        onClose={() => {
          setImportOpen(false);
          refreshWeek();
        }}
        currentDate={weekFrom}
      />
    </div>
  );
}
