// PATH: src/features/profile/expense/components/ExpenseSummaryCard.tsx
import { Card, CardBody } from "@/shared/ui/card";

export default function ExpenseSummaryCard({
  total,
  count,
}: {
  total: number;
  count: number;
}) {
  const avgPerItem = count ? Math.round(total / count) : 0;

  return (
    <div className="max-w-[980px]">
      <Card className="bg-[var(--bg-surface)]">
        <CardBody className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Item label="총 지출" value={`${total.toLocaleString()} 원`} tone="danger" big />
          <Item label="지출 건수" value={`${count.toLocaleString()} 건`} />
          <Item label="건당 평균" value={`${avgPerItem.toLocaleString()} 원`} />
        </CardBody>
      </Card>
    </div>
  );
}

function Item({
  label,
  value,
  tone,
  big,
}: {
  label: string;
  value: string;
  tone?: "danger" | "normal";
  big?: boolean;
}) {
  return (
    <div className="rounded-xl border border-[var(--border-divider)] bg-[var(--bg-surface-soft)] px-4 py-3">
      <div className="text-xs text-[var(--text-muted)]">{label}</div>
      <div
        className={[
          "mt-1 font-semibold",
          big ? "text-2xl" : "text-xl",
          tone === "danger" ? "text-[var(--color-danger)]" : "text-[var(--text-primary)]",
        ].join(" ")}
      >
        {value}
      </div>
    </div>
  );
}
