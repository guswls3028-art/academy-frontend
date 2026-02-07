// PATH: src/features/profile/expense/components/ExpenseChartCard.tsx
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Panel } from "@/shared/ui/ds";

export default function ExpenseChartCard({
  data,
}: {
  data: { date: string; amount: number }[];
}) {
  if (!data.length) return null;

  return (
    <Panel>
      <div className="panel-header">
        <div className="text-sm font-semibold text-[var(--text-primary)]">
          지출 추이
        </div>
        <div className="mt-1 text-xs text-[var(--text-muted)]">
          날짜별 지출 합계를 선 그래프로 표시합니다.
        </div>
      </div>

      <div className="panel-body h-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <XAxis dataKey="date" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip
              formatter={(v: number) =>
                `${Number(v).toLocaleString()} 원`
              }
            />
            <Line
              type="monotone"
              dataKey="amount"
              stroke="var(--color-primary)"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  );
}
