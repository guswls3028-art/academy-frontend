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
    <div className="max-w-[980px]">
      <Panel>
        <div className="panel-body space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-[var(--text-primary)]">
              인사이트
            </div>
            <div className="text-xs text-[var(--text-muted)]">
              해당 기간 기준
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Kpi
              label="최대 지출일"
              value={`${maxDay.date}`}
              sub={`${maxDay.amount.toLocaleString()} 원`}
              tone="danger"
            />
            <Kpi
              label="일 평균 지출"
              value={`${avgPerDay.toLocaleString()} 원`}
              sub="일자별 합계 기준"
            />
            <Kpi
              label="평균 초과 일수"
              value={`${overAvgDays} 일`}
              sub="지출이 많은 날"
            />
          </div>

          {top3.length > 0 && (
            <div className="rounded-xl border border-[var(--border-divider)] bg-[var(--bg-surface-soft)] px-4 py-3">
              <div className="text-xs text-[var(--text-muted)]">TOP 항목</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {top3.map((t) => (
                  <span
                    key={t.title}
                    className={[
                      "inline-flex items-center gap-2 rounded-full",
                      "border border-[var(--border-divider)] bg-[var(--bg-surface)]",
                      "px-3 py-1 text-xs",
                    ].join(" ")}
                    title={`${t.amount.toLocaleString()} 원`}
                  >
                    <span className="font-medium text-[var(--text-primary)]">
                      {t.title}
                    </span>
                    <span className="text-[var(--text-muted)]">
                      {t.amount.toLocaleString()}원
                    </span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </Panel>
    </div>
  );
}

function Kpi({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "danger" | "normal";
}) {
  return (
    <div className="rounded-xl border border-[var(--border-divider)] bg-[var(--bg-surface-soft)] px-4 py-3">
      <div className="text-xs text-[var(--text-muted)]">{label}</div>
      <div
        className={[
          "mt-1 text-xl font-semibold",
          tone === "danger"
            ? "text-[var(--color-danger)]"
            : "text-[var(--text-primary)]",
        ].join(" ")}
      >
        {value}
      </div>
      {sub && <div className="mt-1 text-xs text-[var(--text-muted)]">{sub}</div>}
    </div>
  );
}
