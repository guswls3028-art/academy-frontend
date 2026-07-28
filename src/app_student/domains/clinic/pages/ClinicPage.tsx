/**
 * 클리닉 홈 — 패스카드(리모콘 연동) + 내 예약 현황 + 일정/예약
 *
 * - 실시간 패스카드: 선생 앱 리모콘 색상 연동, 클리닉 인증용
 * - 내 예약 현황: 승인 대기 / 승인됨 실데이터
 * - 캘린더 + 예약 신청
 */
import { useEffect, useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { AxiosError } from "axios";

type ApiErrorBody = { detail?: string; message?: string };
import { useConfirm } from "@/shared/ui/confirm";
import { studentToast } from "@student/shared/ui/feedback/studentToast";
import StudentPageShell from "@student/shared/ui/pages/StudentPageShell";
import ClinicCalendar from "@student/shared/ui/components/ClinicCalendar";
import {
  fetchMyClinicBookingRequests,
  fetchAvailableClinicSessions,
  createClinicBookingRequest,
  cancelClinicBookingRequest,
  changeClinicBooking,
  type ClinicSession,
} from "../api/clinicBooking.api";
import {
  fetchClinicIdcard,
  type ClinicCurrentTarget,
} from "@student/domains/clinic-idcard/api/idcard";
import { hhmmText as formatTime } from "@/shared/ui/time/timeFormat";
import { formatYmd, todayYmd } from "@student/shared/utils/date";
import EmptyState from "@student/layout/EmptyState";
import { studentClinicQueryKeys } from "../queryKeys";
import LectureChip from "@/shared/ui/chips/LectureChip";
import styles from "./ClinicPage.module.css";

function isSessionFull(session: ClinicSession): boolean {
  if (typeof session.is_full === "boolean") return session.is_full;
  return (
    session.max_participants != null &&
    (session.booked_count ?? 0) >= session.max_participants
  );
}

function sessionMatchesTargets(
  session: ClinicSession,
  targetLectureIds: ReadonlySet<number>,
): boolean {
  if (targetLectureIds.size === 0) return false;
  const sessionLectureIds = (session.target_lecture_names ?? []).map(
    (lecture) => lecture.id,
  );
  return (
    sessionLectureIds.length === 0 ||
    sessionLectureIds.some((lectureId) => targetLectureIds.has(lectureId))
  );
}

function targetReasonLabel(target: ClinicCurrentTarget): string {
  return target.source_type === "homework" ? "과제 보강" : "시험 보강";
}

export default function ClinicPage() {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [memo, setMemo] = useState("");
  const [activeTab, setActiveTab] = useState<"book" | "schedule">("book");

  // 내 예약 신청 목록 조회 (알림·클리닉 공통 키로 캐시 공유)
  const { data: myRequests = [], isLoading: requestsLoading, isError: requestsError, refetch: refetchRequests } = useQuery({
    queryKey: studentClinicQueryKeys.bookings,
    queryFn: fetchMyClinicBookingRequests,
  });

  // 예약 가능한 세션 목록 조회
  const { data: sessions = [], isLoading: sessionsLoading, isError: sessionsError, refetch: refetchSessions } = useQuery({
    queryKey: studentClinicQueryKeys.availableSessions,
    queryFn: () => {
      const today = todayYmd();
      const from = new Date(today);
      const to = new Date(from);
      to.setDate(to.getDate() + 60);
      return fetchAvailableClinicSessions({
        date_from: today,
        date_to: `${to.getFullYear()}-${String(to.getMonth() + 1).padStart(2, "0")}-${String(to.getDate()).padStart(2, "0")}`,
      });
    },
  });
  const {
    data: clinicStatus,
    isLoading: clinicStatusLoading,
    isError: clinicStatusError,
    refetch: refetchClinicStatus,
  } = useQuery({
    queryKey: studentClinicQueryKeys.idcard,
    queryFn: fetchClinicIdcard,
    staleTime: 30_000,
  });
  const currentTargets = useMemo(
    () => clinicStatus?.current_targets ?? [],
    [clinicStatus],
  );
  const currentTargetLectureIds = useMemo(
    () => new Set(currentTargets.map((target) => target.lecture_id)),
    [currentTargets],
  );
  const hasClinicRequirement =
    currentTargets.length > 0 || clinicStatus?.current_result === "FAIL";

  // 예약 신청 mutation
  const bookingMutation = useMutation({
    mutationFn: (data: { session: number; memo?: string }) =>
      createClinicBookingRequest(data),
    onSuccess: (data, variables) => {
      const sess = sessions.find(s => s.id === variables.session);
      const bookedCount = sess ? (sess.booked_count ?? 0) + 1 : null;
      qc.invalidateQueries({ queryKey: studentClinicQueryKeys.availableSessions });
      qc.invalidateQueries({ queryKey: studentClinicQueryKeys.bookings });
      qc.invalidateQueries({ queryKey: studentClinicQueryKeys.idcard });
      qc.invalidateQueries({ queryKey: studentClinicQueryKeys.notificationCounts });
      setSelectedSessionId(null);
      setMemo("");
      const baseMessage = data.status === "booked" ? "예약이 확정되었습니다." : "예약 신청이 접수되었습니다.";
      studentToast.success(
        bookedCount != null
          ? `${baseMessage} (현재 예약인원 ${bookedCount}명)`
          : baseMessage
      );
    },
    onError: (error: AxiosError<ApiErrorBody>) => {
      const message =
        error?.response?.data?.detail ||
        error?.response?.data?.message ||
        "예약 신청에 실패했습니다. 다시 시도해주세요.";
      studentToast.error(message);
    },
  });

  // 예약 취소 mutation
  const cancelMutation = useMutation({
    mutationFn: (id: number) => cancelClinicBookingRequest(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: studentClinicQueryKeys.bookings });
      qc.invalidateQueries({ queryKey: studentClinicQueryKeys.availableSessions });
      qc.invalidateQueries({ queryKey: studentClinicQueryKeys.idcard });
      qc.invalidateQueries({ queryKey: studentClinicQueryKeys.notificationCounts });
      studentToast.success("예약 신청이 취소되었습니다.");
    },
    onError: (error: AxiosError<ApiErrorBody>) => {
      studentToast.error(error?.response?.data?.detail || "취소에 실패했습니다.");
    },
  });

  // 예약 변경 mutation (atomic: 새 예약 실패 시 기존 예약 보존)
  const changeMutation = useMutation({
    mutationFn: (data: { oldId: number; newSessionId: number; memo?: string }) =>
      changeClinicBooking(data.oldId, data.newSessionId, data.memo),
    onSuccess: (data, variables) => {
      const sess = sessions.find(s => s.id === variables.newSessionId);
      const bookedCount = sess ? (sess.booked_count ?? 0) + 1 : null;
      qc.invalidateQueries({ queryKey: studentClinicQueryKeys.availableSessions });
      qc.invalidateQueries({ queryKey: studentClinicQueryKeys.bookings });
      qc.invalidateQueries({ queryKey: studentClinicQueryKeys.idcard });
      qc.invalidateQueries({ queryKey: studentClinicQueryKeys.notificationCounts });
      setSelectedSessionId(null);
      setMemo("");
      const baseMessage = data.status === "booked" ? "일정 변경이 확정되었습니다." : "일정 변경 신청이 접수되었습니다.";
      studentToast.success(
        bookedCount != null
          ? `${baseMessage} (현재 예약인원 ${bookedCount}명)`
          : baseMessage
      );
    },
    onError: (error: AxiosError<ApiErrorBody>) => {
      const message =
        error?.response?.data?.detail ||
        error?.response?.data?.message ||
        "일정 변경에 실패했습니다. 기존 예약은 유지됩니다.";
      studentToast.error(message);
    },
  });

  // 첫 화면에서 가장 가까운 예약 가능 날짜를 바로 열어 불필요한 달력 탐색을 줄인다.
  // 미통과 대상 강의와 맞는 세션을 같은 날짜 안에서 우선한다.
  useEffect(() => {
    if (selectedDate || clinicStatusLoading || sessions.length === 0) return;

    const activeBooking = myRequests.find(
      (request) =>
        request.session_date >= todayYmd() &&
        (request.status === "pending" || request.status === "booked"),
    );
    if (activeBooking) {
      setSelectedDate(activeBooking.session_date);
      setSelectedSessionId(activeBooking.session);
      return;
    }

    const nextSession = [...sessions]
      .filter((session) => !isSessionFull(session))
      .sort((a, b) => {
        const dateDiff = a.date.localeCompare(b.date);
        if (dateDiff !== 0) return dateDiff;
        const recommendedDiff =
          Number(sessionMatchesTargets(b, currentTargetLectureIds)) -
          Number(sessionMatchesTargets(a, currentTargetLectureIds));
        if (recommendedDiff !== 0) return recommendedDiff;
        return a.start_time.localeCompare(b.start_time);
      })[0];
    if (!nextSession) return;
    setSelectedDate(nextSession.date);
    setSelectedSessionId(nextSession.id);
  }, [
    clinicStatusLoading,
    currentTargetLectureIds,
    myRequests,
    selectedDate,
    sessions,
  ]);

  // 날짜 선택 핸들러
  const handleDateSelect = (date: string) => {
    setSelectedDate(date);

    const existingBooking = myRequests.find((r) => r.session_date === date);
    if (existingBooking && (existingBooking.status === "pending" || existingBooking.status === "booked")) {
      setSelectedSessionId(existingBooking.session ?? null);
      return;
    }

    const firstOpenSession = sessions
      .filter((session) => session.date === date && !isSessionFull(session))
      .sort((a, b) => {
        const recommendedDiff =
          Number(sessionMatchesTargets(b, currentTargetLectureIds)) -
          Number(sessionMatchesTargets(a, currentTargetLectureIds));
        if (recommendedDiff !== 0) return recommendedDiff;
        return a.start_time.localeCompare(b.start_time);
      })[0];
    setSelectedSessionId(firstOpenSession?.id ?? null);
  };

  // 예약 신청 핸들러 — 등록 가능한 클리닉(세션)만 신청 가능
  const handleBooking = () => {
    if (bookingMutation.isPending || cancelMutation.isPending || changeMutation.isPending) return;
    if (!selectedSessionId) {
      studentToast.info("등록 가능한 클리닉 시간을 선택해주세요.");
      return;
    }
    bookingMutation.mutate({
      session: selectedSessionId,
      memo: memo.trim() || undefined,
    });
  };

  // 일정 변경 신청 핸들러 (atomic: 새 예약 확보 후에만 기존 취소)
  const handleChangeRequest = () => {
    if (changeMutation.isPending || bookingMutation.isPending || cancelMutation.isPending) return;
    if (!selectedDate) {
      studentToast.info("날짜를 선택해주세요.");
      return;
    }

    const existingBooking = myRequests.find(
      (r) =>
        r.session_date === selectedDate &&
        (r.status === "pending" || r.status === "booked")
    );
    if (!existingBooking) {
      studentToast.error("변경할 예약을 찾을 수 없습니다.");
      return;
    }
    if (existingBooking.status !== "pending") {
      studentToast.info("승인된 예약 변경은 학원으로 연락해 주세요.");
      return;
    }

    if (!selectedSessionId) {
      studentToast.info("변경할 클리닉 시간을 선택해주세요.");
      return;
    }

    if (selectedSessionId === existingBooking.session) {
      studentToast.info("현재 예약과 같은 시간입니다. 다른 시간을 선택해주세요.");
      return;
    }

    changeMutation.mutate({
      oldId: existingBooking.id,
      newSessionId: selectedSessionId,
      memo: memo.trim() || undefined,
    });
  };

  const isLoading = requestsLoading || sessionsLoading;

  // 예약 상태별 분류
  const pendingBookings = useMemo(
    () => myRequests.filter((r) => r.status === "pending"),
    [myRequests]
  );
  const approvedBookings = useMemo(
    () => myRequests.filter((r) => r.status === "booked"),
    [myRequests]
  );
  const rejectedBookings = useMemo(
    () => myRequests
      .filter((r) => r.status === "rejected")
      .sort((a, b) => b.session_date.localeCompare(a.session_date)),
    [myRequests]
  );

  // 예약 가능한 날짜 목록: 해당 날짜에 클리닉(세션)이 있거나, 내 예약이 있는 날
  const availableDates = useMemo(() => {
    const dates = new Set<string>();
    sessions.forEach((s) => dates.add(s.date));
    myRequests.forEach((r) => {
      if (r.status === "pending" || r.status === "booked") {
        dates.add(r.session_date);
      }
    });
    return Array.from(dates);
  }, [sessions, myRequests]);

  // 날짜별 정원 상태 (스펙: 풀면=초록, 차면=노랑, 다차면=빨강) — 선생앱과 동일 규칙
  const dateCapacityStatus = useMemo(() => {
    const byDate = new Map<string, typeof sessions>();
    sessions.forEach((s) => {
      if (!byDate.has(s.date)) byDate.set(s.date, []);
      byDate.get(s.date)!.push(s);
    });
    const result: Record<string, "green" | "yellow" | "red"> = {};
    byDate.forEach((sessList, dateStr) => {
      if (sessList.length === 0) return;
      const maxList = sessList.map((s) => s.max_participants ?? 0);
      const bookedList = sessList.map((s) => s.booked_count ?? 0);
      const allFull = maxList.every((max, i) => max > 0 && bookedList[i] >= max);
      const anyFull = maxList.some((max, i) => max > 0 && bookedList[i] >= max);
      if (allFull) result[dateStr] = "red";
      else if (anyFull) result[dateStr] = "yellow";
      else result[dateStr] = "green";
    });
    return result;
  }, [sessions]);

  // 선택한 날짜의 세션 정보
  const selectedDateSessions = useMemo(() => {
    if (!selectedDate) return [];
    return sessions
      .filter((s) => s.date === selectedDate)
      .sort((a, b) => {
        const recommendedDiff =
          Number(sessionMatchesTargets(b, currentTargetLectureIds)) -
          Number(sessionMatchesTargets(a, currentTargetLectureIds));
        if (recommendedDiff !== 0) return recommendedDiff;
        return a.start_time.localeCompare(b.start_time);
      });
  }, [currentTargetLectureIds, selectedDate, sessions]);

  // 선택한 세션이 정원 마감인지
  const selectedSessionIsFull = useMemo(() => {
    if (!selectedSessionId || selectedDateSessions.length === 0) return false;
    const s = selectedDateSessions.find((x) => x.id === selectedSessionId);
    if (!s || s.max_participants == null) return false;
    return (s.booked_count ?? 0) >= s.max_participants;
  }, [selectedSessionId, selectedDateSessions]);

  // 선택한 날짜의 기존 예약
  const existingBookingForDate = useMemo(() => {
    if (!selectedDate) return null;
    return myRequests.find(
      (r) =>
        r.session_date === selectedDate &&
        (r.status === "pending" || r.status === "booked")
    );
  }, [selectedDate, myRequests]);

  const isChangeMode = existingBookingForDate != null;
  const existingBookingIsApproved =
    existingBookingForDate?.status === "booked";
  const existingBookingCanChange = existingBookingForDate?.status === "pending";
  const bookingChangeLocked = existingBookingForDate != null && !existingBookingCanChange;
  const activeBookingCount = pendingBookings.length + approvedBookings.length;

  if (isLoading) {
    return (
      <StudentPageShell title="클리닉">
        <div className={styles.loadingStack}>
          <div className={`stu-skel ${styles.loadingCard}`} />
          <div className={`stu-skel ${styles.loadingCard}`} />
          <div className={`stu-skel ${styles.loadingCard}`} />
        </div>
      </StudentPageShell>
    );
  }

  // 두 쿼리 모두 실패한 경우 전체 에러 화면
  if (sessionsError || requestsError) {
    return (
      <StudentPageShell title="클리닉">
        <EmptyState
          title="클리닉 정보를 불러오지 못했습니다"
          description="네트워크 연결을 확인하고 다시 시도해 주세요."
        />
        <div className={styles.retryWrap}>
          <button
            type="button"
            className="stu-btn stu-btn--secondary"
            onClick={() => { refetchSessions(); refetchRequests(); }}
          >
            다시 시도
          </button>
        </div>
      </StudentPageShell>
    );
  }

  return (
    <StudentPageShell title="클리닉">
      <div data-guide="clinic-list" className={styles.pageStack}>
        {/* 탭 바 */}
        <div className={styles.tabBar}>
          <button
            type="button"
            onClick={() => setActiveTab("book")}
            className={`${styles.tabButton} ${activeTab === "book" ? styles.tabButtonActive : ""}`}
          >
            예약
            {activeBookingCount > 0 && (
              <span className={styles.tabBadge}>
                {activeBookingCount}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("schedule")}
            className={`${styles.tabButton} ${activeTab === "schedule" ? styles.tabButtonActive : ""}`}
          >
            내 일정
            {activeBookingCount > 0 && (
              <span className={styles.tabBadge}>
                {activeBookingCount}
              </span>
            )}
          </button>
        </div>

        {/* ===== 예약 탭 ===== */}
        {activeTab === "book" && (<>
        <section
          className={`${styles.targetSummary} ${
            hasClinicRequirement ? styles.targetSummaryRequired : ""
          }`}
          aria-label="내 클리닉 대상 현황"
        >
          <div className={styles.targetSummaryHeader}>
            <div>
              <p className={styles.targetSummaryEyebrow}>내 보강 현황</p>
              <h2 className={styles.targetSummaryTitle}>
                {clinicStatusLoading
                  ? "보강 항목을 확인하고 있어요"
                  : clinicStatusError
                    ? "보강 항목을 불러오지 못했어요"
                    : currentTargets.length > 0
                      ? `보강이 필요한 항목 ${currentTargets.length}개`
                      : hasClinicRequirement
                        ? "보강이 필요한 항목이 있어요"
                        : "현재 보강이 필요한 항목이 없어요"}
              </h2>
            </div>
            {hasClinicRequirement && !clinicStatusError && (
              <span className={styles.targetSummaryCount}>
                {currentTargets.length > 0 ? "예약할 일정 선택" : "학원 안내 확인"}
              </span>
            )}
          </div>

          {clinicStatusError ? (
            <div className={styles.targetSummaryError}>
              <p className={styles.targetSummaryDescription}>
                네트워크 연결을 확인한 뒤 다시 불러와 주세요.
              </p>
              <button
                type="button"
                className={`stu-btn stu-btn--secondary ${styles.targetRetry}`}
                onClick={() => refetchClinicStatus()}
              >
                다시 불러오기
              </button>
            </div>
          ) : !clinicStatusLoading && currentTargets.length > 0 ? (
            <div className={styles.targetList}>
              {currentTargets.slice(0, 3).map((target) => (
                <div key={target.clinic_link_id} className={styles.targetItem}>
                  <LectureChip
                    lectureName={target.lecture_title}
                    color={target.lecture_color ?? undefined}
                    chipLabel={target.lecture_chip_label}
                  />
                  <span className={styles.targetItemTitle}>
                    {target.session_title || `${target.session_order}차시`}
                  </span>
                  <span className={styles.targetItemReason}>
                    {targetReasonLabel(target)}
                  </span>
                </div>
              ))}
              {currentTargets.length > 3 && (
                <p className={styles.targetMore}>
                  보강 항목 {currentTargets.length - 3}개가 더 있어요.
                </p>
              )}
            </div>
          ) : !clinicStatusLoading ? (
            <p className={styles.targetSummaryDescription}>
              {hasClinicRequirement
                ? "학원에서 안내받은 강의에 맞춰 아래 열린 일정을 선택해 주세요."
                : "학원에서 별도로 안내받은 경우 아래 열린 일정에서 예약할 수 있어요."}
            </p>
          ) : null}
        </section>

        {/* 달력 */}
        {sessions.length > 0 ? (
          <ClinicCalendar
            selectedDate={selectedDate}
            onDateSelect={handleDateSelect}
            bookings={myRequests}
            availableDates={availableDates}
            dateCapacityStatus={dateCapacityStatus}
          />
        ) : (
          <div className="stu-section stu-section--nested">
            <EmptyState
              title="지금 예약 가능한 일정이 없습니다"
              description="학원에서 클리닉 일정을 열면 이곳에서 바로 예약할 수 있어요."
            />
          </div>
        )}

        {/* 선택한 날짜의 예약 필드 */}
        {selectedDate && (
          <div className="stu-section stu-section--nested">
            <div className={styles.sectionTitle}>
              {formatYmd(selectedDate)}{" "}
              {isChangeMode
                ? existingBookingCanChange
                  ? "일정 변경"
                  : "예약 확인"
                : "예약하기"}
            </div>

            {existingBookingForDate && (
              <div
                className={`stu-panel ${styles.currentBookingPanel} ${existingBookingIsApproved ? styles.currentBookingPanelApproved : ""}`}
              >
                <div className={styles.currentBookingTitle}>
                  현재 예약: {formatTime(existingBookingForDate.session_start_time)}
                  {existingBookingForDate.session_location && ` @ ${existingBookingForDate.session_location}`}
                </div>
                <div className={`stu-muted ${styles.smallMuted}`}>
                  상태:{" "}
                  {existingBookingIsApproved ? "승인됨" : "승인 대기"}
                </div>
              </div>
            )}

            <div className={styles.formStack}>
              {/* 시간 선택 — 해당 날짜에 열린 클리닉만 표시, 정원 마감 시 비활성 + 시각 효과 */}
              <div>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>
                    클리닉 시간
                  </span>

                  {selectedDateSessions.length === 0 ? (
                    <div
                      className={`stu-panel ${styles.emptySessionPanel}`}
                    >
                      이 날짜에는 등록 가능한 클리닉이 없습니다. 다른 날짜를 선택해주세요.
                    </div>
                  ) : (
                    <div className={styles.sessionList}>
                      {selectedDateSessions.map((session) => {
                        const isFull = isSessionFull(session);
                        const isSelected = selectedSessionId === session.id;
                        const isDisabled = isFull || bookingChangeLocked;
                        const isRecommended = sessionMatchesTargets(
                          session,
                          currentTargetLectureIds,
                        );
                        const remaining =
                          session.max_participants != null
                            ? Math.max(0, session.max_participants - (session.booked_count ?? 0))
                            : null;

                        return (
                          <button
                            key={session.id}
                            type="button"
                            disabled={isDisabled}
                            className={`stu-panel ${styles.sessionButton} ${
                              isFull
                                ? styles.sessionButtonFull
                                : bookingChangeLocked
                                  ? styles.sessionButtonLocked
                                  : "stu-panel--pressable"
                            } ${isSelected && !isDisabled ? `stu-panel--accent ${styles.sessionButtonSelected}` : ""}`}
                            onClick={() => {
                              if (isDisabled) return;
                              setSelectedSessionId(session.id);
                            }}
                          >
                            <div className={styles.sessionRow}>
                              <div>
                                <div className={styles.sessionTitle}>
                                  {formatTime(session.start_time)}
                                  {session.title ? ` — ${session.title}` : ""}
                                </div>
                                <div className={`stu-muted ${styles.sessionMeta}`}>
                                  {session.location}
                                  {session.target_grade ? ` · ${session.target_grade}학년` : ""}
                                </div>
                                {(session.target_lecture_names?.length ?? 0) > 0 && (
                                  <div className={styles.sessionLectures}>
                                    {session.target_lecture_names?.map((lecture) => (
                                      <LectureChip
                                        key={lecture.id}
                                        lectureName={lecture.title}
                                        color={lecture.color ?? undefined}
                                        chipLabel={lecture.chip_label}
                                      />
                                    ))}
                                  </div>
                                )}
                              </div>
                              <div className={styles.sessionAside}>
                                {isRecommended && (
                                  <span className={styles.recommendedBadge}>
                                    내 보강 일정
                                  </span>
                                )}
                                {isFull ? (
                                  <span className={styles.fullBadge}>
                                    정원 마감
                                  </span>
                                ) : remaining != null ? (
                                  <span className={`stu-muted ${styles.smallMuted}`}>
                                    잔여 {remaining}명
                                  </span>
                                ) : null}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </label>
              </div>

                {/* 메모 입력 */}
                <div>
                  <label className={styles.field}>
                    <span className={styles.fieldLabel}>
                      메모 (선택)
                    </span>
                    <textarea
                      value={memo}
                      onChange={(e) => setMemo(e.target.value)}
                      placeholder="예약 시 참고사항을 입력해주세요."
                      className={`stu-textarea ${styles.fullWidth}`}
                      rows={3}
                    />
                  </label>
                </div>

              {/* 예약 신청 / 일정 변경 버튼 */}
              {!existingBookingForDate && (
                <button
                  type="button"
                  className={`stu-btn stu-btn--primary ${styles.fullWidth}`}
                  disabled={!selectedSessionId || selectedSessionIsFull || bookingMutation.isPending || cancelMutation.isPending || changeMutation.isPending}
                  onClick={handleBooking}
                >
                  {bookingMutation.isPending ? "처리 중…" : "예약 신청하기"}
                </button>
              )}

              {existingBookingForDate && (
                existingBookingCanChange ? (
                  <button
                    type="button"
                    className={`stu-btn stu-btn--secondary ${styles.fullWidth}`}
                    disabled={
                      !selectedSessionId ||
                      selectedSessionIsFull ||
                      changeMutation.isPending ||
                      bookingMutation.isPending ||
                      cancelMutation.isPending ||
                      selectedDateSessions.length === 0
                    }
                    onClick={handleChangeRequest}
                  >
                    {changeMutation.isPending
                      ? "처리 중…"
                      : "일정 변경 신청하기"}
                  </button>
                ) : (
                  <div className={`stu-panel ${styles.lockedNotice}`}>
                    승인된 예약은 학생 앱에서 직접 변경할 수 없습니다. 변경이 필요하면 학원으로 연락해 주세요.
                  </div>
                )
              )}

              {(bookingMutation.isError || cancelMutation.isError || changeMutation.isError) && (
                <div className={`stu-muted ${styles.errorText}`}>
                  {isChangeMode ? "일정 변경에 실패했습니다. 기존 예약은 유지됩니다." : "예약 신청에 실패했습니다."} 다시 시도해주세요.
                </div>
              )}
            </div>
          </div>
        )}

        </>)}

        {/* ===== 내 일정 탭 ===== */}
        {activeTab === "schedule" && (<>
        {/* 내 예약 현황 (클리닉 신청자 실데이터) */}
        <div className="stu-section stu-section--nested">
          <div className={styles.scheduleHeader}>
            <div className={styles.scheduleTitle}>내 예약 현황</div>
            {(pendingBookings.length > 0 || approvedBookings.length > 0) && (
              <span className={`stu-muted ${styles.scheduleCount}`}>
                승인 대기 {pendingBookings.length}건 · 승인됨 {approvedBookings.length}건
              </span>
            )}
          </div>

          {/* 승인 대기 */}
          {pendingBookings.length > 0 && (
            <div className={styles.bookingGroup}>
              <div className={styles.groupTitle}>
                승인 대기
                <span className="stu-badge stu-badge--warn stu-badge--sm">{pendingBookings.length}</span>
              </div>
              <div className={styles.bookingList}>
                {pendingBookings.map((request) => (
                  <div key={request.id} className={`stu-panel ${styles.pendingPanel}`}>
                    <div className={styles.requestRow}>
                      <div>
                        <div className={styles.requestTitle}>
                          {request.session_title && (
                            <span className={styles.requestSessionTitle}>
                              {request.session_title}
                            </span>
                          )}
                          {formatYmd(request.session_date)} {formatTime(request.session_start_time)}
                        </div>
                        <div className={`stu-muted ${styles.smallMuted}`}>
                          {request.session_location}
                        </div>
                      </div>
                      <button
                        type="button"
                        className={`stu-btn stu-btn--secondary ${styles.cancelButton}`}
                        disabled={cancelMutation.isPending}
                        onClick={async () => {
                          if (await confirm({ title: "예약 취소", message: "예약을 취소할까요?", confirmText: "취소", danger: true })) {
                            cancelMutation.mutate(request.id);
                          }
                        }}
                      >
                        예약 취소
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 승인됨 — 취소 불가 (백엔드 정책: 승인 후 취소는 선생님만 가능) */}
          {approvedBookings.length > 0 && (
            <div>
              <div className={styles.groupTitle}>
                승인됨
                <span className="stu-badge stu-badge--success stu-badge--sm">{approvedBookings.length}</span>
              </div>
              <div className={styles.bookingList}>
                {approvedBookings.map((request) => (
                  <div
                    key={request.id}
                    className={`stu-panel ${styles.approvedPanel}`}
                  >
                    <div className={styles.requestRow}>
                      <div>
                        <div className={styles.requestTitle}>
                          {request.session_title && (
                            <span className={styles.requestSessionTitle}>
                              {request.session_title}
                            </span>
                          )}
                          {formatYmd(request.session_date)} {formatTime(request.session_start_time)}
                        </div>
                        <div className={`stu-muted ${styles.smallMuted}`}>
                          {request.session_location}
                        </div>
                      </div>
                      <span className={`${styles.statusPill} ${styles.confirmedPill}`}>
                        확정
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 거절됨 */}
          {rejectedBookings.length > 0 && (
            <div className={styles.rejectedGroup}>
              <div className={styles.groupTitle}>
                거절됨 ({rejectedBookings.length})
              </div>
              <div className={styles.bookingList}>
                {rejectedBookings.map((request) => (
                  <div
                    key={request.id}
                    className={`stu-panel ${styles.rejectedPanel}`}
                  >
                    <div className={styles.requestRow}>
                      <div>
                        <div className={styles.requestTitle}>
                          {request.session_title && (
                            <span className={styles.requestSessionTitle}>
                              {request.session_title}
                            </span>
                          )}
                          {formatYmd(request.session_date)} {formatTime(request.session_start_time)}
                        </div>
                        {request.session_location && (
                          <div className={`stu-muted ${styles.smallMuted}`}>
                            {request.session_location}
                          </div>
                        )}
                      </div>
                      <span className={`${styles.statusPill} ${styles.rejectedPill}`}>
                        거절됨
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {pendingBookings.length === 0 && approvedBookings.length === 0 && rejectedBookings.length === 0 && (
            <EmptyState
              title="예약 내역이 없습니다"
              description="예약 탭에서 클리닉을 신청해 보세요."
            />
          )}
        </div>
        </>)}
      </div>
    </StudentPageShell>
  );
}
