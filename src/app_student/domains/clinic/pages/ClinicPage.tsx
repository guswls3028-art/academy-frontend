import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import { Link } from "react-router";

import { useConfirm } from "@/shared/ui/confirm";
import LectureChip from "@/shared/ui/chips/LectureChip";
import { hhmmText as formatTime } from "@/shared/ui/time/timeFormat";
import { useTrackedTask } from "@/shared/productAnalytics";
import EmptyState from "@student/layout/EmptyState";
import StudentPageShell from "@student/shared/ui/pages/StudentPageShell";
import { studentToast } from "@student/shared/ui/feedback/studentToast";
import { studentQueryKeys } from "@student/shared/api/queryKeys";
import { formatYmd, todayYmd } from "@student/shared/utils/date";
import {
  cancelClinicBookingRequest,
  changeClinicBooking,
  createClinicBookingRequests,
  fetchAvailableClinicSessions,
  fetchMyClinicBookingRequests,
  type ClinicBookingRequest,
  type ClinicSession,
} from "../api/clinicBooking.api";
import {
  fetchStudentClinicSummary,
  type ClinicCurrentTarget,
} from "../api/clinicSummary.api";
import { studentClinicQueryKeys } from "../queryKeys";
import ClinicBookingCalendar from "../components/ClinicBookingCalendar";
import ClinicMultiSlotSelectionPanel from "../components/ClinicMultiSlotSelectionPanel";
import styles from "./ClinicPage.module.css";

type ApiErrorBody = { detail?: string; message?: string };
type ClinicTab = "book" | "schedule";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"] as const;

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

function targetResolutionLink(target: ClinicCurrentTarget): { to: string; label: string } | null {
  const sourceId = Number(target.source_id);
  if (!Number.isInteger(sourceId) || sourceId <= 0) return null;
  if (target.source_type === "homework") {
    return {
      to: `/student/submit/assignment?sessionId=${target.session_id}&homeworkId=${sourceId}`,
      label: "과제 온라인 제출",
    };
  }
  if (target.source_type === "exam") {
    return { to: `/student/exams/${sourceId}`, label: "시험 확인·제출" };
  }
  return null;
}

function sortTargetsNewestFirst(
  left: ClinicCurrentTarget,
  right: ClinicCurrentTarget,
): number {
  const createdDifference = String(right.created_at ?? "").localeCompare(
    String(left.created_at ?? ""),
  );
  if (createdDifference !== 0) return createdDifference;
  return right.clinic_link_id - left.clinic_link_id;
}

function displayTargetText(value: string | null | undefined, fallback: string): string {
  return value?.trim() || fallback;
}

function dateParts(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  const weekday = WEEKDAYS[new Date(year, month - 1, day).getDay()];
  return {
    month,
    day,
    weekday,
    ariaLabel: `${year}년 ${month}월 ${day}일 ${weekday}요일`,
  };
}

function sortBookings(left: ClinicBookingRequest, right: ClinicBookingRequest) {
  return `${left.session_date} ${left.session_start_time}`.localeCompare(
    `${right.session_date} ${right.session_start_time}`,
  );
}

function hasValidPreferredRange(
  session: ClinicSession,
  preferredStart: string,
  preferredEnd: string,
): boolean {
  const sessionStart = session.start_time.slice(0, 5);
  const sessionEnd = session.end_time?.slice(0, 5);
  return !!sessionEnd && (
    sessionStart <= preferredStart &&
    preferredStart < preferredEnd &&
    preferredEnd <= sessionEnd
  );
}

function preferredRangeText(request: ClinicBookingRequest): string | null {
  if (!request.preferred_start_time || !request.preferred_end_time) return null;
  return `희망 ${formatTime(request.preferred_start_time)}–${formatTime(request.preferred_end_time)}`;
}

