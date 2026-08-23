import { useQuery } from "@tanstack/react-query";

import { fetchAttendanceSummary } from "@/shared/api/contracts/attendance";
import {
  ATTENDANCE_META,
  ORDERED_ATTENDANCE_STATUS,
} from "@/shared/ui/badges/attendanceStatus";
import { adminSessionQueryKeys } from "../queryKeys";

import styles from "./SessionAttendanceSummary.module.css";

type Props = {
  sessionId: number;
};

export default function SessionAttendanceSummary({ sessionId }: Props) {
  const summaryQuery = useQuery({
    queryKey: adminSessionQueryKeys.attendance(sessionId),
    queryFn: () => fetchAttendanceSummary(sessionId),
    enabled: Number.isFinite(sessionId),
    staleTime: 30_000,
  });

  if (summaryQuery.isLoading) {
    return (
      <div className={styles.root} aria-label="차시 출결 집계 불러오는 중">
        <span className={styles.eyebrow}>출결 원장</span>
        <span className={styles.message}>집계 중…</span>
      </div>
    );
  }

  if (summaryQuery.isError || !summaryQuery.data) {
    return (
      <div className={styles.root} aria-label="차시 출결 집계 오류">
        <span className={styles.eyebrow}>출결 원장</span>
        <button
          type="button"
          className={styles.retry}
          onClick={() => void summaryQuery.refetch()}
        >
          다시 불러오기
        </button>
      </div>
    );
  }

  const { total, counts } = summaryQuery.data;
  const visibleStatuses = ORDERED_ATTENDANCE_STATUS.filter(
    (status) => (counts[status] ?? 0) > 0,
  );
  const accessibleSummary = [
    `총 ${total}명`,
    ...visibleStatuses.map((status) => `${ATTENDANCE_META[status].label} ${counts[status]}명`),
  ].join(", ");

  return (
    <section className={styles.root} aria-label={`차시 출결 집계: ${accessibleSummary}`}>
      <span className={styles.eyebrow}>출결 원장</span>
      <span className={`${styles.item} ${styles.total}`}>
        <span>총</span>
        <strong>{total}</strong>
      </span>
      {visibleStatuses.map((status) => (
        <span key={status} className={styles.item} data-status={status.toLowerCase()}>
          <span className={styles.dot} aria-hidden />
          <span>{ATTENDANCE_META[status].label}</span>
          <strong>{counts[status]}</strong>
        </span>
      ))}
    </section>
  );
}
