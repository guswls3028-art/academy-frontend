// src/features/staff/components/StaffSummaryCard.tsx
import { Panel } from "@/shared/ui/ds";

import { StaffSummary } from "../api/staff.api";

export default function StaffSummaryCard({
  summary,
}: {
  summary?: StaffSummary;
}) {
  if (!summary) return null;

  return (
    <Card>
      <CardBody className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Item label="이번달 근무" value={`${summary.work_hours} h`} />
        <Item label="급여" value={`${summary.work_amount.toLocaleString()} 원`} />
        <Item label="비용" value={`${summary.expense_amount.toLocaleString()} 원`} />
        <Item
          label="실 지급액"
          value={`${summary.total_amount.toLocaleString()} 원`}
          primary
        />
      </CardBody>
    </Card>
  );
}

function Item({
  label,
  value,
  primary,
}: {
  label: string;
  value: string;
  primary?: boolean;
}) {
  return (
    <div className="rounded-lg border border-[var(--border-divider)] bg-[var(--bg-surface-soft)] px-4 py-3">
      <div className="text-xs text-[var(--text-muted)]">{label}</div>
      <div
        className={[
          "mt-1 text-lg font-semibold",
          primary
            ? "text-[var(--color-primary)]"
            : "text-[var(--text-primary)]",
        ].join(" ")}
      >
        {value}
      </div>
    </div>
  );
}
