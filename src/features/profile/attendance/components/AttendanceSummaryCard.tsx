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
      className="rounded-xl border px-5 py-4 transition-all"
      style={{
        borderColor: "var(--color-border-divider)",
        background: tone === "primary"
          ? "color-mix(in srgb, var(--color-primary) 8%, var(--color-bg-surface))"
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
          fontSize: "var(--text-2xl)",
          fontWeight: 700,
          letterSpacing: "-0.4px",
          color:
            tone === "primary"
              ? "var(--color-primary)"
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
