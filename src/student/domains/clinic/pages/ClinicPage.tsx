/**
 * 클리닉 페이지 — 예약현황 + 일정 한눈에 보기 + 예약 기능 통합
 * 
 * 기능:
 * - 내 예약 현황 (승인 대기, 승인됨)
 * - 클리닉 일정 캘린더 뷰
 * - 달력 날짜 클릭 시 예약 필드 표시
 * - 예약 신청 기능
 */
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import StudentPageShell from "@/student/shared/ui/pages/StudentPageShell";
import ClinicCalendar from "@/student/shared/ui/components/ClinicCalendar";
import {
  fetchMyClinicBookingRequests,
  fetchAvailableClinicSessions,
  createClinicBookingRequest,
  cancelClinicBookingRequest,
  type ClinicBookingRequest,
} from "../api/clinicBooking.api";
import { formatYmd } from "@/student/shared/utils/date";
import EmptyState from "@/student/shared/ui/layout/EmptyState";
import { useNotificationCounts } from "@/student/domains/notifications/hooks/useNotificationCounts";

function formatTime(time: string): string {
  return time.slice(0, 5);
}

export default function ClinicPage() {
  const qc = useQueryClient();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null); // HH:MM 형식
  const [memo, setMemo] = useState("");
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);

  // 알림 카운트 갱신을 위한 훅
  const { refetch: refetchNotifications } = useNotificationCounts();

  // 내 예약 신청 목록 조회
  const { data: myRequests = [], isLoading: requestsLoading } = useQuery({
    queryKey: ["clinic-my-booking-requests"],
    queryFn: fetchMyClinicBookingRequests,
  });

  // 예약 가능한 세션 목록 조회
  const { data: sessions = [], isLoading: sessionsLoading } = useQuery({
    queryKey: ["clinic-available-sessions"],
    queryFn: () => {
      const today = new Date();
      const twoWeeksLater = new Date(today);
      twoWeeksLater.setDate(today.getDate() + 14);
      return fetchAvailableClinicSessions({
        date_from: today.toISOString().slice(0, 10),
        date_to: twoWeeksLater.toISOString().slice(0, 10),
      });
    },
  });

  // 예약 신청 mutation
  const bookingMutation = useMutation({
    mutationFn: (data: { session: number; memo?: string }) =>
      createClinicBookingRequest(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clinic-available-sessions"] });
      qc.invalidateQueries({ queryKey: ["clinic-my-booking-requests"] });
      qc.invalidateQueries({ queryKey: ["clinic-idcard"] });
      qc.invalidateQueries({ queryKey: ["student", "notifications", "counts"] });
      refetchNotifications();
      setSelectedSessionId(null);
      setMemo("");
      setShowSuccessMessage(true);
      setTimeout(() => setShowSuccessMessage(false), 3000);
    },
    onError: (error: any) => {
      const message =
        error?.response?.data?.detail ||
        error?.response?.data?.message ||
        "예약 신청에 실패했습니다. 다시 시도해주세요.";
      alert(message);
    },
  });

  // 예약 취소 mutation
  const cancelMutation = useMutation({
    mutationFn: (id: number) => cancelClinicBookingRequest(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clinic-my-booking-requests"] });
      qc.invalidateQueries({ queryKey: ["clinic-available-sessions"] });
      qc.invalidateQueries({ queryKey: ["student", "notifications", "counts"] });
      refetchNotifications();
      alert("예약 신청이 취소되었습니다.");
    },
    onError: (error: any) => {
      alert(error?.response?.data?.detail || "취소에 실패했습니다.");
    },
  });

  // 날짜 선택 핸들러
  const handleDateSelect = (date: string) => {
    setSelectedDate(date);
    setSelectedSessionId(null);
    setSelectedTime(null);
    setShowSuccessMessage(false);

    // 해당 날짜의 예약이 있는지 확인
    const existingBooking = myRequests.find((r) => r.session_date === date);
    if (existingBooking && (existingBooking.status === "pending" || existingBooking.status === "booked" || existingBooking.status === "approved")) {
      // 일정 변경 모드
      setSelectedSessionId(existingBooking.session);
      setSelectedTime(existingBooking.session_start_time.slice(0, 5)); // HH:MM 형식
    }
  };

  // 예약 신청 핸들러
  const handleBooking = () => {
    if (!selectedSessionId && !selectedTime) {
      alert("예약할 시간을 선택해주세요.");
      return;
    }
    
    if (selectedSessionId) {
      // 기존 세션 선택 방식
      bookingMutation.mutate({
        session: selectedSessionId,
        memo: memo.trim() || undefined,
      });
    } else if (selectedTime && selectedDate) {
      // 시간 직접 선택 방식 - 해당 시간에 맞는 세션 찾기
      const matchingSession = sessions.find((s) => {
        const sessionDate = s.date;
        const sessionTime = s.start_time.slice(0, 5); // HH:MM 형식
        return sessionDate === selectedDate && sessionTime === selectedTime;
      });
      
      if (matchingSession) {
        // 해당 시간의 세션을 찾았으면 예약
        bookingMutation.mutate({
          session: matchingSession.id,
          memo: memo.trim() || undefined,
        });
      } else {
        // 세션이 없으면 사용자에게 알림
        alert(`선택한 시간(${selectedTime})에 해당하는 클리닉 세션이 없습니다.\n선생님이 먼저 해당 시간의 클리닉 세션을 생성해주세요.`);
      }
    }
  };

  // 일정 변경 신청 핸들러
  const handleChangeRequest = () => {
    if (!selectedDate) {
      alert("날짜를 선택해주세요.");
      return;
    }

    const existingBooking = myRequests.find((r) => r.session_date === selectedDate);
    if (!existingBooking) {
      alert("변경할 예약을 찾을 수 없습니다.");
      return;
    }

    // 새로 선택한 세션이나 시간 확인
    let newSessionId: number | null = null;
    
    if (selectedSessionId) {
      newSessionId = selectedSessionId;
    } else if (selectedTime) {
      // 시간 선택 시 해당 시간의 세션 찾기
      const matchingSession = sessions.find((s) => {
        const sessionDate = s.date;
        const sessionTime = s.start_time.slice(0, 5);
        return sessionDate === selectedDate && sessionTime === selectedTime;
      });
      
      if (matchingSession) {
        newSessionId = matchingSession.id;
      } else {
        alert(`선택한 시간(${selectedTime})에 해당하는 클리닉 세션이 없습니다.\n선생님이 먼저 해당 시간의 클리닉 세션을 생성해주세요.`);
        return;
      }
    }

    if (!newSessionId) {
      alert("변경할 시간을 선택해주세요.");
      return;
    }

    // 기존 예약 취소 후 새 예약 신청
    if (confirm("기존 예약을 취소하고 새로 신청하시겠습니까?")) {
      cancelMutation.mutate(existingBooking.id, {
        onSuccess: () => {
          bookingMutation.mutate({
            session: newSessionId!,
            memo: memo.trim() || undefined,
          });
        },
      });
    }
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

  // 예약 가능한 날짜 목록
  const availableDates = useMemo(() => {
    const dates = new Set<string>();
    sessions.forEach((s) => {
      dates.add(s.date);
    });
    myRequests.forEach((r) => {
      if (r.status === "pending" || r.status === "booked" || r.status === "approved") {
        dates.add(r.session_date);
      }
    });
    return Array.from(dates);
  }, [sessions, myRequests]);

  // 선택한 날짜의 예약 정보
  const selectedDateBooking = useMemo(() => {
    if (!selectedDate) return null;
    return myRequests.find((r) => r.session_date === selectedDate);
  }, [selectedDate, myRequests]);

  // 선택한 날짜의 세션 정보
  const selectedDateSessions = useMemo(() => {
    if (!selectedDate) return [];
    return sessions.filter((s) => s.date === selectedDate);
  }, [selectedDate, sessions]);

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

  return (
    <StudentPageShell title="클리닉">
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--stu-space-6)" }}>
        {/* 성공 메시지 */}
        {showSuccessMessage && (
          <div
            className="stu-panel"
            style={{
              padding: "var(--stu-space-4)",
              background: "var(--stu-success-bg)",
              border: "1px solid var(--stu-success)",
              borderRadius: "var(--stu-radius-md)",
              textAlign: "center",
            }}
          >
            <div style={{ fontWeight: 600, fontSize: 15, color: "var(--stu-success-text)" }}>
              신청이 완료되었습니다.
            </div>
          </div>
        )}

        {/* 달력 */}
        <ClinicCalendar
          selectedDate={selectedDate}
          onDateSelect={handleDateSelect}
          bookings={myRequests}
          availableDates={availableDates}
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
                  현재 예약: {formatTime(existingBookingForDate.session_start_time)} @ {existingBookingForDate.session_location}
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
              {/* 시간 선택 */}
              <div>
                <label style={{ display: "flex", flexDirection: "column", gap: "var(--stu-space-2)" }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: "var(--stu-text-muted)" }}>
                    시간
                  </span>
                  
                  {/* 기존 세션이 있는 경우 세션 선택 */}
                  {selectedDateSessions.length > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "var(--stu-space-2)", marginBottom: "var(--stu-space-3)" }}>
                      {selectedDateSessions.map((session) => {
                        const isSelected = selectedSessionId === session.id;
                        const remaining =
                          session.max_participants != null
                            ? session.max_participants - session.booked_count
                            : null;

                        return (
                          <button
                            key={session.id}
                            type="button"
                            className={`stu-panel stu-panel--pressable ${isSelected ? "stu-panel--accent" : ""}`}
                            onClick={() => {
                              setSelectedSessionId(session.id);
                              setSelectedTime(session.start_time.slice(0, 5));
                            }}
                            style={{
                              textAlign: "left",
                              padding: "var(--stu-space-3)",
                              border: isSelected
                                ? "2px solid var(--stu-primary)"
                                : "1px solid var(--stu-border)",
                            }}
                          >
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <div>
                                <div style={{ fontWeight: 600, fontSize: 14 }}>
                                  {formatTime(session.start_time)}
                                </div>
                                <div className="stu-muted" style={{ fontSize: 12, marginTop: 2 }}>
                                  {session.location}
                                </div>
                              </div>
                              {remaining != null && remaining > 0 && (
                                <div className="stu-muted" style={{ fontSize: 12 }}>
                                  잔여 {remaining}명
                                </div>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                  
                  {/* 시간 직접 선택 (1시간 단위) - 세션이 없을 때만 표시 */}
                  {selectedDateSessions.length === 0 && (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "var(--stu-space-2)" }}>
                      {Array.from({ length: 12 }, (_, i) => {
                        const hour = 9 + i; // 09:00 ~ 20:00
                        const timeStr = `${hour.toString().padStart(2, "0")}:00`;
                        const isSelected = selectedTime === timeStr;
                        
                        return (
                          <button
                            key={timeStr}
                            type="button"
                            className={`stu-panel stu-panel--pressable ${isSelected ? "stu-panel--accent" : ""}`}
                            onClick={() => {
                              setSelectedTime(timeStr);
                              setSelectedSessionId(null);
                            }}
                            style={{
                              padding: "var(--stu-space-3)",
                              textAlign: "center",
                              border: isSelected
                                ? "2px solid var(--stu-primary)"
                                : "1px solid var(--stu-border)",
                            }}
                          >
                            <div style={{ fontWeight: 600, fontSize: 14 }}>{timeStr}</div>
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
                  disabled={(!selectedSessionId && !selectedTime) || bookingMutation.isPending || cancelMutation.isPending}
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
                  disabled={!selectedSessionId || bookingMutation.isPending || cancelMutation.isPending || selectedDateSessions.length === 0}
                  onClick={handleChangeRequest}
                  style={{ width: "100%" }}
                >
                  {cancelMutation.isPending || bookingMutation.isPending
                    ? "처리 중…"
                    : "일정 변경 신청하기"}
                </button>
              )}

              {(bookingMutation.isError || cancelMutation.isError) && (
                <div className="stu-muted" style={{ fontSize: 13, color: "var(--stu-danger)" }}>
                  {isChangeMode ? "일정 변경에 실패했습니다." : "예약 신청에 실패했습니다."} 다시 시도해주세요.
                </div>
              )}
            </div>
          </div>
        )}

        {/* 내 예약 현황 */}
        <div className="stu-section stu-section--nested">
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: "var(--stu-space-4)" }}>
            내 예약 현황
          </div>

          {/* 승인 대기 */}
          {pendingBookings.length > 0 && (
            <div style={{ marginBottom: "var(--stu-space-4)" }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--stu-text-muted)", marginBottom: "var(--stu-space-2)" }}>
                승인 대기 ({pendingBookings.length})
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--stu-space-2)" }}>
                {pendingBookings.map((request) => (
                  <div key={request.id} className="stu-panel" style={{ padding: "var(--stu-space-3)" }}>
                    <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>
                      {formatYmd(request.session_date)} {formatTime(request.session_start_time)}
                    </div>
                    <div className="stu-muted" style={{ fontSize: 12 }}>
                      {request.session_location}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 승인됨 */}
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
                    <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>
                      {formatYmd(request.session_date)} {formatTime(request.session_start_time)}
                    </div>
                    <div className="stu-muted" style={{ fontSize: 12 }}>
                      {request.session_location}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {pendingBookings.length === 0 && approvedBookings.length === 0 && (
            <EmptyState
              title="예약 내역이 없습니다"
              description="달력에서 날짜를 선택하여 예약을 신청하세요."
            />
          )}
        </div>
      </div>
    </StudentPageShell>
  );
}
