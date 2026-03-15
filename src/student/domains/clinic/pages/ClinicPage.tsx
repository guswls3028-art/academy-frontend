/**
 * 클리닉 홈 — 패스카드(리모콘 연동) + 내 예약 현황 + 일정/예약
 *
 * - 실시간 패스카드: 선생 앱 리모콘 색상 연동, 클리닉 인증용
 * - 내 예약 현황: 승인 대기 / 승인됨 실데이터
 * - 캘린더 + 예약 신청
 */
import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useConfirm } from "@/shared/ui/confirm";
import { studentToast } from "@/student/shared/ui/feedback/studentToast";
import StudentPageShell from "@/student/shared/ui/pages/StudentPageShell";
import ClinicCalendar from "@/student/shared/ui/components/ClinicCalendar";
import {
  fetchMyClinicBookingRequests,
  fetchAvailableClinicSessions,
  createClinicBookingRequest,
  cancelClinicBookingRequest,
  changeClinicBooking,
  type ClinicBookingRequest,
} from "../api/clinicBooking.api";
import { formatYmd, todayYmd } from "@/student/shared/utils/date";
import EmptyState from "@/student/shared/ui/layout/EmptyState";

function formatTime(time: string): string {
  return time.slice(0, 5);
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
    queryKey: ["student", "clinic", "bookings"],
    queryFn: fetchMyClinicBookingRequests,
  });

  // 예약 가능한 세션 목록 조회
  const { data: sessions = [], isLoading: sessionsLoading, isError: sessionsError, refetch: refetchSessions } = useQuery({
    queryKey: ["student", "clinic", "available-sessions"],
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

  // 예약 신청 mutation
  const bookingMutation = useMutation({
    mutationFn: (data: { session: number; memo?: string }) =>
      createClinicBookingRequest(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["student", "clinic", "available-sessions"] });
      qc.invalidateQueries({ queryKey: ["student", "clinic", "bookings"] });
      qc.invalidateQueries({ queryKey: ["clinic-idcard"] });
      qc.invalidateQueries({ queryKey: ["student", "notifications", "counts"] });
      setSelectedSessionId(null);
      setMemo("");
      studentToast.success("예약이 완료되었습니다.");
    },
    onError: (error: any) => {
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
      qc.invalidateQueries({ queryKey: ["student", "clinic", "bookings"] });
      qc.invalidateQueries({ queryKey: ["student", "clinic", "available-sessions"] });
      qc.invalidateQueries({ queryKey: ["clinic-idcard"] });
      qc.invalidateQueries({ queryKey: ["student", "notifications", "counts"] });
      studentToast.success("예약 신청이 취소되었습니다.");
    },
    onError: (error: any) => {
      studentToast.error(error?.response?.data?.detail || "취소에 실패했습니다.");
    },
  });

  // 예약 변경 mutation (atomic: 새 예약 실패 시 기존 예약 보존)
  const changeMutation = useMutation({
    mutationFn: (data: { oldId: number; newSessionId: number; memo?: string }) =>
      changeClinicBooking(data.oldId, data.newSessionId, data.memo),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["student", "clinic", "available-sessions"] });
      qc.invalidateQueries({ queryKey: ["student", "clinic", "bookings"] });
      qc.invalidateQueries({ queryKey: ["clinic-idcard"] });
      qc.invalidateQueries({ queryKey: ["student", "notifications", "counts"] });
      setSelectedSessionId(null);
      setMemo("");
      studentToast.success("일정 변경이 완료되었습니다.");
    },
    onError: (error: any) => {
      const message =
        error?.response?.data?.detail ||
        error?.response?.data?.message ||
        "일정 변경에 실패했습니다. 기존 예약은 유지됩니다.";
      studentToast.error(message);
    },
  });

  // 날짜 선택 핸들러
  const handleDateSelect = (date: string) => {
    setSelectedDate(date);
    setSelectedSessionId(null);

    const existingBooking = myRequests.find((r) => r.session_date === date);
    if (existingBooking && (existingBooking.status === "pending" || existingBooking.status === "booked" || existingBooking.status === "approved")) {
      setSelectedSessionId(existingBooking.session ?? null);
    }
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
        (r.status === "pending" || r.status === "booked" || r.status === "approved")
    );
    if (!existingBooking) {
      studentToast.error("변경할 예약을 찾을 수 없습니다.");
      return;
    }

    if (!selectedSessionId) {
      studentToast.info("변경할 클리닉 시간을 선택해주세요.");
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
    () => myRequests.filter((r) => r.status === "booked" || r.status === "approved"),
    [myRequests]
  );

  // 예약 가능한 날짜 목록: 해당 날짜에 클리닉(세션)이 있거나, 내 예약이 있는 날
  const availableDates = useMemo(() => {
    const dates = new Set<string>();
    sessions.forEach((s) => dates.add(s.date));
    myRequests.forEach((r) => {
      if (r.status === "pending" || r.status === "booked" || r.status === "approved") {
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

  // 선택한 날짜의 예약 정보
  const selectedDateBooking = useMemo(() => {
    if (!selectedDate) return null;
    return myRequests.find(
      (r) => r.session_date === selectedDate && ["pending", "booked", "approved"].includes(r.status)
    );
  }, [selectedDate, myRequests]);

  // 선택한 날짜의 세션 정보
  const selectedDateSessions = useMemo(() => {
    if (!selectedDate) return [];
    return sessions.filter((s) => s.date === selectedDate);
  }, [selectedDate, sessions]);

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
        (r.status === "pending" || r.status === "booked" || r.status === "approved")
    );
  }, [selectedDate, myRequests]);

  const isChangeMode = existingBookingForDate != null;

  if (isLoading) {
    return (
      <StudentPageShell title="클리닉">
        <div className="stu-muted">불러오는 중...</div>
      </StudentPageShell>
    );
  }

  // 두 쿼리 모두 실패한 경우 전체 에러 화면
  if (sessionsError && requestsError) {
    return (
      <StudentPageShell title="클리닉">
        <EmptyState
          title="클리닉 정보를 불러오지 못했습니다"
          description="네트워크 연결을 확인하고 다시 시도해 주세요."
        />
        <div style={{ textAlign: "center", marginTop: "var(--stu-space-4)" }}>
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
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--stu-space-4)" }}>
        {/* 탭 바 */}
        <div style={{
          display: "flex", gap: 0, borderRadius: 10,
          background: "var(--stu-surface-soft, #f1f5f9)",
          padding: 3, marginBottom: "var(--stu-space-2)",
        }}>
          <button
            type="button"
            onClick={() => setActiveTab("book")}
            style={{
              flex: 1, padding: "8px 0", borderRadius: 8,
              border: "none", cursor: "pointer",
              fontSize: 14, fontWeight: 600,
              background: activeTab === "book" ? "var(--stu-surface, #fff)" : "transparent",
              color: activeTab === "book" ? "var(--stu-text)" : "var(--stu-text-muted)",
              boxShadow: activeTab === "book" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
              transition: "all 0.15s",
            }}
          >
            예약
            {(pendingBookings.length + approvedBookings.length) > 0 && activeTab !== "schedule" && (
              <span style={{
                marginLeft: 6, fontSize: 11, fontWeight: 700,
                background: "var(--stu-primary)", color: "#fff",
                borderRadius: 999, padding: "1px 6px", verticalAlign: "middle",
              }}>
                {pendingBookings.length + approvedBookings.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("schedule")}
            style={{
              flex: 1, padding: "8px 0", borderRadius: 8,
              border: "none", cursor: "pointer",
              fontSize: 14, fontWeight: 600,
              background: activeTab === "schedule" ? "var(--stu-surface, #fff)" : "transparent",
              color: activeTab === "schedule" ? "var(--stu-text)" : "var(--stu-text-muted)",
              boxShadow: activeTab === "schedule" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
              transition: "all 0.15s",
            }}
          >
            내 일정
            {(pendingBookings.length + approvedBookings.length) > 0 && activeTab !== "book" && (
              <span style={{
                marginLeft: 6, fontSize: 11, fontWeight: 700,
                background: "var(--stu-primary)", color: "#fff",
                borderRadius: 999, padding: "1px 6px", verticalAlign: "middle",
              }}>
                {pendingBookings.length + approvedBookings.length}
              </span>
            )}
          </button>
        </div>

        {/* ===== 예약 탭 ===== */}
        {activeTab === "book" && (<>
        {/* 세션 조회 에러 */}
        {sessionsError && (
          <div
            className="stu-panel"
            style={{
              padding: "var(--stu-space-4)",
              background: "var(--stu-danger-bg, rgba(239, 68, 68, 0.08))",
              border: "1px solid var(--stu-danger)",
              borderRadius: "var(--stu-radius-md)",
              textAlign: "center",
            }}
          >
            <div style={{ fontWeight: 600, fontSize: 14, color: "var(--stu-danger)", marginBottom: "var(--stu-space-2)" }}>
              클리닉 정보를 불러오지 못했습니다.
            </div>
            <button
              type="button"
              className="stu-btn stu-btn--secondary"
              style={{ fontSize: 13 }}
              onClick={() => refetchSessions()}
            >
              다시 시도
            </button>
          </div>
        )}

        {/* 달력 */}
        <ClinicCalendar
          selectedDate={selectedDate}
          onDateSelect={handleDateSelect}
          bookings={myRequests}
          availableDates={availableDates}
          dateCapacityStatus={dateCapacityStatus}
        />

        {/* 선택한 날짜의 예약 필드 */}
        {selectedDate && (
          <div className="stu-section stu-section--nested">
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: "var(--stu-space-4)" }}>
              {formatYmd(selectedDate)} {isChangeMode ? "일정 변경" : "예약하기"}
            </div>

            {existingBookingForDate && (
              <div
                className="stu-panel"
                style={{
                  marginBottom: "var(--stu-space-4)",
                  padding: "var(--stu-space-4)",
                  background:
                    existingBookingForDate.status === "booked" || existingBookingForDate.status === "approved"
                      ? "var(--stu-success-bg)"
                      : "var(--stu-surface-soft)",
                  border:
                    existingBookingForDate.status === "booked" || existingBookingForDate.status === "approved"
                      ? "1px solid var(--stu-success)"
                      : "1px solid var(--stu-border)",
                }}
              >
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>
                  현재 예약: {formatTime(existingBookingForDate.session_start_time)}
                  {existingBookingForDate.session_location && ` @ ${existingBookingForDate.session_location}`}
                </div>
                <div className="stu-muted" style={{ fontSize: 12 }}>
                  상태:{" "}
                  {existingBookingForDate.status === "booked" || existingBookingForDate.status === "approved"
                    ? "승인됨"
                    : "승인 대기"}
                </div>
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: "var(--stu-space-4)" }}>
              {/* 시간 선택 — 해당 날짜에 열린 클리닉만 표시, 정원 마감 시 비활성 + 시각 효과 */}
              <div>
                <label style={{ display: "flex", flexDirection: "column", gap: "var(--stu-space-2)" }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: "var(--stu-text-muted)" }}>
                    클리닉 시간
                  </span>

                  {selectedDateSessions.length === 0 ? (
                    <div
                      className="stu-panel"
                      style={{
                        padding: "var(--stu-space-4)",
                        textAlign: "center",
                        background: "var(--stu-surface-soft)",
                        border: "1px dashed var(--stu-border)",
                        color: "var(--stu-text-muted)",
                        fontSize: 14,
                      }}
                    >
                      이 날짜에는 등록 가능한 클리닉이 없습니다. 다른 날짜를 선택해주세요.
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "var(--stu-space-2)", marginBottom: "var(--stu-space-3)" }}>
                      {selectedDateSessions.map((session) => {
                        const isFull =
                          session.max_participants != null &&
                          (session.booked_count ?? 0) >= session.max_participants;
                        const isSelected = selectedSessionId === session.id;
                        const remaining =
                          session.max_participants != null
                            ? Math.max(0, session.max_participants - (session.booked_count ?? 0))
                            : null;

                        return (
                          <button
                            key={session.id}
                            type="button"
                            disabled={isFull}
                            className={`stu-panel ${isFull ? "" : "stu-panel--pressable"} ${isSelected && !isFull ? "stu-panel--accent" : ""}`}
                            onClick={() => {
                              if (isFull) return;
                              setSelectedSessionId(session.id);
                            }}
                            style={{
                              textAlign: "left",
                              padding: "var(--stu-space-3)",
                              border: isSelected && !isFull
                                ? "2px solid var(--stu-primary)"
                                : "1px solid var(--stu-border)",
                              opacity: isFull ? 0.65 : 1,
                              cursor: isFull ? "not-allowed" : "pointer",
                              position: "relative",
                              background: isFull ? "var(--stu-surface-soft)" : undefined,
                            }}
                          >
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                              <div>
                                <div style={{ fontWeight: 600, fontSize: 14 }}>
                                  {formatTime(session.start_time)}
                                  {session.title ? ` — ${session.title}` : ""}
                                </div>
                                <div className="stu-muted" style={{ fontSize: 12, marginTop: 2 }}>
                                  {session.location}
                                  {session.target_grade ? ` · ${session.target_grade}학년` : ""}
                                </div>
                              </div>
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                {isFull ? (
                                  <span
                                    style={{
                                      fontSize: 12,
                                      fontWeight: 600,
                                      color: "var(--stu-danger)",
                                      padding: "2px 8px",
                                      borderRadius: "var(--stu-radius)",
                                      background: "rgba(239, 68, 68, 0.12)",
                                    }}
                                  >
                                    정원 마감
                                  </span>
                                ) : remaining != null ? (
                                  <span className="stu-muted" style={{ fontSize: 12 }}>
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
                  <label style={{ display: "flex", flexDirection: "column", gap: "var(--stu-space-2)" }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: "var(--stu-text-muted)" }}>
                      메모 (선택)
                    </span>
                    <textarea
                      value={memo}
                      onChange={(e) => setMemo(e.target.value)}
                      placeholder="예약 시 참고사항을 입력해주세요."
                      className="stu-textarea"
                      rows={3}
                      style={{ width: "100%" }}
                    />
                  </label>
                </div>

              {/* 예약 신청 / 일정 변경 버튼 */}
              {!existingBookingForDate && (
                <button
                  type="button"
                  className="stu-btn stu-btn--primary"
                  disabled={!selectedSessionId || selectedSessionIsFull || bookingMutation.isPending || cancelMutation.isPending || changeMutation.isPending}
                  onClick={handleBooking}
                  style={{ width: "100%" }}
                >
                  {bookingMutation.isPending ? "처리 중…" : "예약 신청하기"}
                </button>
              )}

              {existingBookingForDate && (
                <button
                  type="button"
                  className="stu-btn stu-btn--secondary"
                  disabled={!selectedSessionId || selectedSessionIsFull || changeMutation.isPending || bookingMutation.isPending || cancelMutation.isPending || selectedDateSessions.length === 0}
                  onClick={handleChangeRequest}
                  style={{ width: "100%" }}
                >
                  {changeMutation.isPending
                    ? "처리 중…"
                    : "일정 변경 신청하기"}
                </button>
              )}

              {(bookingMutation.isError || cancelMutation.isError || changeMutation.isError) && (
                <div className="stu-muted" style={{ fontSize: 13, color: "var(--stu-danger)" }}>
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
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--stu-space-4)", flexWrap: "wrap", gap: 8 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>내 예약 현황</div>
            {(pendingBookings.length > 0 || approvedBookings.length > 0) && (
              <span className="stu-muted" style={{ fontSize: 13 }}>
                승인 대기 {pendingBookings.length}건 · 승인됨 {approvedBookings.length}건
              </span>
            )}
          </div>

          {/* 예약 조회 에러 */}
          {requestsError && (
            <div
              className="stu-panel"
              style={{
                padding: "var(--stu-space-4)",
                marginBottom: "var(--stu-space-4)",
                background: "var(--stu-danger-bg, rgba(239, 68, 68, 0.08))",
                border: "1px solid var(--stu-danger)",
                borderRadius: "var(--stu-radius-md)",
                textAlign: "center",
              }}
            >
              <div style={{ fontWeight: 600, fontSize: 14, color: "var(--stu-danger)", marginBottom: "var(--stu-space-2)" }}>
                예약 현황을 불러오지 못했습니다.
              </div>
              <button
                type="button"
                className="stu-btn stu-btn--secondary"
                style={{ fontSize: 13 }}
                onClick={() => refetchRequests()}
              >
                다시 시도
              </button>
            </div>
          )}

          {/* 승인 대기 */}
          {pendingBookings.length > 0 && (
            <div style={{ marginBottom: "var(--stu-space-4)" }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--stu-text-muted)", marginBottom: "var(--stu-space-2)" }}>
                승인 대기 ({pendingBookings.length})
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--stu-space-2)" }}>
                {pendingBookings.map((request) => (
                  <div key={request.id} className="stu-panel" style={{ padding: "var(--stu-space-3)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>
                          {formatYmd(request.session_date)} {formatTime(request.session_start_time)}
                        </div>
                        <div className="stu-muted" style={{ fontSize: 12 }}>
                          {request.session_location}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="stu-btn stu-btn--secondary"
                        style={{ fontSize: 12, padding: "4px 10px", whiteSpace: "nowrap", flexShrink: 0, color: "var(--stu-danger)" }}
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
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--stu-text-muted)", marginBottom: "var(--stu-space-2)" }}>
                승인됨 ({approvedBookings.length})
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--stu-space-2)" }}>
                {approvedBookings.map((request) => (
                  <div
                    key={request.id}
                    className="stu-panel"
                    style={{
                      padding: "var(--stu-space-3)",
                      background: "var(--stu-success-bg)",
                      border: "1px solid var(--stu-success)",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>
                          {formatYmd(request.session_date)} {formatTime(request.session_start_time)}
                        </div>
                        <div className="stu-muted" style={{ fontSize: 12 }}>
                          {request.session_location}
                        </div>
                      </div>
                      <span
                        style={{
                          fontSize: 12, fontWeight: 600, padding: "3px 10px",
                          borderRadius: 6, background: "var(--stu-success-bg)",
                          color: "var(--stu-success-text, #065f46)", whiteSpace: "nowrap",
                        }}
                      >
                        확정
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {pendingBookings.length === 0 && approvedBookings.length === 0 && (
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
