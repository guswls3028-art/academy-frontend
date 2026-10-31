import EmptyState from "@student/layout/EmptyState";
import QrScanLink from "@student/shared/ui/attendance/QrScanLink";
import type { ClinicBookingRequest } from "../api/clinicBooking.api";
import { formatYmd } from "@student/shared/utils/date";
import { hhmmText } from "@/shared/ui/time/timeFormat";
import styles from "./ClinicBookingFeedback.module.css";
import pageStyles from "../pages/ClinicPage.module.css";

export function ClinicRejectedBookingHistory({ requests }: { requests: ClinicBookingRequest[] }) {
  if (!requests.length) return null;
  return <div className={pageStyles.bookingGroup}>
    <h3>최근 거절</h3>
    <div className={pageStyles.rejectedList}>
      {requests.map((request) => <div key={request.id}>
        <span>{formatYmd(request.session_date)} {hhmmText(request.session_start_time)}</span>
        <strong>거절됨</strong>
      </div>)}
    </div>
  </div>;
}

export function ClinicAttendanceHistory({ requests }: { requests: ClinicBookingRequest[] }) {
  const recent = requests.filter((request) => request.checked_in_at || request.checked_out_at)
    .sort((left, right) => (right.checked_out_at || right.checked_in_at || "").localeCompare(left.checked_out_at || left.checked_in_at || ""))
    .slice(0, 10);
  return <>
    <QrScanLink />
    {recent.length > 0 && <section className="stu-panel" aria-label="최근 클리닉 등원·하원 기록">
      <h2>최근 등원·하원</h2>
      {recent.map((request) => <div key={request.id} className="stu-panel">
        <strong>{request.session_title || "클리닉"} · {request.session_date}</strong>
        <p>{request.session_location}</p>
        <p>등원 {request.checked_in_at ? new Date(request.checked_in_at).toLocaleTimeString("ko-KR", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit" }) : "기록 없음"}
          {" · "}하원 {request.checked_out_at ? new Date(request.checked_out_at).toLocaleTimeString("ko-KR", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit" }) : "아직 하원하지 않았습니다"}</p>
      </div>)}
    </section>}
  </>;
}

export function ClinicSavedBookingNotice({ message, onView }: { message: string; onView: () => void }) {
  return (
    <div className={styles.savedNotice} role="region" aria-label="클리닉 신청 결과" aria-live="polite">
      <div><strong>클리닉 신청을 저장했어요</strong><p>{message}</p></div>
      <button type="button" onClick={onView}>신청한 일정 보기</button>
    </div>
  );
}

export function ClinicEmptySchedule({ onBook }: { onBook: () => void }) {
  return (
    <div className={styles.emptySchedule}>
      <EmptyState title="예정된 클리닉이 없습니다" description="예약하기에서 열린 일정과 날짜를 확인해 보세요." />
      <button type="button" onClick={onBook}>예약 가능한 일정 보기</button>
    </div>
  );
}
