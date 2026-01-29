import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardBody, CardHeader } from "@/shared/ui/card";

export default function ExpenseChartCard({
  data,
}: {
  data: { date: string; amount: number }[];
}) {
  if (!data.length) return null;

  return (
    <Card>
      <CardHeader
        title="지출 추이"
        description="날짜별 지출 합계를 선 그래프로 표시합니다."
      />
      <CardBody className="h-[260px]">
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
      </CardBody>
    </Card>
  );
}
