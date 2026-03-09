// PATH: src/features/results/panels/SessionExamSummaryPanel.tsx

import { useQuery } from "@tanstack/react-query";
import api from "@/shared/api/axios";

type Props = {
  sessionId: number;
  activeExamId?: number;
};

type SessionExamSummaryRow = {
  exam_id: number;
  title: string;

  participant_count: number;
  avg_score: number;
  min_score: number;
  max_score: number;

  pass_count: number;
  fail_count: number;
  pass_rate: number;

  clinic_count: number;
};

type SessionExamsSummaryResponse = {
  session_id: number;
  exams: SessionExamSummaryRow[];
};

async function fetchSessionExamsSummary(
  sessionId: number
): Promise<SessionExamsSummaryResponse> {
  const res = await api.get(
    `/results/admin/sessions/${sessionId}/exams/summary/`
  );
  return res.data;
}

export default function SessionExamSummaryPanel({
  sessionId,
  activeExamId,
}: Props) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["session-exams-summary", sessionId],
    queryFn: () => fetchSessionExamsSummary(sessionId),
    enabled: Number.isFinite(sessionId),
  });

  if (isLoading) {
    return <EmptyState scope="panel" tone="loading" title="성적 요약 불러오는 중…" />;
  }

  if (isError || !data) {
    return <EmptyState scope="panel" tone="error" title="성적 요약를 불러오지 못했습니다." />;
  }

  if (!data.exams || data.exams.length === 0) {
    return <EmptyState scope="panel" tone="empty" title="성적 데이터가 없습니다." />;
  }

  return (
    <div className="space-y-3">
      <div className="text-sm font-semibold text-[var(--color-text-primary)]">시험별 성적 요약</div>

      <div className="ds-table-wrap">
        <table className="ds-table w-full">
          <thead>
            <tr>
              <th style={{ textAlign: "left" }}>시험</th>
              <th>응시</th>
              <th>평균</th>
              <th>최저</th>
              <th>최고</th>
              <th>합격률</th>
              <th>클리닉</th>
            </tr>
          </thead>
          <tbody>
            {data.exams.map((row) => {
              const isActive = row.exam_id === activeExamId;
              return (
                <tr
                  key={row.exam_id}
                  style={isActive ? { background: "color-mix(in srgb, var(--color-primary) 8%, var(--color-bg-surface))" } : undefined}
                >
                  <td style={{ textAlign: "left", fontWeight: 600 }}>{row.title}</td>
                  <td>{row.participant_count}</td>
                  <td>{row.avg_score.toFixed(1)}</td>
                  <td>{row.min_score}</td>
                  <td>{row.max_score}</td>
                  <td>{(row.pass_rate * 100).toFixed(1)}%</td>
                  <td>{row.clinic_count}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
