// PATH: src/features/profile/attendance/components/AttendanceChartCard.tsx
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Panel } from "@/shared/ui/ds";

export default function AttendanceChartCard({
  data,
}: {
  data: { date: string; hours: number }[];
}) {
  if (!data.length) return null;

  return (
    <Panel variant="default">
      <div
        style={{
          padding: "var(--space-6)",
          borderBottom: "1px solid var(--color-border-divider)",
        }}
      >
        <div
          style={{
            fontSize: "var(--text-md)",
            fontWeight: "var(--font-title)",
            color: "var(--color-text-primary)",
          }}
        >
          근무 시간 추이
        </div>
        <div
          className="mt-1"
          style={{
            fontSize: "var(--text-sm)",
            color: "var(--color-text-muted)",
            fontWeight: "var(--font-meta)",
          }}
        >
          날짜별 근무 시간을 선 그래프로 표시합니다
        </div>
      </div>

      <div style={{ padding: "var(--space-6)", height: 280 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <XAxis
              dataKey="date"
              tick={{ fontSize: 12, fill: "var(--color-text-muted)" }}
            />
            <YAxis tick={{ fontSize: 12, fill: "var(--color-text-muted)" }} />
            <Tooltip
              formatter={(v: number) => `${v} 시간`}
              contentStyle={{
                background: "var(--color-bg-surface)",
                border: "1px solid var(--color-border-divider)",
                borderRadius: "var(--radius-md)",
              }}
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
