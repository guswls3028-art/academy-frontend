// PATH: src/app_admin/domains/profile/attendance/components/AttendanceSummaryCard.tsx
import { Panel } from "@/shared/ui/ds";
import { AttendanceSummary } from "../../api/profile.api";
import styles from "./AttendanceCards.module.css";

export default function AttendanceSummaryCard({
  summary,
}: {
  summary?: AttendanceSummary | null;
}) {
  if (!summary) return null;

  return (
    <Panel variant="primary">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Item label="총 근무 시간" value={`${summary.total_hours}`} unit="시간" />
        <Item
          label="총 급여"
          value={summary.total_amount.toLocaleString()}
          unit="원"
        />
        <Item
          label="세후 수령액"
          value={summary.total_after_tax.toLocaleString()}
          unit="원"
          tone="primary"
        />
      </div>
    </Panel>
  );
}

function Item({
  label,
  value,
  unit,
  tone,
}: {
  label: string;
  value: string | number;
  unit?: string;
  tone?: "primary" | "normal";
}) {
  return (
    <div
      className={`rounded-xl border px-5 py-4 transition-all ${styles.summaryItem}`}
      data-tone={tone ?? "normal"}
    >
      <div className={styles.summaryLabel}>
        {label}
      </div>
      <div
        className={`mt-2 flex items-baseline gap-1 ${styles.summaryValue}`}
        data-tone={tone ?? "normal"}
      >
        <span>{typeof value === "number" ? value.toLocaleString() : value}</span>
        {unit && (
          <span className={styles.summaryUnit}>
            {unit}
          </span>
        )}
      </div>
    </div>
  );
}
