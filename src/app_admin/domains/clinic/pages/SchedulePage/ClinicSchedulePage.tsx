import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
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
  UserPlus,
  Users,
} from "lucide-react";

import { AdminModal } from "@/shared/ui/modal";
import { Button, EmptyState, ICON, ICON_FOR_BUTTON } from "@/shared/ui/ds";
import StudentNameWithLectureChip from "@/shared/ui/chips/StudentNameWithLectureChip";
import StudentDetailLink from "@admin/domains/students/public/StudentDetailLink";
import { feedback } from "@/shared/ui/feedback/feedback";

import { fetchClinicSessions, type ClinicSessionDetail } from "../../api/clinicSessions.api";
import type { ClinicParticipant } from "../../api/clinicParticipants.api";
import type { ClinicTarget } from "../../api/clinicTargets";
import { useClinicParticipants } from "../../hooks/useClinicParticipants";
import { clinicQueryKeys } from "../../queryKeys";
import ClinicCreatePanel from "../../components/ClinicCreatePanel";
import ClinicTargetSelectModal, {
  type ClinicTargetSelectResult,
} from "../../components/ClinicTargetSelectModal";
import PreviousWeekImportModal from "../../components/PreviousWeekImportModal";
import { addParticipantsToSession } from "../../services/addParticipantsToSession";
import styles from "./ClinicSchedulePage.module.css";

dayjs.locale("ko");

const ACTIVE_STATUSES = new Set(["pending", "booked", "attended", "no_show"]);
const DAY_LABELS = ["월", "화", "수", "목", "금", "토", "일"];

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

function addResultMessage(result: Awaited<ReturnType<typeof addParticipantsToSession>>) {
  const parts = [`${result.added}명 추가`];
  if (result.skipped > 0) parts.push(`${result.skipped}명 이미 등록`);
  if (result.failed > 0) parts.push(`${result.failed}명 실패`);
  return parts.join(" · ");
}

