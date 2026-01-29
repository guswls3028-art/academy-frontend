import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardBody, CardHeader } from "@/shared/ui/card";

export default function AttendanceChartCard({
  data,
}: {
  data: { date: string; hours: number }[];
}) {
  if (!data.length) return null;

  return (
    <Card>
      <CardHeader
        title="근무 시간 추이"
        description="날짜별 근무 시간을 선 그래프로 표시합니다."
      />
      <CardBody className="h-[260px]">
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
      </CardBody>
    </Card>
  );
}
