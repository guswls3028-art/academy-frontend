// PATH: src/features/sessions/panels/SessionScoreSummaryPanel.tsx
import { useQuery } from "@tanstack/react-query";
import {
  fetchSessionScoreSummary,
  ScoreGroupSummary,
} from "../api/sessionScoreSummary";
import { Panel } from "@/shared/ui/ds";

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
      <div
        className="text-sm"
        style={{ color: "var(--color-text-muted)" }}
      >
        통계 불러오는 중…
      </div>
    );
  }

  return (
    <Panel>
      <div className="mb-4 text-sm font-semibold">
        시험 성적 통계 (전체 학생 대비)
      </div>

      <StatBlock title="전체" data={data.total} />
      <StatBlock title="오프라인 응시" data={data.offline} />
      <StatBlock title="온라인 응시" data={data.online} muted />
    </Panel>
  );
}

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
      className="mb-3 rounded border p-3 text-sm"
      style={{
        borderColor: "var(--color-border-divider)",
        background: muted
          ? "var(--color-bg-surface-soft)"
          : "var(--color-bg-surface)",
      }}
    >
      <div className="mb-2 font-medium">{title}</div>

      <div
        className="grid grid-cols-2 gap-y-1 text-xs"
        style={{ color: "var(--color-text-secondary)" }}
      >
        <div>응시자 수</div>
        <div>{total}</div>

        <div>평균 점수</div>
        <div>{Number.isFinite(data.avg) ? data.avg : "-"}</div>

        <div>합격률</div>
        <div>
          {passRate !== "-" ? (
            <>
              {passRate}%
              <span
                className="ml-1"
                style={{ color: "var(--color-text-muted)" }}
              >
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
