// PATH: src/app_admin/domains/profile/attendance/components/AttendanceChartCard.tsx
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Panel } from "@/shared/ui/ds";
import styles from "./AttendanceCards.module.css";

const CHART_TICK = { fontSize: 12, fill: "var(--color-text-muted)" };
const TOOLTIP_CONTENT_STYLE = {
  background: "var(--color-bg-surface)",
  border: "1px solid var(--color-border-divider)",
  borderRadius: "var(--radius-md)",
};

export default function AttendanceChartCard({
  data,
}: {
  data: { date: string; hours: number }[];
}) {
  if (!data.length) return null;

  return (
    <Panel variant="default">
      <div className={styles.chartHeader}>
        <div className={styles.chartTitle}>
          근무 시간 추이
        </div>
        <div className={`mt-1 ${styles.chartDescription}`}>
          날짜별 근무 시간을 선 그래프로 표시합니다
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
              formatter={(v) => `${v} 시간`}
              contentStyle={TOOLTIP_CONTENT_STYLE}
            />
            <Line
              type="monotone"
              dataKey="hours"
              stroke="var(--color-primary)"
              strokeWidth={2.5}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  );
}
