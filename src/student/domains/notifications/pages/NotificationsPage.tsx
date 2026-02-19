/**
 * 알림 페이지 — 클리닉 예약 승인, QnA 답변, 새 영상, 새 성적 등
 * 
 * 최적화:
 * - 알림 카운트와 실제 데이터를 동일한 쿼리 키로 공유하여 중복 호출 방지
 * - 로딩 상태 및 에러 처리 개선
 */
import { Link } from "react-router-dom";
import StudentPageShell from "@/student/shared/ui/pages/StudentPageShell";
import { useNotificationCounts } from "../hooks/useNotificationCounts";
import { fetchMyClinicBookingRequests } from "@/student/domains/clinic/api/clinicBooking.api";
import { fetchMyQnaQuestions } from "@/student/domains/qna/api/qna.api";
import { useQuery } from "@tanstack/react-query";
import { IconClinic, IconNotice } from "@/student/shared/ui/icons/Icons";
import EmptyState from "@/student/shared/ui/layout/EmptyState";
import { formatYmd } from "@/student/shared/utils/date";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export default function NotificationsPage() {
  const { data: counts, isLoading: countsLoading } = useNotificationCounts();

  const { data: clinicBookings, isLoading: clinicLoading } = useQuery({
    queryKey: ["student", "clinic", "bookings"],
    queryFn: fetchMyClinicBookingRequests,
    staleTime: 30000,
  });

  const { data: myQnaQuestions = [], isLoading: qnaLoading } = useQuery({
    queryKey: ["student", "qna", "questions"],
    queryFn: fetchMyQnaQuestions,
    staleTime: 30000,
  });

  const isLoading = countsLoading || clinicLoading || qnaLoading;
  const sevenDaysAgo = Date.now() - SEVEN_DAYS_MS;

  const approvedClinicBookings = (clinicBookings || []).filter((b) => {
    if (b.status !== "booked" && b.status !== "approved") return false;
    const changeDate = b.status_changed_at
      ? new Date(b.status_changed_at).getTime()
      : b.updated_at
        ? new Date(b.updated_at).getTime()
        : new Date(b.created_at).getTime();
    return changeDate > sevenDaysAgo;
  });

  const answeredQnaPosts = myQnaQuestions.filter((p) => {
    if ((p.replies_count || 0) === 0) return false;
    const updatedTime = p.updated_at ? new Date(p.updated_at).getTime() : new Date(p.created_at).getTime();
    return updatedTime > sevenDaysAgo;
  });

  const hasNotifications = (counts?.total || 0) > 0;

  if (isLoading) {
    return (
      <StudentPageShell title="알림">
        <div style={{ padding: "var(--stu-space-4) 0" }}>
          <div className="stu-skel" style={{ height: 60, borderRadius: "var(--stu-radius-md)", marginBottom: 12 }} />
          <div className="stu-skel" style={{ height: 60, borderRadius: "var(--stu-radius-md)" }} />
        </div>
      </StudentPageShell>
    );
  }

  return (
    <StudentPageShell title="알림">
      {!hasNotifications ? (
        <EmptyState
          title="알림이 없습니다"
          description="새로운 알림이 오면 여기에 표시됩니다."
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--stu-space-4)" }}>
          {/* 클리닉 예약 승인 */}
          {approvedClinicBookings.length > 0 && (
            <section>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--stu-space-2)", marginBottom: "var(--stu-space-3)" }}>
                <IconClinic style={{ width: 18, height: 18, color: "var(--stu-primary)" }} />
                <h3 style={{ fontSize: 15, fontWeight: 700 }}>클리닉 예약</h3>
                <span style={{ fontSize: 12, color: "var(--stu-text-muted)" }}>({approvedClinicBookings.length})</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--stu-space-2)" }}>
                {approvedClinicBookings.map((booking) => (
                  <Link
                    key={booking.id}
                    to="/student/clinic"
                    className="stu-panel stu-panel--pressable"
                    style={{ textDecoration: "none", color: "inherit" }}
                  >
                    <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>
                      클리닉 예약이 승인되었습니다
                    </div>
                    <div className="stu-muted" style={{ fontSize: 12 }}>
                      {formatYmd(booking.session_date)} {booking.session_start_time?.slice(0, 5)} @ {booking.session_location}
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* QnA 답변 */}
          {answeredQnaPosts.length > 0 && (
            <section>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--stu-space-2)", marginBottom: "var(--stu-space-3)" }}>
                <IconNotice style={{ width: 18, height: 18, color: "var(--stu-primary)" }} />
                <h3 style={{ fontSize: 15, fontWeight: 700 }}>질문 답변</h3>
                <span style={{ fontSize: 12, color: "var(--stu-text-muted)" }}>({answeredQnaPosts.length})</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--stu-space-2)" }}>
                {answeredQnaPosts.map((post) => (
                  <Link
                    key={post.id}
                    to="/student/qna"
                    state={{ openQuestionId: post.id }}
                    className="stu-panel stu-panel--pressable"
                    style={{ textDecoration: "none", color: "inherit" }}
                  >
                    <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{post.title}</div>
                    <div className="stu-muted" style={{ fontSize: 12 }}>
                      답변이 달렸습니다 · {post.replies_count ?? 0}개
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </StudentPageShell>
  );
}
