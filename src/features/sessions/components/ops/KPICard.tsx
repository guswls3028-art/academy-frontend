/**
 * 운영 보드 KPI 카드 — 플랫, border 중심
 */
type Color = "gray" | "blue" | "yellow" | "green";

const colorClasses: Record<Color, { border: string; bg: string; text: string }> = {
  gray: {
    border: "border-[var(--color-border-divider)]",
    bg: "bg-[var(--color-bg-surface)]",
    text: "text-[var(--color-text-secondary)]",
  },
  blue: {
    border: "border-blue-500/30",
    bg: "bg-blue-500/5",
    text: "text-blue-700 dark:text-blue-300",
  },
  yellow: {
    border: "border-amber-500/40",
    bg: "bg-amber-500/10",
    text: "text-amber-800 dark:text-amber-200",
  },
  green: {
    border: "border-emerald-500/30",
    bg: "bg-emerald-500/5",
    text: "text-emerald-700 dark:text-emerald-300",
  },
};

type Props = {
  label: string;
  value: number;
  color?: Color;
};

export default function KPICard({ label, value, color = "gray" }: Props) {
  const c = colorClasses[color];
  return (
    <div
      className={`rounded-lg border ${c.border} ${c.bg} px-4 py-3 min-w-0`}
    >
      <div className={`text-xs font-semibold uppercase tracking-wide ${c.text}`}>
        {label}
      </div>
      <div className="mt-1 text-2xl font-bold text-[var(--color-text-primary)]">
        {value}
      </div>
    </div>
  );
}
