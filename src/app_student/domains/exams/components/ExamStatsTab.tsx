/**
 * 시험 통계 탭 — grades API에서 시험 성적 데이터를 가져와 분석
 */
import { useMemo } from "react";
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
import { useMyGradesSummary } from "@student/domains/grades/hooks/useMyGradesSummary";

export default function ExamStatsTab() {
  const { data, isLoading } = useMyGradesSummary();
  const exams = data?.exams ?? [];

  const stats = useMemo(() => {
    if (exams.length === 0) return null;

    const total = exams.length;
    const submitted = exams.filter((e) => e.total_score != null);
    const notSubmitted = total - submitted.length;
    const scored = submitted.filter((e) => e.max_score > 0);

    const avgPct = scored.length > 0
      ? Math.round(scored.reduce((s, e) => s + ((e.total_score ?? 0) / e.max_score) * 100, 0) / scored.length)
      : 0;

    const withCriteria = exams.filter((e) => e.is_pass !== null);
    const passRate = withCriteria.length > 0
      ? Math.round((withCriteria.filter((e) => e.is_pass).length / withCriteria.length) * 100)
      : 0;

    return { total, submitted: submitted.length, notSubmitted, avgPct, passRate };
  }, [exams]);

  // 강좌별 평균 점수
  const lectureStats = useMemo(() => {
    const map = new Map<string, { total: number; count: number }>();
    for (const e of exams) {
      if (e.total_score == null || e.max_score <= 0) continue;
      const key = e.lecture_title ?? "기타";
      const entry = map.get(key) ?? { total: 0, count: 0 };
      entry.total += (e.total_score / e.max_score) * 100;
      entry.count += 1;
      map.set(key, entry);
    }
    return Array.from(map.entries())
      .map(([name, { total, count }]) => ({
        name: name.length > 6 ? name.slice(0, 6) + "\u2026" : name,
        fullName: name,
        평균: Math.round(total / count),
      }))
      .sort((a, b) => b.평균 - a.평균);
  }, [exams]);

  if (isLoading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--stu-space-3)" }}>
        <div className="stu-skel" style={{ height: 88, borderRadius: "var(--stu-radius)" }} />
        <div className="stu-skel" style={{ height: 160, borderRadius: "var(--stu-radius)" }} />
      </div>
    );
  }

  if (!stats) {
    return <EmptyState title="시험 데이터가 없습니다." description="시험을 응시하면 통계가 표시됩니다." />;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--stu-space-8)" }}>
      {/* 요약 */}
      <div style={{ display: "flex", gap: "var(--stu-space-6)", alignItems: "center" }}>
        <ProgressRing
          percent={stats.avgPct}
          size={88}
          color={stats.avgPct >= 70 ? "var(--stu-success)" : stats.avgPct >= 40 ? "var(--stu-warn)" : "var(--stu-danger)"}
          sublabel="평균 득점"
        />
        <div style={{ flex: 1 }}>
          <StatGrid>
            <StatCard label="총 시험" value={`${stats.total}건`} />
            <StatCard label="응시완료" value={`${stats.submitted}건`} />
            <StatCard label="합격률" value={`${stats.passRate}%`}
              accent={stats.passRate >= 70 ? "success" : stats.passRate > 0 ? "danger" : undefined} />
          </StatGrid>
        </div>
      </div>

      {/* 강좌별 성적 비교 */}
      {lectureStats.length >= 2 && (
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: "var(--stu-space-4)" }}>
            강좌별 평균 득점률
          </div>
          <div style={{ background: "var(--stu-surface-soft)", borderRadius: "var(--stu-radius)", padding: "var(--stu-space-4)" }}>
            <div style={{ width: "100%", height: Math.max(120, lectureStats.length * 36) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={lectureStats} layout="vertical" margin={{ top: 4, right: 12, bottom: 4, left: 0 }}>
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10, fill: "var(--stu-text-subtle)" }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: "var(--stu-text-muted)" }} axisLine={false} tickLine={false} width={60} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 8, border: "1px solid var(--stu-border)",
                      background: "var(--stu-surface)", fontSize: 13, padding: "6px 10px",
                    }}
                    formatter={(v) => [`${v}%`, "평균 득점률"]}
                    labelFormatter={(label, payload) => {
                      const first = payload?.[0] as { payload?: { fullName?: string } } | undefined;
                      return first?.payload?.fullName ?? label;
                    }}
                  />
                  <Bar dataKey="평균" radius={[0, 4, 4, 0]} barSize={20}>
                    {lectureStats.map((entry, i) => (
                      <Cell
                        key={i}
                        fill={entry.평균 >= 70 ? "var(--stu-success)" : entry.평균 >= 40 ? "var(--stu-warn)" : "var(--stu-danger)"}
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
