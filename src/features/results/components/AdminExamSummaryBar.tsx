// src/features/results/components/AdminExamSummaryBar.tsx

import type { AdminExamSummary } from "../types/results.types";

export default function AdminExamSummaryBar({ data }: { data: AdminExamSummary }) {
  const avg = typeof data.avg_score === "number" ? data.avg_score.toFixed(1) : "-";

  return (
    <div className="grid grid-cols-6 gap-2 rounded bg-gray-50 p-3 text-sm">
      <div>응시: {data.participant_count ?? "-"}</div>
      <div>평균: {avg}</div>
      <div>최저: {data.min_score ?? "-"}</div>
      <div>최고: {data.max_score ?? "-"}</div>
      <div>
        합격률:{" "}
        {typeof data.pass_rate === "number" ? `${(data.pass_rate * 100).toFixed(1)}%` : "-"}
      </div>
      <div>클리닉: {data.clinic_count ?? 0}</div>
    </div>
  );
}
