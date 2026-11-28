import { useQueries } from "@tanstack/react-query";
import {
  fetchOwnSchoolReport, schoolReportKeys, type SchoolReportPeriod, type SchoolReportScore,
} from "@/shared/api/contracts/schoolReports";
import { currentSchoolReportPeriod, SCHOOL_REPORT_PERIODS, schoolReportPeriodLabel } from "@/shared/product/schoolReports/period";
import styles from "./SchoolReportEntryPage.module.css";

export type SchoolReportEdit = { period: SchoolReportPeriod; scores: SchoolReportScore[] };

type Props = {
  year: number;
  readOnly: boolean;
  onYear: (year: number) => void;
  onEdit: (edit: SchoolReportEdit) => void;
};

export default function DawonSchoolYearReport({ year, readOnly, onYear, onEdit }: Props) {
  const periods = SCHOOL_REPORT_PERIODS.map(term => ({ academic_year: year, ...term }));
  const queries = useQueries({
    queries: periods.map(period => ({
      queryKey: schoolReportKeys.own(period),
      queryFn: ({ signal }: { signal: AbortSignal }) => fetchOwnSchoolReport(period, signal),
      staleTime: 30_000,
    })),
  });
  const currentYear = currentSchoolReportPeriod().academic_year;
  const individual = queries.find(query => query.data)?.data;
  const newest = Math.max(year, currentYear, ...(individual?.submitted_periods ?? []).map(period => period.academic_year));
  const years = Array.from({ length: newest - 1999 }, (_, index) => newest - index);
  const grade = individual?.grade;
  return <section className={styles.yearReport} aria-label="학년별 학교 성적">
    <header className={styles.yearHeading}>
      <h2>{grade && year === currentYear ? `${grade}학년` : `${year}학년도 학교 성적`}</h2>
      <label><span className="sr-only">조회할 학년도</span><select value={year} onChange={e => onYear(Number(e.target.value))}>
        {years.map(item => <option key={item} value={item}>{item}학년도</option>)}
      </select></label>
    </header>
    <table className={styles.yearTable}>
      <thead><tr><th scope="col">시험</th><th scope="col">과목별 성적</th>{!readOnly && <th scope="col">관리</th>}</tr></thead>
      <tbody>{periods.map((period, index) => {
        const result = queries[index];
        const report = result.data;
        const label = schoolReportPeriodLabel(period);
        return <tr key={label}>
          <th scope="row">{label}</th>
          <td>{result.isError ? <span role="alert">조회 실패 <button type="button" className="stu-btn stu-btn--secondary" onClick={() => void result.refetch()}>다시 시도</button></span>
            : !report ? <span role="status">불러오는 중…</span>
            : report.scores.length ? <ul className={styles.yearScores}>
              {report.scores.map(score => <li key={score.id}><span>{score.subject}</span>
                <span><strong>{score.score}</strong> / {score.max_score}점{score.grade_rank == null ? "" : ` · ${score.grade_rank}등급`}</span>
              </li>)}
            </ul> : <span className={styles.muted}>미입력</span>}</td>
          {!readOnly && <td>{report && !result.isError && <button type="button" className="stu-btn stu-btn--secondary" aria-label={label + (report.direct_scores.length ? " 점수 수정" : " 점수 입력")}
            onClick={() => onEdit({ period, scores: report.direct_scores })}>{report.direct_scores.length ? "수정" : "입력"}</button>}</td>}
        </tr>;
      })}</tbody>
    </table>
  </section>;
}
