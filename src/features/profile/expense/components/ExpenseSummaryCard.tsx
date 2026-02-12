// PATH: src/features/profile/expense/components/ExpenseSummaryCard.tsx
import { Panel } from "@/shared/ui/ds";

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
      className="rounded-xl border px-5 py-4 transition-all"
      style={{
        borderColor: "var(--color-border-divider)",
        background:
          tone === "danger"
            ? "color-mix(in srgb, var(--color-error) 8%, var(--color-bg-surface))"
            : "var(--color-bg-surface-soft)",
        boxShadow: "var(--elevation-1)",
      }}
    >
      <div
        style={{
          fontSize: "var(--text-xs)",
          fontWeight: "var(--font-meta)",
          color: "var(--color-text-muted)",
        }}
      >
        {label}
      </div>
      <div
        className="mt-2 flex items-baseline gap-1"
        style={{
          fontSize: big ? "var(--text-2xl)" : "var(--text-xl)",
          fontWeight: 700,
          letterSpacing: "-0.4px",
          color:
            tone === "danger"
              ? "var(--color-error)"
              : "var(--color-text-primary)",
        }}
      >
        <span>{typeof value === "number" ? value.toLocaleString() : value}</span>
        {unit && (
          <span
            style={{
              fontSize: "var(--text-sm)",
              fontWeight: "var(--font-meta)",
              color: "var(--color-text-muted)",
            }}
          >
            {unit}
          </span>
        )}
      </div>
    </div>
  );
}
