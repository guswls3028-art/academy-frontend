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
import StudentPageShell from "@/student/shared/ui/pages/StudentPageShell";
import ClinicCalendar from "@/student/shared/ui/components/ClinicCalendar";
import {
  fetchMyClinicBookingRequests,
  fetchAvailableClinicSessions,
  createClinicBookingRequest,
  cancelClinicBookingRequest,
  type ClinicBookingRequest,
} from "../api/clinicBooking.api";
import { formatYmd, todayYmd } from "@/student/shared/utils/date";
import EmptyState from "@/student/shared/ui/layout/EmptyState";
import { useNotificationCounts } from "@/student/domains/notifications/hooks/useNotificationCounts";

function formatTime(time: string): string {
  return time.slice(0, 5);
}

export default function ClinicPage() {
  const qc = useQueryClient();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [memo, setMemo] = useState("");
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);

  // 알림 카운트 갱신을 위한 훅
  const { refetch: refetchNotifications } = useNotificationCounts();

  // 내 예약 신청 목록 조회 (알림·클리닉 공통 키로 캐시 공유)
  const { data: myRequests = [], isLoading: requestsLoading } = useQuery({
    queryKey: ["student", "clinic", "bookings"],
    queryFn: fetchMyClinicBookingRequests,
  });

  // 예약 가능한 세션 목록 조회
  const { data: sessions = [], isLoading: sessionsLoading } = useQuery({
    queryKey: ["student", "clinic", "available-sessions"],
    queryFn: () => {
      const today = todayYmd();
      const from = new Date(today);
      const to = new Date(from);
      to.setDate(to.getDate() + 14);
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
      qc.invalidateQueries({ queryKey: ["student", "clinic", "bookings"] });
      qc.invalidateQueries({ queryKey: ["student", "clinic", "available-sessions"] });
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

    const existingBooking = myRequests.find((r) => r.session_date === date);
    if (existingBooking && (existingBooking.status === "pending" || existingBooking.status === "booked" || existingBooking.status === "approved")) {
      setSelectedSessionId(existingBooking.session ?? null);
    }
  };

  // 예약 신청 핸들러 — 등록 가능한 클리닉(세션)만 신청 가능
  const handleBooking = () => {
    if (!selectedSessionId) {
      alert("등록 가능한 클리닉 시간을 선택해주세요.");
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

    if (!selectedSessionId) {
      alert("변경할 클리닉 시간을 선택해주세요.");
      return;
    }

    if (confirm("기존 예약을 취소하고 새로 신청하시겠습니까?")) {
      cancelMutation.mutate(existingBooking.id, {
        onSuccess: () => {
          bookingMutation.mutate({
            session: selectedSessionId,
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

  return (
    <StudentPageShell title="클리닉">
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--stu-space-6)" }}>
        {/* 실시간 패스카드 (선생 리모콘 연동) */}
        <Link
          to="/student/idcard"
          className="stu-panel stu-panel--pressable"
          style={{
            display: "block",
            textDecoration: "none",
            color: "inherit",
            padding: "var(--stu-space-4)",
            background: "linear-gradient(135deg, var(--stu-surface-soft) 0%, var(--stu-surface) 100%)",
            border: "1px solid var(--stu-border)",
          }}
        >
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>클리닉 인증 패스</div>
          <div className="stu-muted" style={{ fontSize: 13 }}>
            클리닉 참여 시 인증용 패스카드를 보여주세요. 선생님이 실시간으로 설정한 화면이 반영됩니다.
          </div>
          <div style={{ marginTop: "var(--stu-space-2)", fontSize: 13, color: "var(--stu-primary)", fontWeight: 600 }}>
            패스카드 보기 →
          </div>
        </Link>

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
                                </div>
                                <div className="stu-muted" style={{ fontSize: 12, marginTop: 2 }}>
                                  {session.location}
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
                  disabled={!selectedSessionId || selectedSessionIsFull || bookingMutation.isPending || cancelMutation.isPending}
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
                  disabled={!selectedSessionId || selectedSessionIsFull || bookingMutation.isPending || cancelMutation.isPending || selectedDateSessions.length === 0}
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
