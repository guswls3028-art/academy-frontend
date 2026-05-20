// PATH: src/app_admin/domains/profile/expense/components/ExpenseChartCard.tsx
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Panel } from "@/shared/ui/ds";
import styles from "./ExpenseCards.module.css";

const CHART_TICK = { fontSize: 12, fill: "var(--color-text-muted)" };
const TOOLTIP_CONTENT_STYLE = {
  background: "var(--color-bg-surface)",
  border: "1px solid var(--color-border-divider)",
  borderRadius: "var(--radius-md)",
};

export default function ExpenseChartCard({
  data,
}: {
  data: { date: string; amount: number }[];
}) {
  if (!data.length) return null;

  return (
    <Panel variant="default">
      <div className={styles.chartHeader}>
        <div className={styles.chartTitle}>
          지출 추이
        </div>
        <div className={`mt-1 ${styles.chartDescription}`}>
          날짜별 지출 합계를 선 그래프로 표시합니다
        </div>
      </div>

      <div className={styles.chartBody}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <XAxis
              dataKey="date"
              tick={CHART_TICK}
            />
            <YAxis tick={CHART_TICK} />
            <Tooltip
              formatter={(v) => `${Number(v).toLocaleString()} 원`}
              contentStyle={TOOLTIP_CONTENT_STYLE}
            />
            <Line
              type="monotone"
              dataKey="amount"
              stroke="var(--color-error)"
              strokeWidth={2.5}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  );
}
