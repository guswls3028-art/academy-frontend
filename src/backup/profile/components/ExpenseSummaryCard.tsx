// PATH: src/features/profile/components/ExpenseSummaryCard.tsx
import { Card, CardBody } from "@/shared/ui/card";
import { Expense } from "../api/profile";

function safeArray<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

export default function ExpenseSummaryCard({ rows }: { rows?: Expense[] | unknown }) {
  const list = safeArray<Expense>(rows);
  const total = list.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const count = list.length;
  const avg = count ? Math.round(total / count) : 0;

  return (
    <Card className="bg-[var(--bg-surface-soft)]">
      <CardBody className="grid grid-cols-3 gap-4">
        <SummaryItem label="월 총 지출" value={`${total.toLocaleString()} 원`} danger />
        <SummaryItem label="지출 건수" value={`${count} 건`} />
        <SummaryItem label="건당 평균" value={`${avg.toLocaleString()} 원`} />
      </CardBody>
    </Card>
  );
}

function SummaryItem({
  label,
  value,
  danger,
}: {
  label: string;
  value: string;
  danger?: boolean;
}) {
  return (
    <div className="rounded-lg bg-[var(--bg-surface)] px-4 py-3 shadow-sm">
      <div className="text-xs text-[var(--text-muted)]">{label}</div>
      <div
        className={[
          "mt-1 text-lg font-semibold",
          danger ? "text-[var(--color-danger)]" : "text-[var(--text-primary)]",
        ].join(" ")}
      >
        {value}
      </div>
    </div>
  );
}
