// PATH: src/app_admin/domains/profile/expense/components/ExpenseSummaryCard.tsx
import { Panel } from "@/shared/ui/ds";
import styles from "./ExpenseCards.module.css";

export default function ExpenseSummaryCard({
  total,
  count,
}: {
  total: number;
  count: number;
}) {
  const avgPerItem = count ? Math.round(total / count) : 0;

  return (
    <Panel variant="primary">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Item
          label="총 지출"
          value={total.toLocaleString()}
          unit="원"
          tone="danger"
          big
        />
        <Item label="지출 건수" value={count.toLocaleString()} unit="건" />
        <Item label="건당 평균" value={avgPerItem.toLocaleString()} unit="원" />
      </div>
    </Panel>
  );
}

function Item({
  label,
  value,
  unit,
  tone,
  big,
}: {
  label: string;
  value: string | number;
  unit?: string;
  tone?: "danger" | "normal";
  big?: boolean;
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
        data-big={big === true}
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
