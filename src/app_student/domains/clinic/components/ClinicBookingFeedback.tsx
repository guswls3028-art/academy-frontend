import EmptyState from "@student/layout/EmptyState";
import styles from "./ClinicBookingFeedback.module.css";

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
