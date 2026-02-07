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
    <Panel>
      <div className="panel-header">
        <div className="text-sm font-semibold text-[var(--text-primary)]">
          근무 시간 추이
        </div>
        <div className="mt-1 text-xs text-[var(--text-muted)]">
          날짜별 근무 시간을 선 그래프로 표시합니다.
        </div>
      </div>

      <div className="panel-body h-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <XAxis dataKey="date" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip formatter={(v: number) => `${v} 시간`} />
            <Line
              type="monotone"
              dataKey="hours"
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
