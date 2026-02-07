// PATH: src/features/staff/components/StaffKpiCard.tsx
import { Panel } from "@/shared/ui/ds";


export default function StaffKpiCard({
  staffCount,
  workHours,
  totalPay,
  totalExpense,
}: {
  staffCount: number;
  workHours: number;
  totalPay: number;
  totalExpense: number;
}) {
  return (
    <Card>
      <CardBody className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <Item label="직원 수" value={`${staffCount.toLocaleString()} 명`} />
        <Item label="총 근무시간" value={`${workHours} h`} />
        <Item label="총 급여" value={`${totalPay.toLocaleString()} 원`} tone="primary" />
        <Item label="총 비용" value={`${totalExpense.toLocaleString()} 원`} />
      </CardBody>
    </Card>
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
          "mt-1 text-xl font-semibold",
          tone === "primary" ? "text-[var(--color-primary)]" : "text-[var(--text-primary)]",
        ].join(" ")}
      >
        {value}
      </div>
    </div>
  );
}
