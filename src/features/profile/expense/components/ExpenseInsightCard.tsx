// PATH: src/features/profile/expense/components/ExpenseInsightCard.tsx
import { Panel } from "@/shared/ui/ds";

export default function ExpenseInsightCard({
  maxDay,
  avgPerDay,
  overAvgDays,
  top3,
}: {
  maxDay: { date: string; amount: number } | null;
  avgPerDay: number;
  overAvgDays: number;
  top3: { title: string; amount: number }[];
}) {
  if (!maxDay) return null;

  return (
    <Panel variant="default">
      <div className="flex flex-col gap-[var(--space-6)]">
        <div className="flex items-center justify-between">
          <div
            style={{
              fontSize: "var(--text-md)",
              fontWeight: "var(--font-title)",
              color: "var(--color-text-primary)",
            }}
          >
            인사이트
          </div>
          <div
            style={{
              fontSize: "var(--text-xs)",
              color: "var(--color-text-muted)",
              fontWeight: "var(--font-meta)",
            }}
          >
            해당 기간 기준
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Kpi
            label="최대 지출일"
            value={maxDay.date}
            sub={`${maxDay.amount.toLocaleString()} 원`}
            tone="danger"
          />
          <Kpi
            label="일 평균 지출"
            value={avgPerDay.toLocaleString()}
            unit="원"
            sub="일자별 합계 기준"
          />
          <Kpi
            label="평균 초과 일수"
            value={overAvgDays}
            unit="일"
            sub="지출이 많은 날"
          />
        </div>

        {top3.length > 0 && (
          <div
            className="rounded-xl border px-5 py-4"
            style={{
              borderColor: "var(--color-border-divider)",
              background: "var(--color-bg-surface-soft)",
            }}
          >
            <div
              style={{
                fontSize: "var(--text-xs)",
                fontWeight: "var(--font-title)",
                color: "var(--color-text-muted)",
              }}
            >
              TOP 항목
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {top3.map((t) => (
                <span
                  key={t.title}
                  className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition-all"
                  style={{
                    borderColor: "var(--color-border-divider)",
                    background: "var(--color-bg-surface)",
                  }}
                  title={`${t.amount.toLocaleString()} 원`}
                >
                  <span
                    style={{
                      fontWeight: "var(--font-title)",
                      color: "var(--color-text-primary)",
                    }}
                  >
                    {t.title}
                  </span>
                  <span style={{ color: "var(--color-text-muted)" }}>
                    {t.amount.toLocaleString()}원
                  </span>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </Panel>
  );
}

function Kpi({
  label,
  value,
  unit,
  sub,
  tone,
}: {
  label: string;
  value: string | number;
  unit?: string;
  sub?: string;
  tone?: "danger" | "normal";
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
          fontSize: "var(--text-xl)",
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
      {sub && (
        <div
          className="mt-2"
          style={{
            fontSize: "var(--text-xs)",
            color: "var(--color-text-muted)",
            fontWeight: "var(--font-meta)",
          }}
        >
          {sub}
        </div>
      )}
    </div>
  );
}
