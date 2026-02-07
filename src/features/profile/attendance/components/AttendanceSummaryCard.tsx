// PATH: src/features/profile/attendance/components/AttendanceSummaryCard.tsx
import { Panel } from "@/shared/ui/ds";
import { AttendanceSummary } from "../../api/profile.api";

export default function AttendanceSummaryCard({
  summary,
}: {
  summary?: AttendanceSummary | null;
}) {
  if (!summary) return null;

  return (
    <Panel>
      <div className="panel-body grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Item label="총 근무 시간" value={`${summary.total_hours} h`} />
        <Item
          label="총 급여"
          value={`${summary.total_amount.toLocaleString()} 원`}
        />
        <Item
          label="세후 수령액"
          value={`${summary.total_after_tax.toLocaleString()} 원`}
          tone="primary"
        />
      </div>
    </Panel>
  );
}

function Item({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "primary" | "normal";
}) {
  return (
    <div className="rounded-lg border border-[var(--border-divider)] bg-[var(--bg-surface-soft)] px-4 py-3">
      <div className="text-xs text-[var(--text-muted)]">{label}</div>
      <div
        className={[
          "mt-1 text-2xl font-semibold",
          tone === "primary"
            ? "text-[var(--color-primary)]"
            : "text-[var(--text-primary)]",
        ].join(" ")}
      >
        {value}
      </div>
    </div>
  );
}
