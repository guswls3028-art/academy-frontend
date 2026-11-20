import { useQuery } from "@tanstack/react-query";
import {
  fetchSchoolReport, schoolReportKeys, type SchoolReportPeriod,
} from "@/shared/api/contracts/schoolReports";
import SchoolReportScoreList from "@/shared/product/schoolReports/SchoolReportScoreList";
import { schoolReportPeriodLabel } from "@/shared/product/schoolReports/period";
import { Button, EmptyState } from "@/shared/ui/ds";
import styles from "./SchoolReportCollection.module.css";

export default function SchoolReportStudentPanel({ studentId, period }: {
  studentId: number;
  period: SchoolReportPeriod;
}) {
  const detail = useQuery({
    queryKey: schoolReportKeys.detail(studentId, period),
    queryFn: ({ signal }) => fetchSchoolReport(studentId, period, signal),
  });
  if (detail.isPending) return <p role="status">성적표를 불러오는 중…</p>;
  if (detail.isError) {
    return <EmptyState scope="panel" tone="error" title="성적표를 불러오지 못했습니다"
      actions={<Button intent="secondary" onClick={() => void detail.refetch()}>다시 시도</Button>}
    />;
  }

  const report = detail.data;
  return (
    <section className={styles.detail} aria-label={`${report.student_name} ${schoolReportPeriodLabel(period)} 성적표`}>
      <div className={styles.detailHeader}>
        <h3>{schoolReportPeriodLabel(period)} 성적표</h3>
        <span data-submitted={report.status === "submitted"} className={styles.badge}>
          {report.status === "submitted" ? "제출 완료" : report.requested_at ? "요청함" : "미제출"}
        </span>
      </div>
      {report.scores.length > 0
        ? <SchoolReportScoreList scores={report.scores} />
        : <p className={styles.muted}>이 시험 구분에 제출된 점수가 없습니다.</p>}
    </section>
  );
}