export default function ClinicPage() {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const runTrackedTask = useTrackedTask();
  const [activeTab, setActiveTab] = useState<ClinicTab>("book");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSessionIds, setSelectedSessionIds] = useState<number[]>([]);
  const [rangeStartSessionId, setRangeStartSessionId] = useState<number | null>(null);
  const [selectionNotice, setSelectionNotice] = useState<string | null>(null);
  const [changingBookingId, setChangingBookingId] = useState<number | null>(null);
  const [memo, setMemo] = useState("");
  const [preferredStart, setPreferredStart] = useState("");
  const [preferredEnd, setPreferredEnd] = useState("");

  const {
    data: myRequests = [],
    isLoading: requestsLoading,
    isError: requestsError,
    refetch: refetchRequests,
  } = useQuery({
    queryKey: studentClinicQueryKeys.bookings,
    queryFn: fetchMyClinicBookingRequests,
  });

  const {
    data: sessions = [],
    isLoading: sessionsLoading,
    isError: sessionsError,
    refetch: refetchSessions,
  } = useQuery({
    queryKey: studentClinicQueryKeys.availableSessions,
    queryFn: () => {
      const today = todayYmd();
      const from = new Date(`${today}T00:00:00`);
      const to = new Date(from);
      to.setDate(to.getDate() + 60);
      return fetchAvailableClinicSessions({
        date_from: today,
        date_to: `${to.getFullYear()}-${String(to.getMonth() + 1).padStart(2, "0")}-${String(to.getDate()).padStart(2, "0")}`,
      });
    },
  });

  const {
    data: clinicSummary,
    isLoading: clinicSummaryLoading,
    isError: clinicSummaryError,
    refetch: refetchClinicSummary,
  } = useQuery({
    queryKey: studentClinicQueryKeys.summary,
    queryFn: fetchStudentClinicSummary,
    staleTime: 30_000,
  });

  const currentTargets = useMemo(
    () => [...(clinicSummary?.current_targets ?? [])].sort(sortTargetsNewestFirst),
    [clinicSummary],
  );
  const currentTargetLectureIds = useMemo(
    () => new Set(currentTargets.map((target) => target.lecture_id)),
    [currentTargets],
  );
  const hasClinicRequirement =
    currentTargets.length > 0 || clinicSummary?.current_result === "FAIL";

  const pendingBookings = useMemo(
    () => myRequests.filter((request) => request.status === "pending").sort(sortBookings),
    [myRequests],
  );
  const approvedBookings = useMemo(
    () =>
      myRequests
        .filter(
          (request) =>
            request.status === "booked" && request.session_date >= todayYmd(),
        )
        .sort(sortBookings),
    [myRequests],
  );
  const rejectedBookings = useMemo(
    () =>
      myRequests
        .filter((request) => request.status === "rejected")
        .sort((left, right) => right.session_date.localeCompare(left.session_date))
        .slice(0, 3),
    [myRequests],
  );
  const activeBookingCount = pendingBookings.length + approvedBookings.length;
  const changingBooking = useMemo(
    () => myRequests.find((request) => request.id === changingBookingId) ?? null,
    [changingBookingId, myRequests],
  );

  const orderedSessions = useMemo(
    () =>
      [...sessions].sort((left, right) => {
        const dateDifference = left.date.localeCompare(right.date);
        if (dateDifference !== 0) return dateDifference;
        const timeDifference = left.start_time.localeCompare(right.start_time);
        if (timeDifference !== 0) return timeDifference;
        const recommendedDifference =
          Number(sessionMatchesTargets(right, currentTargetLectureIds)) -
          Number(sessionMatchesTargets(left, currentTargetLectureIds));
        if (recommendedDifference !== 0) return recommendedDifference;
        return left.id - right.id;
      }),
    [currentTargetLectureIds, sessions],
  );
  const sessionGroups = useMemo(() => {
    const groups = new Map<string, ClinicSession[]>();
    orderedSessions.forEach((session) => {
      groups.set(session.date, [...(groups.get(session.date) ?? []), session]);
    });
    return Array.from(groups.entries()).map(([date, dateSessions]) => ({
      date,
      sessions: dateSessions,
    }));
  }, [orderedSessions]);
  const selectedSessionGroup = sessionGroups.find((group) => group.date === selectedDate) ?? null;
  const selectedDateParts = selectedSessionGroup ? dateParts(selectedSessionGroup.date) : null;
  const selectedSessions = orderedSessions.filter((session) => (
    selectedSessionIds.includes(session.id)
  ));
  const selectedSessionsInGroup = selectedSessionGroup?.sessions.filter((session) => (
    selectedSessionIds.includes(session.id)
  )) ?? [];
  const selectedSession = selectedSessions.length === 1 ? selectedSessions[0] : null;
  const activeBookedSessions = orderedSessions.filter((session) => myRequests.some(
    (request) => request.session === session.id &&
      (request.status === "pending" || request.status === "booked"),
  ));

  useEffect(() => {
    if (sessionGroups.length === 0) {
      setSelectedDate(null);
      return;
    }
    if (selectedDate && sessionGroups.some((group) => group.date === selectedDate)) return;
    setSelectedDate(sessionGroups[0].date);
  }, [selectedDate, sessionGroups]);

  useEffect(() => {
    setSelectedSessionIds((current) => {
      const available = current.filter((sessionId) => {
        const session = orderedSessions.find((item) => item.id === sessionId);
        if (!session || isSessionFull(session) || session.id === changingBooking?.session) {
          return false;
        }
        return !myRequests.some(
          (request) => request.session === session.id &&
            (request.status === "pending" || request.status === "booked"),
        );
      });
      const policySafe = available.length > 1 && available.some((sessionId) => (
        orderedSessions.find((session) => session.id === sessionId)?.allow_multi_slot_booking !== true
      ))
        ? available.slice(0, 1)
        : available;
      return policySafe.length === current.length && policySafe.every((id, index) => id === current[index])
        ? current
        : policySafe;
    });
  }, [changingBooking?.session, myRequests, orderedSessions]);

  useEffect(() => {
    setRangeStartSessionId((current) => (
      current != null && selectedSessionIds.includes(current)
        ? current
        : selectedSessionIds[0] ?? null
    ));
  }, [selectedSessionIds]);

  const bookingMutation = useMutation({
    mutationFn: (data: {
      session_ids: number[];
      student_request_memo?: string;
      preferred_start_time?: string;
      preferred_end_time?: string;
    }) =>
      runTrackedTask("clinic.booking.create", () => createClinicBookingRequests(data)),
    onSuccess: (data, variables) => {
      const session = variables.session_ids.length === 1
        ? sessions.find((item) => item.id === variables.session_ids[0])
        : null;
      const bookedCount = session ? (session.booked_count ?? 0) + 1 : null;
      queryClient.invalidateQueries({ queryKey: studentClinicQueryKeys.availableSessions });
      queryClient.invalidateQueries({ queryKey: studentClinicQueryKeys.bookings });
      queryClient.invalidateQueries({ queryKey: studentClinicQueryKeys.summary });
      queryClient.invalidateQueries({ queryKey: studentQueryKeys.clinicIdcard });
      queryClient.invalidateQueries({ queryKey: studentClinicQueryKeys.notificationCounts });
      setMemo("");
      setPreferredStart("");
      setPreferredEnd("");
      setSelectedSessionIds([]);
      setRangeStartSessionId(null);
      setSelectionNotice(null);
      const allBooked = data.every((booking) => booking.status === "booked");
      const message = variables.session_ids.length > 1
        ? `${variables.session_ids.length}개 시간대 예약${allBooked ? "이 확정되었습니다." : " 신청이 접수되었습니다."}`
        : allBooked ? "예약이 확정되었습니다." : "예약 신청이 접수되었습니다.";
      studentToast.success(
        bookedCount == null ? message : `${message} (현재 예약인원 ${bookedCount}명)`,
      );
    },
    onError: (error: AxiosError<ApiErrorBody>) => {
      studentToast.error(
        error.response?.data?.detail ||
          error.response?.data?.message ||
          "예약 신청에 실패했습니다. 다시 시도해 주세요.",
      );
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (id: number) =>
      runTrackedTask("clinic.booking.cancel", () => cancelClinicBookingRequest(id)),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: studentClinicQueryKeys.bookings });
      queryClient.invalidateQueries({ queryKey: studentClinicQueryKeys.availableSessions });
      queryClient.invalidateQueries({ queryKey: studentClinicQueryKeys.summary });
      queryClient.invalidateQueries({ queryKey: studentQueryKeys.clinicIdcard });
      queryClient.invalidateQueries({ queryKey: studentClinicQueryKeys.notificationCounts });
      if (changingBookingId === id) setChangingBookingId(null);
      studentToast.success("예약 신청이 취소되었습니다.");
    },
    onError: (error: AxiosError<ApiErrorBody>) => {
      studentToast.error(error.response?.data?.detail || "취소에 실패했습니다.");
    },
  });

  const changeMutation = useMutation({
    mutationFn: (data: {
      oldId: number;
      newSessionId: number;
      studentRequestMemo?: string;
      preferredStartTime?: string;
      preferredEndTime?: string;
    }) =>
      runTrackedTask(
        "clinic.booking.change",
        () => changeClinicBooking(
          data.oldId,
          data.newSessionId,
          data.studentRequestMemo,
          data.preferredStartTime,
          data.preferredEndTime,
        ),
      ),
    onSuccess: (data, variables) => {
      const session = sessions.find((item) => item.id === variables.newSessionId);
      const bookedCount = session ? (session.booked_count ?? 0) + 1 : null;
      queryClient.invalidateQueries({ queryKey: studentClinicQueryKeys.availableSessions });
      queryClient.invalidateQueries({ queryKey: studentClinicQueryKeys.bookings });
      queryClient.invalidateQueries({ queryKey: studentClinicQueryKeys.summary });
      queryClient.invalidateQueries({ queryKey: studentQueryKeys.clinicIdcard });
      queryClient.invalidateQueries({ queryKey: studentClinicQueryKeys.notificationCounts });
      setChangingBookingId(null);
      setMemo("");
      setPreferredStart("");
      setPreferredEnd("");
      const message = data.status === "booked"
        ? "일정 변경이 확정되었습니다."
        : "일정 변경 신청이 접수되었습니다.";
      studentToast.success(
        bookedCount == null ? message : `${message} (현재 예약인원 ${bookedCount}명)`,
      );
    },
    onError: (error: AxiosError<ApiErrorBody>) => {
      studentToast.error(
        error.response?.data?.detail ||
          error.response?.data?.message ||
          "일정 변경에 실패했습니다. 기존 예약은 유지됩니다.",
      );
    },
  });

  const mutationsPending =
    bookingMutation.isPending || cancelMutation.isPending || changeMutation.isPending;

  const submitBooking = () => {
    if (mutationsPending) return;
    if (selectedSessionIds.length === 0) {
      studentToast.info("예약할 클리닉 일정을 선택해 주세요.");
      return;
    }
    if (
      selectedSessionIds.length > 1 &&
      selectedSessions.some((session) => session.allow_multi_slot_booking !== true)
    ) {
      studentToast.info("여러 시간대 예약이 가능한 일정끼리만 함께 선택해 주세요.");
      return;
    }
    if (selectedSession?.allow_time_preference && (preferredStart || preferredEnd) && (
      !selectedSession ||
      !preferredStart ||
      !preferredEnd ||
      !hasValidPreferredRange(selectedSession, preferredStart, preferredEnd)
    )) {
      studentToast.info("희망 시작과 종료를 운영 시간 안에서 확인해 주세요.");
      return;
    }
    bookingMutation.mutate({
      session_ids: selectedSessionIds,
      student_request_memo: memo.trim() || undefined,
      preferred_start_time: selectedSession?.allow_time_preference ? preferredStart || undefined : undefined,
      preferred_end_time: selectedSession?.allow_time_preference ? preferredEnd || undefined : undefined,
    });
  };

  const submitChange = () => {
    if (mutationsPending) return;
    if (!changingBooking) {
      studentToast.error("변경할 예약을 찾을 수 없습니다.");
      return;
    }
    const selectedSessionId = selectedSessionIds[0];
    if (!selectedSessionId) {
      studentToast.info("변경할 클리닉 일정을 선택해 주세요.");
      return;
    }
    if (selectedSessionId === changingBooking.session) {
      studentToast.info("현재 예약과 다른 일정을 선택해 주세요.");
      return;
    }
    if (selectedSession?.allow_time_preference && (preferredStart || preferredEnd) && (
      !selectedSession ||
      !preferredStart ||
      !preferredEnd ||
      !hasValidPreferredRange(selectedSession, preferredStart, preferredEnd)
    )) {
      studentToast.info("희망 시작과 종료를 운영 시간 안에서 확인해 주세요.");
      return;
    }
    changeMutation.mutate({
      oldId: changingBooking.id,
      newSessionId: selectedSessionId,
      studentRequestMemo: memo.trim() || undefined,
      preferredStartTime: selectedSession?.allow_time_preference ? preferredStart || undefined : undefined,
      preferredEndTime: selectedSession?.allow_time_preference ? preferredEnd || undefined : undefined,
    });
  };

  const startChangingBooking = (request: ClinicBookingRequest) => {
    setChangingBookingId(request.id);
    setSelectedDate(request.session_date);
    setSelectedSessionIds([]);
    setRangeStartSessionId(null);
    setSelectionNotice(null);
    setMemo(request.student_request_memo ?? "");
    setPreferredStart("");
    setPreferredEnd("");
    setActiveTab("book");
  };

  const selectCalendarDate = (date: string) => {
    setSelectedDate(date);
    setSelectedSessionIds((current) => current.filter((sessionId) => (
      orderedSessions.find((session) => session.id === sessionId)?.date === date
    )));
    setRangeStartSessionId((current) => (
      orderedSessions.find((session) => session.id === current)?.date === date ? current : null
    ));
    setPreferredStart("");
    setPreferredEnd("");
    setSelectionNotice(null);
  };

  const selectSessionRange = (session: ClinicSession) => {
    setPreferredStart("");
    setPreferredEnd("");
    setSelectionNotice(null);

    if (changingBooking) {
      setSelectedSessionIds([session.id]);
      setRangeStartSessionId(session.id);
      return;
    }

    const policyBlockedByExisting = activeBookedSessions.some((activeSession) => (
      activeSession.id !== session.id &&
      activeSession.date === session.date &&
      (
        activeSession.allow_multi_slot_booking !== true ||
        session.allow_multi_slot_booking !== true
      )
    ));
    if (policyBlockedByExisting) {
      setSelectionNotice("이미 한 타임 전용 예약이 있어 같은 날 다른 시간대를 함께 선택할 수 없어요.");
      return;
    }

    const groupSessions = sessionGroups.find((group) => group.date === session.date)?.sessions ?? [];
    const anchorId = rangeStartSessionId ?? selectedSessionIds[0];
    const anchor = groupSessions.find((item) => item.id === anchorId);
    if (!anchor || anchor.date !== session.date) {
      setSelectedSessionIds([session.id]);
      setRangeStartSessionId(session.id);
      return;
    }
    if (anchor.id === session.id) {
      setSelectedSessionIds((current) => current.length === 1 ? [] : [session.id]);
      setRangeStartSessionId((current) => current === session.id ? null : session.id);
      return;
    }

    const anchorIndex = groupSessions.findIndex((item) => item.id === anchor.id);
    const endIndex = groupSessions.findIndex((item) => item.id === session.id);
    const range = groupSessions.slice(
      Math.min(anchorIndex, endIndex),
      Math.max(anchorIndex, endIndex) + 1,
    );
    if (range.some((item) => item.allow_multi_slot_booking !== true)) {
      setSelectionNotice("한 타임 전용 일정이 포함되어 여러 시간대를 함께 선택할 수 없어요.");
      return;
    }
    if (range.some((item) => (
      isSessionFull(item) ||
      myRequests.some((request) => (
        request.session === item.id &&
        (request.status === "pending" || request.status === "booked")
      ))
    ))) {
      setSelectionNotice("사이에 마감되었거나 이미 예약한 시간대가 있어 연속 선택할 수 없어요.");
      return;
    }
    const contiguous = range.every((item, index) => (
      index === 0 || range[index - 1].end_time?.slice(0, 5) === item.start_time.slice(0, 5)
    ));
    if (!contiguous) {
      setSelectionNotice("시간 사이에 빈 구간이 있어 연속으로 선택할 수 없어요.");
      return;
    }
    setSelectedSessionIds(range.map((item) => item.id));
  };

  if (requestsLoading || sessionsLoading) {
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
            onClick={() => {
              refetchSessions();
              refetchRequests();
            }}
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
        <div className={styles.tabBar} role="tablist" aria-label="클리닉 메뉴">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "book"}
            onClick={() => setActiveTab("book")}
            className={`${styles.tabButton} ${activeTab === "book" ? styles.tabButtonActive : ""}`}
          >
            예약하기
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "schedule"}
            onClick={() => setActiveTab("schedule")}
            className={`${styles.tabButton} ${activeTab === "schedule" ? styles.tabButtonActive : ""}`}
          >
            내 일정
            {activeBookingCount > 0 && (
              <span className={styles.tabBadge}>{activeBookingCount}</span>
            )}
          </button>
        </div>

        {activeTab === "book" && (
          <>
            <section
              className={`${styles.targetSummary} ${hasClinicRequirement ? styles.targetSummaryRequired : ""}`}
              aria-label="내 클리닉 대상 현황"
            >
              <div className={styles.targetSummaryHeader}>
                <div>
                  <p className={styles.targetSummaryEyebrow}>내 보강 현황</p>
                  <h2 className={styles.targetSummaryTitle}>
                    {clinicSummaryLoading
                      ? "보강 항목을 확인하고 있어요"
                      : clinicSummaryError
                        ? "보강 항목을 불러오지 못했어요"
                        : currentTargets.length > 0
                          ? `보강이 필요한 항목 ${currentTargets.length}개`
                          : hasClinicRequirement
                            ? "보강이 필요한 항목이 있어요"
                            : "현재 보강이 필요한 항목이 없어요"}
                  </h2>
                </div>
                {hasClinicRequirement && !clinicSummaryError && (
                  <span className={styles.targetSummaryCount}>일정 선택 필요</span>
                )}
              </div>

              {clinicSummaryError ? (
                <div className={styles.targetSummaryError}>
                  <p className={styles.targetSummaryDescription}>
                    네트워크 연결을 확인한 뒤 다시 불러와 주세요.
                  </p>
                  <button
                    type="button"
                    className={`stu-btn stu-btn--secondary ${styles.targetRetry}`}
                    onClick={() => refetchClinicSummary()}
                  >
                    다시 불러오기
                  </button>
                </div>
              ) : !clinicSummaryLoading && currentTargets.length > 0 ? (
                <div className={styles.targetList} data-testid="clinic-target-list">
                  {currentTargets.map((target) => {
                    const resolutionLink = targetResolutionLink(target);
                    return (
                      <div
                        key={target.clinic_link_id}
                        className={styles.targetItem}
                        data-testid="clinic-target-item"
                      >
                      <div className={styles.targetItemHeader}>
                        <LectureChip
                          lectureName={target.lecture_title}
                          color={target.lecture_color ?? undefined}
                          chipLabel={target.lecture_chip_label}
                        />
                        <span className={styles.targetItemReason}>
                          {targetReasonLabel(target)}
                        </span>
                      </div>
                      <strong className={styles.targetItemSource}>
                        {displayTargetText(target.source_title, "원본명 미입력")}
                      </strong>
                      <div className={styles.targetItemMeta}>
                        <span>
                          단원/범위 {displayTargetText(target.source_scope, "미입력")}
                        </span>
                        <span>
                          차시 {displayTargetText(
                            target.session_title,
                            `${target.session_order}차시`,
                          )}
                        </span>
                      </div>
                      {resolutionLink && (
                        <Link className={styles.targetResolutionLink} to={resolutionLink.to}>
                          {resolutionLink.label}
                        </Link>
                      )}
                      </div>
                    );
                  })}
                </div>
              ) : !clinicSummaryLoading ? (
                <p className={styles.targetSummaryDescription}>
                  {hasClinicRequirement
                    ? "학원에서 안내받은 강의에 맞춰 열린 일정을 선택해 주세요."
                    : "학원에서 별도로 안내받은 경우에도 열린 일정에서 예약할 수 있어요."}
                </p>
              ) : null}
            </section>

            {changingBooking && (
              <section className={styles.changeBanner} aria-label="변경 중인 예약">
                <div>
                  <span className={styles.changeBannerLabel}>일정 변경 중</span>
                  <strong>{changingBooking.session_title || "클리닉 수업"}</strong>
                  <span>
                    {formatYmd(changingBooking.session_date)} {formatTime(changingBooking.session_start_time)} ·{" "}
                    {changingBooking.session_location || "장소 추후 안내"}
                  </span>
                </div>
                <button
                  type="button"
                  className={styles.changeCancelButton}
                  onClick={() => {
                    setChangingBookingId(null);
                    setSelectedSessionIds([]);
                    setRangeStartSessionId(null);
                    setSelectionNotice(null);
                    setMemo("");
                    setPreferredStart("");
                    setPreferredEnd("");
                  }}
                >
                  변경 취소
                </button>
              </section>
            )}

            <section className={styles.openSchedule} aria-labelledby="clinic-open-schedule-title">
              <header className={styles.openScheduleHeader}>
                <div>
                  <p className={styles.openScheduleEyebrow}>예약 가능한 수업</p>
                  <h2 id="clinic-open-schedule-title">열린 일정</h2>
                  <p className={styles.openScheduleGuide}>
                    {changingBooking
                      ? "변경할 시간대 하나를 선택해 주세요."
                      : "‘여러 시간대 가능’ 일정끼리는 같은 날짜에 함께 선택할 수 있어요."}
                  </p>
                </div>
                <div
                  className={styles.openScheduleSummary}
                  aria-label={`${sessionGroups.length}일, ${orderedSessions.length}개 시간대`}
                >
                  <strong>{sessionGroups.length}일</strong>
                  <span>{orderedSessions.length}개 시간대</span>
                </div>
              </header>

              {sessionGroups.length === 0 ? (
                <EmptyState
                  title="지금 예약 가능한 일정이 없습니다"
                  description="학원에서 클리닉 일정을 열면 이곳에 날짜별로 표시됩니다."
                />
              ) : (
                <>
                  <ClinicBookingCalendar
                    sessions={orderedSessions}
                    bookings={myRequests}
                    selectedDate={selectedDate}
                    onDateSelect={selectCalendarDate}
                  />
                  {selectedSessionGroup && selectedDateParts && (
                    <section
                      className={styles.dateGroup}
                      aria-label={selectedDateParts.ariaLabel}
                    >
                      <time className={styles.dateTicket} dateTime={selectedSessionGroup.date}>
                        <span>{selectedDateParts.month}월</span>
                        <strong>{selectedDateParts.day}</strong>
                        <span>{selectedDateParts.weekday}요일</span>
                        <small>{selectedSessionGroup.sessions.length}개 수업</small>
                      </time>
                      <div className={styles.dateSessions}>
                        {selectedSessionGroup.sessions.map((session) => {
                            const full = isSessionFull(session);
                            const selected = selectedSessionIds.includes(session.id);
                            const recommended = sessionMatchesTargets(
                              session,
                              currentTargetLectureIds,
                            );
                            const currentChangingSession = changingBooking?.session === session.id;
                            const activeRequest = myRequests.find(
                              (request) =>
                                request.session === session.id &&
                                (request.status === "pending" || request.status === "booked"),
                            );
                            const policyBlockedBySelection = !selected && selectedSessions.some(
                              (item) => item.date === session.date,
                            ) && (
                              session.allow_multi_slot_booking !== true ||
                              selectedSessions.some((item) => (
                                item.date === session.date && item.allow_multi_slot_booking !== true
                              ))
                            );
                            const policyBlockedByExisting = activeBookedSessions.some((activeSession) => (
                              activeSession.id !== session.id &&
                              activeSession.date === session.date &&
                              (
                                activeSession.allow_multi_slot_booking !== true ||
                                session.allow_multi_slot_booking !== true
                              )
                            ));
                            const disabled = full || currentChangingSession || !!activeRequest;
                            const remaining = session.max_participants == null
                              ? null
                              : Math.max(
                                  0,
                                  session.max_participants - (session.booked_count ?? 0),
                                );

                            return (
                              <article
                                key={session.id}
                                className={`${styles.sessionCard} ${selected ? styles.sessionCardSelected : ""}`}
                              >
                                <button
                                  type="button"
                                  className={styles.sessionSelectButton}
                                  disabled={disabled}
                                  aria-pressed={selected}
                                  onClick={() => selectSessionRange(session)}
                                >
                                  <div className={styles.sessionPrimary}>
                                    <span className={styles.sessionTime}>
                                      {formatTime(session.start_time)}
                                      {session.end_time ? `–${formatTime(session.end_time)}` : ""}
                                    </span>
                                    <span className={styles.sessionTitle}>
                                      {session.title || "클리닉 수업"}
                                    </span>
                                    <span className={styles.sessionLocation}>
                                      {session.location || "장소 추후 안내"}
                                      {session.target_grade ? ` · ${session.target_grade}학년` : ""}
                                    </span>
                                    {(session.target_lecture_names?.length ?? 0) > 0 && (
                                      <span className={styles.sessionLectures}>
                                        {session.target_lecture_names?.map((lecture) => (
                                          <LectureChip
                                            key={lecture.id}
                                            lectureName={lecture.title}
                                            color={lecture.color ?? undefined}
                                            chipLabel={lecture.chip_label}
                                          />
                                        ))}
                                      </span>
                                    )}
                                    {session.allow_time_preference && (
                                      <span className={styles.preferenceBadge}>
                                        희망 시간 입력 가능
                                      </span>
                                    )}
                                    <span className={styles.preferenceBadge}>
                                      {session.allow_multi_slot_booking === true
                                        ? "여러 시간대 가능"
                                        : "한 타임만 예약"}
                                    </span>
                                  </div>
                                  <span className={styles.sessionAside}>
                                    {recommended && !activeRequest && !currentChangingSession && (
                                      <span className={styles.recommendedBadge}>내 보강과 맞음</span>
                                    )}
                                    {activeRequest ? (
                                      <span className={styles.bookedBadge}>
                                        {activeRequest.status === "booked" ? "예약 확정" : "승인 대기"}
                                      </span>
                                    ) : currentChangingSession ? (
                                      <span className={styles.bookedBadge}>현재 예약</span>
                                    ) : full ? (
                                      <span className={styles.fullBadge}>정원 마감</span>
                                    ) : policyBlockedBySelection || policyBlockedByExisting ? (
                                      <span className={styles.fullBadge}>한 타임만 가능</span>
                                    ) : selected ? (
                                      <span className={styles.selectedBadge}>선택됨</span>
                                    ) : remaining == null ? (
                                      <span className={styles.selectHint}>추가 선택</span>
                                    ) : (
                                      <span className={styles.selectHint}>잔여 {remaining}명</span>
                                    )}
                                  </span>
                                </button>
                              </article>
                            );
                        })}
                        {selectionNotice && (
                          <p className={styles.selectionNotice} role="status">
                            {selectionNotice}
                          </p>
                        )}
                        {selectedSessionsInGroup.length > 0 && (
                          <ClinicMultiSlotSelectionPanel
                            selectedSessions={selectedSessionsInGroup}
                            selectedSession={selectedSession}
                            memo={memo}
                            preferredStart={preferredStart}
                            preferredEnd={preferredEnd}
                            pending={changeMutation.isPending || bookingMutation.isPending}
                            changingBooking={!!changingBooking}
                            hasError={bookingMutation.isError || changeMutation.isError}
                            onMemoChange={setMemo}
                            onPreferredStartChange={setPreferredStart}
                            onPreferredEndChange={setPreferredEnd}
                            onSubmit={changingBooking ? submitChange : submitBooking}
                          />
                        )}
                      </div>
                    </section>
                  )}
                </>
              )}
            </section>
          </>
        )}

        {activeTab === "schedule" && (
          <section className={styles.mySchedule} aria-labelledby="my-clinic-schedule-title">
            <header className={styles.myScheduleHeader}>
              <div>
                <p>예정된 예약</p>
                <h2 id="my-clinic-schedule-title">내 일정</h2>
              </div>
              {activeBookingCount > 0 && <span>{activeBookingCount}건</span>}
            </header>

            {pendingBookings.length > 0 && (
              <div className={styles.bookingGroup}>
                <h3>승인 대기 <span>{pendingBookings.length}</span></h3>
                <div className={styles.bookingList}>
                  {pendingBookings.map((request) => {
                    const parts = dateParts(request.session_date);
                    return (
                      <article key={request.id} className={`${styles.bookingCard} ${styles.bookingCardPending}`}>
                        <time dateTime={request.session_date} className={styles.bookingDate}>
                          <span>{parts.month}월</span>
                          <strong>{parts.day}</strong>
                          <span>{parts.weekday}</span>
                        </time>
                        <div className={styles.bookingInfo}>
                          <strong>{request.session_title || "클리닉 수업"}</strong>
                          <span>{formatTime(request.session_start_time)} · {request.session_location || "장소 추후 안내"}</span>
                          {preferredRangeText(request) && (
                            <span className={styles.bookingPreference}>
                              {preferredRangeText(request)}
                            </span>
                          )}
                          {request.student_request_memo && (
                            <span className={styles.bookingRequestNote}>요청 · {request.student_request_memo}</span>
                          )}
                          <span className={styles.pendingStatus}>승인 대기</span>
                        </div>
                        <div className={styles.bookingActions}>
                          <button type="button" onClick={() => startChangingBooking(request)}>
                            일정 바꾸기
                          </button>
                          <button
                            type="button"
                            className={styles.dangerAction}
                            disabled={cancelMutation.isPending}
                            onClick={async () => {
                              if (await confirm({
                                title: "예약 취소",
                                message: "예약 신청을 취소할까요?",
                                confirmText: "예약 취소",
                                danger: true,
                              })) {
                                cancelMutation.mutate(request.id);
                              }
                            }}
                          >
                            예약 취소
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            )}

            {approvedBookings.length > 0 && (
              <div className={styles.bookingGroup}>
                <h3>예약 확정 <span>{approvedBookings.length}</span></h3>
                <div className={styles.bookingList}>
                  {approvedBookings.map((request) => {
                    const parts = dateParts(request.session_date);
                    return (
                      <article key={request.id} className={`${styles.bookingCard} ${styles.bookingCardApproved}`}>
                        <time dateTime={request.session_date} className={styles.bookingDate}>
                          <span>{parts.month}월</span>
                          <strong>{parts.day}</strong>
                          <span>{parts.weekday}</span>
                        </time>
                        <div className={styles.bookingInfo}>
                          <strong>{request.session_title || "클리닉 수업"}</strong>
                          <span>{formatTime(request.session_start_time)} · {request.session_location || "장소 추후 안내"}</span>
                          {preferredRangeText(request) && (
                            <span className={styles.bookingPreference}>
                              {preferredRangeText(request)}
                            </span>
                          )}
                          {request.student_request_memo && (
                            <span className={styles.bookingRequestNote}>요청 · {request.student_request_memo}</span>
                          )}
                          <span className={styles.approvedStatus}>예약 확정</span>
                        </div>
                        <p className={styles.approvedHelp}>변경이 필요하면 학원으로 연락해 주세요.</p>
                      </article>
                    );
                  })}
                </div>
              </div>
            )}

            {rejectedBookings.length > 0 && (
              <div className={styles.bookingGroup}>
                <h3>최근 거절</h3>
                <div className={styles.rejectedList}>
                  {rejectedBookings.map((request) => (
                    <div key={request.id}>
                      <span>{formatYmd(request.session_date)} {formatTime(request.session_start_time)}</span>
                      <strong>거절됨</strong>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeBookingCount === 0 && rejectedBookings.length === 0 && (
              <EmptyState
                title="예정된 클리닉이 없습니다"
                description="예약하기에서 열린 일정과 날짜를 확인해 보세요."
              />
            )}
          </section>
        )}
      </div>
    </StudentPageShell>
  );
}
