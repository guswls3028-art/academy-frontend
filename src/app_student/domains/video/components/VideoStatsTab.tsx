/**
 * 영상 통계 탭 — 시청 분석, 강좌별 진도
 * GET /student/video/me/stats/ 엔드포인트 사용.
 */
import { useQuery } from "@tanstack/react-query";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import EmptyState from "@student/layout/EmptyState";
import { StatCard, StatGrid } from "@student/shared/ui/components/StatCard";
import ProgressRing from "@student/shared/ui/components/ProgressRing";
import { fetchVideoStats } from "../api/video.api";

function formatDurationHM(seconds: number): string {
  if (seconds <= 0) return "0분";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}시간 ${m}분`;
  return `${m}분`;
}

export default function VideoStatsTab() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["student-video-stats"],
    queryFn: fetchVideoStats,
    staleTime: 60 * 1000,
  });

  if (isLoading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--stu-space-3)" }}>
        <div className="stu-skel" style={{ height: 88, borderRadius: "var(--stu-radius)" }} />
        <div className="stu-skel" style={{ height: 160, borderRadius: "var(--stu-radius)" }} />
      </div>
    );
  }

  if (!stats || stats.total_videos === 0) {
    return <EmptyState title="시청 기록이 없습니다." description="영상을 시청하면 통계가 표시됩니다." />;
  }

  const lectureData = stats.lectures.map((l) => ({
    name: l.title.length > 8 ? l.title.slice(0, 8) + "\u2026" : l.title,
    fullName: l.title,
    진도: l.progress_pct,
    영상수: l.video_count,
    완료: l.completed_count,
  }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--stu-space-8)" }}>
      {/* 요약 */}
      <div style={{ display: "flex", gap: "var(--stu-space-6)", alignItems: "center" }}>
        <ProgressRing
          percent={stats.completion_rate}
          size={88}
          color={stats.completion_rate >= 70 ? "var(--stu-success)" : stats.completion_rate >= 30 ? "var(--stu-warn)" : "var(--stu-primary)"}
          sublabel="완료율"
        />
        <div style={{ flex: 1 }}>
          <StatGrid>
            <StatCard label="총 영상" value={`${stats.total_videos}개`} />
            <StatCard label="완료" value={`${stats.completed_videos}개`} accent={stats.completed_videos > 0 ? "success" : undefined} />
            <StatCard label="시청시간" value={formatDurationHM(stats.total_watch_duration)} />
          </StatGrid>
        </div>
      </div>

      {/* 전체 시청 진행 바 */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
          <span className="stu-muted">시청 진행률</span>
          <span className="stu-muted">
            {formatDurationHM(stats.total_watch_duration)} / {formatDurationHM(stats.total_content_duration)}
          </span>
        </div>
        <div style={{ borderRadius: "var(--stu-radius)", overflow: "hidden", height: 8, background: "var(--stu-surface-soft)" }}>
          <div style={{
            width: stats.total_content_duration > 0 ? `${Math.min((stats.total_watch_duration / stats.total_content_duration) * 100, 100)}%` : "0%",
            height: "100%",
            background: "var(--stu-primary)",
            transition: "width 0.4s ease",
          }} />
        </div>
      </div>

      {/* 강좌별 진도 */}
      {lectureData.length > 0 && (
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: "var(--stu-space-4)" }}>
            강좌별 진도율
          </div>
          <div style={{ background: "var(--stu-surface-soft)", borderRadius: "var(--stu-radius)", padding: "var(--stu-space-4)" }}>
            <div style={{ width: "100%", height: Math.max(120, lectureData.length * 40) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={lectureData} layout="vertical" margin={{ top: 4, right: 12, bottom: 4, left: 0 }}>
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10, fill: "var(--stu-text-subtle)" }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: "var(--stu-text-muted)" }} axisLine={false} tickLine={false} width={70} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 8, border: "1px solid var(--stu-border)",
                      background: "var(--stu-surface)", fontSize: 13, padding: "6px 10px",
                    }}
                    formatter={(v: number, _name: string, props: any) => {
                      const p = props.payload;
                      return [`${v}% (${p.완료}/${p.영상수}개 완료)`, "진도율"];
                    }}
                    labelFormatter={(_label: string, payload: any[]) => payload?.[0]?.payload?.fullName ?? _label}
                  />
                  <Bar dataKey="진도" radius={[0, 4, 4, 0]} barSize={22}>
                    {lectureData.map((entry, i) => (
                      <Cell
                        key={i}
                        fill={entry.진도 >= 80 ? "var(--stu-success)" : entry.진도 >= 40 ? "var(--stu-primary)" : "var(--stu-warn)"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
