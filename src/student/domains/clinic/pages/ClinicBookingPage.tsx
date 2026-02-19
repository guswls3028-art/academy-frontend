/**
 * 클리닉 예약 페이지 — 달력 기반 예약 시스템
 * 
 * 기능:
 * 1. 달력에서 날짜 선택
 * 2. 선택한 날짜의 예약 가능한 시간대 표시
 * 3. 희망 시간 입력 및 예약 신청
 * 4. 예약 상태별 색상 표시 (노란색: pending, 초록색: 승인)
 * 5. 예약된 날짜 클릭 시 일정 변경 신청 가능
 */
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import StudentPageShell from "@/student/shared/ui/pages/StudentPageShell";
import EmptyState from "@/student/shared/ui/layout/EmptyState";
import ClinicCalendar from "@/student/shared/ui/components/ClinicCalendar";
import {
  fetchAvailableClinicSessions,
  fetchMyClinicBookingRequests,
  createClinicBookingRequest,
  cancelClinicBookingRequest,
  type ClinicSession,
  type ClinicBookingRequest,
} from "../api/clinicBooking.api";
import { formatYmd } from "@/student/shared/utils/date";
import { useNotificationCounts } from "@/student/domains/notifications/hooks/useNotificationCounts";

function formatTime(time: string): string {
  return time.slice(0, 5);
}

export default function ClinicBookingPage() {
  const qc = useQueryClient();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [memo, setMemo] = useState("");
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);

  // 알림 카운트 갱신을 위한 훅
  const { refetch: refetchNotifications } = useNotificationCounts();

  // 예약 가능한 세션 목록 조회 (2주치)
  const { data: sessions = [], isLoading, isError } = useQuery({
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

  // 내 예약 신청 목록 조회
  const { data: myRequests = [] } = useQuery({
    queryKey: ["clinic-my-booking-requests"],
    queryFn: fetchMyClinicBookingRequests,
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
      setSelectedDate(null);
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
    setShowSuccessMessage(false);

    // 해당 날짜의 예약이 있는지 확인
    const existingBooking = myRequests.find((r) => r.session_date === date);
    if (existingBooking && (existingBooking.status === "pending" || existingBooking.status === "booked" || existingBooking.status === "approved")) {
      // 일정 변경 모드
      setSelectedSessionId(existingBooking.session);
    }
  };

  // 예약 신청 핸들러
  const handleBooking = () => {
    if (!selectedSessionId) {
      alert("예약할 시간을 선택해주세요.");
      return;
    }
    bookingMutation.mutate({
      session: selectedSessionId,
      memo: memo.trim() || undefined,
    });
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

    // 기존 예약 취소 후 새 예약 신청
    if (confirm("기존 예약을 취소하고 새로 신청하시겠습니까?")) {
      cancelMutation.mutate(existingBooking.id, {
        onSuccess: () => {
          if (selectedSessionId) {
            bookingMutation.mutate({
              session: selectedSessionId,
              memo: memo.trim() || undefined,
            });
          }
        },
      });
    }
  };

  // 예약 가능한 날짜 목록 (세션의 날짜들)
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

  // 선택한 날짜의 예약 가능한 세션 목록
  const availableSessionsForDate = useMemo(() => {
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
      <StudentPageShell title="클리닉 예약하기">
        <div className="stu-muted">불러오는 중...</div>
      </StudentPageShell>
    );
  }

  if (isError) {
    return (
      <StudentPageShell title="클리닉 예약하기">
        <EmptyState
          title="예약 가능한 클리닉을 불러오지 못했습니다."
          description="잠시 후 다시 시도해주세요."
        />
      </StudentPageShell>
    );
  }

  return (
    <StudentPageShell
      title="클리닉 예약하기"
      description="달력에서 날짜를 선택하고 예약 신청하세요."
    >
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

        {/* 선택한 날짜의 예약 가능한 시간대 */}
        {selectedDate && (
          <div className="stu-section stu-section--nested">
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: "var(--stu-space-4)" }}>
              {formatYmd(selectedDate)} {isChangeMode ? "일정 변경" : "예약 가능한 시간"}
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

            {availableSessionsForDate.length === 0 && !existingBookingForDate ? (
              <EmptyState
                title="예약 가능한 시간이 없습니다"
                description="다른 날짜를 선택해주세요."
              />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--stu-space-4)" }}>
                {/* 시간대 선택 */}
                {availableSessionsForDate.length > 0 && (
                  <div>
                    <label style={{ display: "flex", flexDirection: "column", gap: "var(--stu-space-2)" }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: "var(--stu-text-muted)" }}>
                        희망 시간
                      </span>
                      <div style={{ display: "flex", flexDirection: "column", gap: "var(--stu-space-2)" }}>
                        {availableSessionsForDate.map((session) => {
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
                              onClick={() => setSelectedSessionId(session.id)}
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
                                    {session.end_time && ` - ${formatTime(session.end_time)}`}
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
                    </label>
                  </div>
                )}

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
                <button
                  type="button"
                  className={`stu-btn ${isChangeMode ? "stu-btn--secondary" : "stu-btn--primary"}`}
                  disabled={!selectedSessionId || bookingMutation.isPending || cancelMutation.isPending}
                  onClick={isChangeMode ? handleChangeRequest : handleBooking}
                  style={{ width: "100%" }}
                >
                  {bookingMutation.isPending || cancelMutation.isPending
                    ? "처리 중…"
                    : isChangeMode
                    ? "일정 변경 신청하기"
                    : "예약 신청하기"}
                </button>

                {(bookingMutation.isError || cancelMutation.isError) && (
                  <div className="stu-muted" style={{ fontSize: 13, color: "var(--stu-danger)" }}>
                    {isChangeMode ? "일정 변경에 실패했습니다." : "예약 신청에 실패했습니다."} 다시 시도해주세요.
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* 날짜 미선택 안내 */}
        {!selectedDate && (
          <div className="stu-status-surface">
            <div className="stu-status-title">달력에서 날짜를 선택해주세요</div>
            <div className="stu-muted" style={{ fontSize: 13, marginTop: 4 }}>
              예약 가능한 날짜를 선택하면 시간대가 표시됩니다.
            </div>
          </div>
        )}
      </div>
    </StudentPageShell>
  );
}
