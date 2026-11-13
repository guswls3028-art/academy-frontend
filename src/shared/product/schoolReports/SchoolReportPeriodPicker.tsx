import type { SchoolReportPeriod } from "@/shared/api/contracts/schoolReports";
import { currentSchoolReportPeriod, SCHOOL_REPORT_PERIODS, schoolReportPeriodLabel } from "./period";
import styles from "./SchoolReports.module.css";

export default function SchoolReportPeriodPicker({ period, onChange, disabled }: {
  period: SchoolReportPeriod;
  onChange: (period: SchoolReportPeriod) => void;
  disabled?: boolean;
}) {
  const year = currentSchoolReportPeriod().academic_year;
  const latestYear = Math.max(year, period.academic_year);
  const years = Array.from({ length: latestYear - 1999 }, (_, index) => latestYear - index);
  return (
    <div className={styles.periodPicker}>
      <label className={styles.year}>
        <span>학년도</span>
        <select
          value={period.academic_year}
          disabled={disabled}
          onChange={(event) => onChange({ ...period, academic_year: Number(event.target.value) })}
        >
          {years.map((item) => <option key={item} value={item}>{item}학년도</option>)}
        </select>
      </label>
      <div className={styles.periods} role="group" aria-label="시험 구분">
        {SCHOOL_REPORT_PERIODS.map((item) => (
          <button
            type="button"
            key={`${item.semester}-${item.exam_round}`}
            aria-pressed={period.semester === item.semester && period.exam_round === item.exam_round}
            disabled={disabled}
            onClick={() => onChange({ ...period, ...item })}
          >
            {schoolReportPeriodLabel(item)}
          </button>
        ))}
      </div>
    </div>
  );
}