export default function ClinicSchedulePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const today = dayjs().format("YYYY-MM-DD");
  const [weekAnchor, setWeekAnchor] = useState(today);
  const weekStart = useMemo(() => mondayOfWeek(weekAnchor), [weekAnchor]);
  const weekEnd = useMemo(() => weekStart.add(6, "day"), [weekStart]);
  const weekFrom = weekStart.format("YYYY-MM-DD");
  const weekTo = weekEnd.format("YYYY-MM-DD");
  const days = useMemo(
    () => Array.from({ length: 7 }, (_, index) => weekStart.add(index, "day")),
    [weekStart]
  );

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

  const participantsBySession = useMemo(() => {
    const grouped = new Map<number, ClinicParticipant[]>();
    for (const participant of participantsQ.listQ.data ?? []) {
      const list = grouped.get(participant.session) ?? [];
      list.push(participant);
      grouped.set(participant.session, list);
    }
    return grouped;
  }, [participantsQ.listQ.data]);

  const activeBookingCount = useMemo(
    () => activeParticipants(participantsQ.listQ.data ?? []).length,
    [participantsQ.listQ.data]
  );

  const [createDate, setCreateDate] = useState<string | null>(null);
  const [copySource, setCopySource] = useState<ClinicSessionDetail | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [targetSession, setTargetSession] = useState<ClinicSessionDetail | null>(null);
  const [addingParticipants, setAddingParticipants] = useState(false);

  const openCreate = (date: string, source?: ClinicSessionDetail) => {
    setCreateDate(date);
    setCopySource(source ?? null);
  };

  const closeCreate = () => {
    setCreateDate(null);
    setCopySource(null);
  };

  const refreshWeek = () => {
    queryClient.invalidateQueries({ queryKey: clinicQueryKeys.sessionsMonth });
    queryClient.invalidateQueries({ queryKey: clinicQueryKeys.participants });
  };

  const handleAddParticipants = async (selection: ClinicTargetSelectResult) => {
    if (!targetSession || addingParticipants) return;
    setAddingParticipants(true);
    try {
      const result = await addParticipantsToSession({
        sessionId: targetSession.id,
        selection,
        currentParticipants: participantsQ.listQ.data ?? [],
        clinicTargets:
          queryClient.getQueryData<ClinicTarget[]>(
            clinicQueryKeys.targetsBySection(null)
          ) ?? [],
      });
      if (result.failed > 0) feedback.warning(addResultMessage(result));
      else feedback.success(addResultMessage(result));
      refreshWeek();
    } catch {
      feedback.error("학생을 추가하지 못했습니다.");
    } finally {
      setAddingParticipants(false);
      setTargetSession(null);
    }
  };

  const loading = sessionsQ.isLoading || participantsQ.listQ.isLoading;
  const isCurrentWeek = weekFrom === mondayOfWeek(today).format("YYYY-MM-DD");
  const rangeLabel = weekStart.month() === weekEnd.month()
    ? `${weekStart.format("YYYY년 M월 D일")} – ${weekEnd.format("D일")}`
    : `${weekStart.format("YYYY년 M월 D일")} – ${weekEnd.format("M월 D일")}`;

  return (
    <div className={`clinic-page ${styles.page}`}>
      <section className={styles.shell} aria-labelledby="clinic-schedule-title">
        <header className={styles.header}>
          <div>
            <p className={styles.eyebrow}>WEEKLY RESERVATION BOARD</p>
            <h2 id="clinic-schedule-title" className={styles.title}>예약 일정</h2>
            <p className={styles.description}>
              한 주의 클리닉을 열고, 카드에서 바로 학생을 배정하세요.
            </p>
          </div>
          <div className={styles.headerActions}>
            <Button
              intent="secondary"
              size="md"
              leftIcon={<Copy size={ICON_FOR_BUTTON.md} />}
              onClick={() => setImportOpen(true)}
            >
              이전 주 불러오기
            </Button>
            <Button
              intent="primary"
              size="md"
              leftIcon={<CalendarPlus size={ICON_FOR_BUTTON.md} />}
              onClick={() => openCreate(isCurrentWeek ? today : weekFrom)}
            >
              클리닉 만들기
            </Button>
          </div>
        </header>

        <div className={styles.toolbar}>
          <div className={styles.weekControls} aria-label="주간 이동">
            <Button
              intent="ghost"
              size="sm"
              iconOnly
              aria-label="이전 주"
              leftIcon={<ChevronLeft size={ICON_FOR_BUTTON.sm} />}
              onClick={() => setWeekAnchor(weekStart.subtract(7, "day").format("YYYY-MM-DD"))}
            />
            <Button
              intent="secondary"
              size="sm"
              disabled={isCurrentWeek}
              onClick={() => setWeekAnchor(today)}
            >
              이번 주
            </Button>
            <Button
              intent="ghost"
              size="sm"
              iconOnly
              aria-label="다음 주"
              leftIcon={<ChevronRight size={ICON_FOR_BUTTON.sm} />}
              onClick={() => setWeekAnchor(weekStart.add(7, "day").format("YYYY-MM-DD"))}
            />
            <strong className={styles.range}>{rangeLabel}</strong>
          </div>
          <div className={styles.summary}>
            <span>세션 <strong>{sessionsQ.data?.length ?? 0}</strong>개</span>
            <span>예약 <strong>{activeBookingCount}</strong>명</span>
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

        {loading ? (
          <div className={styles.loading}>예약 일정을 불러오는 중입니다.</div>
        ) : sessionsQ.isError || participantsQ.listQ.isError ? (
          <div className={styles.error}>
            <EmptyState title="예약 일정을 불러오지 못했습니다." description="잠시 후 다시 시도해주세요." />
            <Button intent="secondary" size="sm" onClick={refreshWeek}>다시 불러오기</Button>
          </div>
        ) : (
          <div className={styles.boardViewport}>
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
                  <section
                    key={dateISO}
                    className={`${styles.day} ${isToday ? styles.today : ""}`}
                    role="gridcell"
                    aria-label={`${date.format("M월 D일")} ${DAY_LABELS[index]}요일`}
                  >
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
                      <button
                        type="button"
                        className={styles.dayAddButton}
                        aria-label={`${date.format("M월 D일")} 클리닉 시간대 추가`}
                        onClick={() => openCreate(dateISO)}
                      >
                        <CalendarPlus size={ICON.sm} aria-hidden />
                        <span>{daySessions.length === 0 ? "첫 시간대 만들기" : "시간대 추가"}</span>
                      </button>

                      {daySessions.length === 0 ? (
                        <div className={styles.emptyDay}>
                          <Clock3 size={ICON.lg} aria-hidden />
                          <strong>아직 열린 시간대가 없습니다</strong>
                          <span>위 버튼에서 첫 수업을 개설하세요.</span>
                        </div>
                      ) : daySessions.map((session) => {
                          const rows = activeParticipants(participantsBySession.get(session.id) ?? []);
                          const capacity = Math.max(1, session.max_participants || 1);
                          const fillPercent = Math.min(100, Math.round((rows.length / capacity) * 100));
                          const visibleRows = rows.slice(0, 3);

                          return (
                            <article key={session.id} className={styles.sessionCard}>
                              <div className={styles.cardTop}>
                                <span className={styles.time}>
                                  <Clock3 size={ICON.sm} aria-hidden />
                                  {session.start_time.slice(0, 5)}–{sessionEndTime(session)}
                                </span>
                                <span
                                  className={`${styles.capacity} ${
                                    rows.length >= capacity ? styles.capacityFull : ""
                                  }`}
                                >
                                  <Users size={ICON.sm} aria-hidden />
                                  {rows.length}/{session.max_participants || 0}
                                </span>
                              </div>
                              <h3 className={styles.sessionTitle}>
                                {session.title || "클리닉"}
                              </h3>
                              <p className={styles.location}>
                                <MapPin size={ICON.sm} aria-hidden />
                                {session.location || "장소 미정"}
                              </p>
                              <div className={styles.progress} aria-label={`정원 ${fillPercent}% 예약`}>
                                {/* eslint-disable-next-line no-restricted-syntax -- 예약률은 API 데이터에 따라 연속적으로 변한다. */}
                                <span style={{ width: `${fillPercent}%` }} />
                              </div>

                              <div className={styles.participants}>
                                {visibleRows.length === 0 ? (
                                  <span className={styles.noParticipants}>아직 예약한 학생이 없습니다.</span>
                                ) : (
                                  visibleRows.map((participant) => (
                                    <StudentDetailLink
                                      key={participant.id}
                                      studentId={participant.student}
                                      studentName={participant.student_name}
                                    >
                                      <StudentNameWithLectureChip
                                        name={participant.student_name}
                                        lectures={participantLectures(participant)}
                                        profilePhotoUrl={participant.profile_photo_url}
                                        avatarSize={20}
                                        enrollmentId={participant.enrollment_id}
                                        clinicHighlight={participant.name_highlight_clinic_target}
                                        density="compact"
                                        maxLectureChips={1}
                                      />
                                    </StudentDetailLink>
                                  ))
                                )}
                                {rows.length > visibleRows.length && (
                                  <span className={styles.moreParticipants}>
                                    +{rows.length - visibleRows.length}명 더
                                  </span>
                                )}
                              </div>

                              <div className={styles.cardActions}>
                                <Button
                                  intent="primary"
                                  size="sm"
                                  leftIcon={<UserPlus size={ICON_FOR_BUTTON.sm} />}
                                  onClick={() => setTargetSession(session)}
                                >
                                  학생 추가
                                </Button>
                                <Button
                                  intent="ghost"
                                  size="sm"
                                  aria-label={`${session.title || "클리닉"} 설정 복사`}
                                  title="설정 복사"
                                  leftIcon={<Copy size={ICON_FOR_BUTTON.sm} />}
                                  onClick={() => openCreate(session.date, session)}
                                >
                                  복사
                                </Button>
                                <Button
                                  intent="ghost"
                                  size="sm"
                                  onClick={() =>
                                    navigate(`/workspace/clinic/operations?date=${session.date}&session=${session.id}`)
                                  }
                                >
                                  진행
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

      <AdminModal open={!!createDate} onClose={closeCreate} width={520}>
        {createDate && (
          <div className={styles.createModal}>
            <div className={styles.createModalHeader}>
              <h2>{copySource ? "클리닉 설정 복사" : "클리닉 만들기"}</h2>
              <p>
                {copySource
                  ? "시간·장소·정원 설정을 불러왔습니다. 필요한 항목을 바꾼 뒤 새로 만드세요."
                  : `${dayjs(createDate).format("M월 D일 (ddd)")}에 새 시간대를 만듭니다.${
                      (sessionsByDate.get(createDate)?.length ?? 0) > 0
                        ? ` 현재 ${sessionsByDate.get(createDate)?.length ?? 0}개 시간대가 있습니다.`
                        : ""
                    }`}
              </p>
            </div>
            <ClinicCreatePanel
              key={`${createDate}-${copySource?.id ?? "new"}`}
              asModal
              date={createDate}
              copySession={copySource ?? undefined}
              onCreated={() => {
                closeCreate();
                refreshWeek();
              }}
            />
          </div>
        )}
      </AdminModal>

      <ClinicTargetSelectModal
        open={!!targetSession}
        onClose={() => !addingParticipants && setTargetSession(null)}
        onConfirm={handleAddParticipants}
      />

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
