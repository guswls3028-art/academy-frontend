// PATH: src/features/scores/panels/ScoresAnalyticsPanel.tsx
/**
 * ScoresAnalyticsPanel
 *
 * ✅ UI ONLY
 * - Card 기반 공용 디자인 적용
 * - 테마(token.css) 연동
 * - 로직 / API / 데이터 구조 변경 ❌
 */

import { useQuery } from "@tanstack/react-query";
import { fetchSessionScoreSummary } from "@/features/sessions/api/sessionScoreSummary";
import { PageSection } from "@/shared/ui/page";

export default function ScoresAnalyticsPanel({
  sessionId,
}: {
  sessionId: number;
}) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["session-score-summary", sessionId],
    queryFn: () => fetchSessionScoreSummary(sessionId),
  });

  return (
    <PageSection title="성적 분석">
      {/* Loading */}
      {isLoading && (
        <div className="text-sm text-muted">분석 불러오는 중...</div>
      )}

      {/* Error */}
      {isError && (
        <div className="text-sm text-red-500">
          분석 데이터를 불러오지 못했습니다.
        </div>
      )}

      {/* Content */}
      {!isLoading && !isError && data && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <AnalyticsCard title="전체" data={data.total} />
          <AnalyticsCard title="오프라인" data={data.offline} />
          <AnalyticsCard title="온라인" data={data.online} />
        </div>
      )}
    </PageSection>
  );
}

/* ================================
   Card Block
================================ */

function AnalyticsCard({
  title,
  data,
}: {
  title: string;
  data: {
    count: number;
    avg: number;
  };
}) {
  return (
    <div className="card p-4">
      <div className="mb-3 text-sm font-semibold text-secondary">
        {title}
      </div>

      <div className="space-y-1 text-sm">
        <div className="flex justify-between">
          <span className="text-muted">응시자</span>
          <span className="font-medium text-primary">{data.count}</span>
        </div>

        <div className="flex justify-between">
          <span className="text-muted">평균</span>
          <span className="font-medium text-primary">{data.avg}</span>
        </div>
      </div>
    </div>
  );
}
