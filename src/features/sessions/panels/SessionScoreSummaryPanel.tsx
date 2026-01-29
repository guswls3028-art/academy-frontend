/**
 * PATH: src/features/sessions/panels/SessionScoreSummaryPanel.tsx
 *
 * ✅ SessionScoreSummaryPanel (UX 개선 FINAL)
 *
 * 개선 사항:
 * - 합격률을 "전체 학생 수 대비" 명확히 표시
 * - 퍼센트 + n/m 명 병기
 *
 * 설계 계약:
 * - count / pass_count는 backend 단일 진실
 * - 프론트는 계산 ❌ (표현용 비율만 계산)
 */

import { useQuery } from "@tanstack/react-query";
import {
  fetchSessionScoreSummary,
  ScoreGroupSummary,
} from "../api/sessionScoreSummary";

export default function SessionScoreSummaryPanel({
  sessionId,
}: {
  sessionId: number;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["session-score-summary", sessionId],
    queryFn: () => fetchSessionScoreSummary(sessionId),
    enabled: Number.isFinite(sessionId),
  });

  if (isLoading || !data) {
    return (
      <div className="text-sm text-gray-500">
        통계 불러오는 중...
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded border bg-white p-4">
      <div className="text-sm font-semibold">
        시험 성적 통계 (전체 학생 대비)
      </div>

      <StatBlock title="전체" data={data.total} />
      <StatBlock title="오프라인 응시" data={data.offline} />
      <StatBlock title="온라인 응시" data={data.online} muted />
    </div>
  );
}

/* ===================== UI ===================== */

function StatBlock({
  title,
  data,
  muted,
}: {
  title: string;
  data: ScoreGroupSummary;
  muted?: boolean;
}) {
  const total = data.count ?? 0;
  const passed = data.pass_count ?? 0;

  const passRate =
    total > 0
      ? ((passed / total) * 100).toFixed(1)
      : "-";

  return (
    <div
      className={[
        "rounded border p-3 text-sm",
        muted ? "bg-gray-50" : "bg-white",
      ].join(" ")}
    >
      <div className="mb-2 font-medium">
        {title}
      </div>

      <div className="grid grid-cols-2 gap-y-1 text-xs text-gray-700">
        <div>응시자 수</div>
        <div>{total}</div>

        <div>평균 점수</div>
        <div>{Number.isFinite(data.avg) ? data.avg : "-"}</div>

        <div>합격률</div>
        <div>
          {passRate !== "-" ? (
            <>
              {passRate}%
              <span className="ml-1 text-gray-500">
                ({passed}/{total} 명)
              </span>
            </>
          ) : (
            "-"
          )}
        </div>
      </div>
    </div>
  );
}
