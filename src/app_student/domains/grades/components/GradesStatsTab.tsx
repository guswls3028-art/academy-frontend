/**
 * 성적 통계 탭 — StatCard 그리드 + 추이 차트 + 과제 진행바
 * GradesPage에서 추출.
 */
import { useState, useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import EmptyState from "@student/layout/EmptyState";
import { StatCard, StatGrid } from "@student/shared/ui/components/StatCard";
import ProgressRing from "@student/shared/ui/components/ProgressRing";
import type { MyExamGradeSummary, MyHomeworkGradeSummary } from "../api/grades.api";

const ALL_FILTER = "__all__";

type Props = {
  exams: MyExamGradeSummary[];
  homeworks: MyHomeworkGradeSummary[];
};

export default function GradesStatsTab({ exams, homeworks }: Props) {
  const [lectureFilter, setLectureFilter] = useState<string>(ALL_FILTER);

  const examStats = useMemo(() => {
    if (exams.length === 0) return null;
    const scoredExams = exams.filter((e) => e.total_score != null);
    const avgPct = scoredExams.length > 0
      ? scoredExams.reduce((s, e) => s + (e.max_score > 0 ? ((e.total_score ?? 0) / e.max_score) * 100 : 0), 0) / scoredExams.length
      : 0;
    // 합격률 정책: "성취" 기준. achievement가 내려오면 PASS+REMEDIATED를 합격으로,
    // FAIL을 불합격으로 집계. 미응시/미판정은 분모에서 제외.
    // 백엔드가 achievement를 안 내려주는 구서버 환경에선 is_pass로 폴백.
    let passCount = 0;
    let judgedCount = 0;
    for (const e of exams) {
      if (e.achievement) {
        if (e.achievement === "PASS" || e.achievement === "REMEDIATED") {
          passCount += 1;
          judgedCount += 1;
        } else if (e.achievement === "FAIL") {
          judgedCount += 1;
        }
      } else if (e.is_pass !== null) {
        judgedCount += 1;
        if (e.is_pass) passCount += 1;
      }
    }
    const passRate = judgedCount > 0 ? (passCount / judgedCount) * 100 : 0;
    const rankedExams = exams.filter((e) => e.rank != null && e.cohort_size != null && e.cohort_size > 1 && e.meta_status !== "NOT_SUBMITTED");
    const avgRank = rankedExams.length > 0
      ? Math.round((rankedExams.reduce((s, e) => s + e.rank!, 0) / rankedExams.length) * 10) / 10
      : null;
    return { avgPct: Math.round(avgPct), passRate: Math.round(passRate), count: exams.length, avgRank };
  }, [exams]);

  const lectureNames = useMemo(() => {
    const names = new Set<string>();
    for (const e of exams) {
      if (e.lecture_title) names.add(e.lecture_title);
    }
    return Array.from(names);
  }, [exams]);

  const trendData = useMemo(() => {
    const filtered = lectureFilter === ALL_FILTER
      ? exams
      : exams.filter((e) => e.lecture_title === lectureFilter);
    return filtered
      .filter((e) => e.submitted_at && e.max_score > 0 && e.total_score != null)
      .sort((a, b) => new Date(a.submitted_at!).getTime() - new Date(b.submitted_at!).getTime())
      .map((e) => ({
        name: e.title.length > 6 ? e.title.slice(0, 6) + "\u2026" : e.title,
        득점률: Math.round(((e.total_score ?? 0) / e.max_score) * 100),
        전체평균: e.cohort_avg != null && e.max_score > 0
          ? Math.round((e.cohort_avg / e.max_score) * 100)
          : undefined,
      }));
  }, [exams, lectureFilter]);

  const hasAvgLine = trendData.some((d) => d.전체평균 != null);

  const hwStats = useMemo(() => {
    if (homeworks.length === 0) return null;
    const passed = homeworks.filter((h) => h.passed).length;
    const withMax = homeworks.filter((h) => h.max_score != null && h.max_score > 0);
    const avgPct = withMax.length > 0
      ? Math.round(withMax.reduce((s, h) => s + (h.score / h.max_score!) * 100, 0) / withMax.length)
      : null;
    const passRate = Math.round((passed / homeworks.length) * 100);
    return { passed, failed: homeworks.length - passed, total: homeworks.length, avgPct, passRate };
  }, [homeworks]);

  if (exams.length === 0 && homeworks.length === 0) {
    return <EmptyState title="성적 데이터가 없습니다." description="시험이나 과제 결과가 입력되면 통계가 표시됩니다." />;
  }

  return (
    <div style={stack}>
      {/* 시험 통계 요약 */}
      {examStats && (
        <div>
          <div style={sectionTitle}>시험 성적 요약</div>
          <div style={{ display: "flex", gap: "var(--stu-space-6)", alignItems: "center" }}>
            <ProgressRing
              percent={examStats.avgPct}
              size={88}
              color={examStats.avgPct >= 70 ? "var(--stu-success)" : examStats.avgPct >= 40 ? "var(--stu-warn)" : "var(--stu-danger)"}
              sublabel="평균"
            />
            <div style={{ flex: 1 }}>
              <StatGrid>
                <StatCard label="합격률" value={`${examStats.passRate}%`} accent={examStats.passRate >= 70 ? "success" : examStats.passRate > 0 ? "danger" : undefined} />
                <StatCard label="시험 수" value={`${examStats.count}건`} />
                {examStats.avgRank != null
                  ? <StatCard label="평균 등수" value={`${examStats.avgRank}등`} />
                  : <StatCard label="응시완료" value={`${exams.filter((e) => e.total_score != null).length}건`} />
                }
              </StatGrid>
            </div>
          </div>
        </div>
      )}

      {/* 점수 추이 차트 */}
      {trendData.length >= 2 && (
        <div data-guide="grades-chart" style={chartWrap}>
          <div style={sectionTitle}>점수 추이</div>

          {lectureNames.length >= 2 && (
            <div style={filterPillWrap}>
              <FilterPill label="전체" active={lectureFilter === ALL_FILTER} onClick={() => setLectureFilter(ALL_FILTER)} />
              {lectureNames.map((name) => (
                <FilterPill key={name} label={name} active={lectureFilter === name} onClick={() => setLectureFilter(name)} />
              ))}
            </div>
          )}

          <div style={{ width: "100%", height: 160 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData} margin={{ top: 8, right: 12, bottom: 4, left: -16 }}>
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--stu-text-muted)" }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} ticks={[0, 50, 100]} tick={{ fontSize: 10, fill: "var(--stu-text-subtle)" }} axisLine={false} tickLine={false} width={30} />
                <Tooltip
                  contentStyle={{
                    borderRadius: 8, border: "1px solid var(--stu-border)",
                    background: "var(--stu-surface)", fontSize: 13, padding: "6px 10px",
                  }}
                  formatter={(v, name) => [`${v}%`, name === "전체평균" ? "전체 평균" : "내 점수"]}
                />
                <Line type="monotone" dataKey="득점률" stroke="var(--stu-primary)" strokeWidth={2.5}
                  dot={{ r: 4, fill: "var(--stu-primary)", strokeWidth: 0 }} activeDot={{ r: 6 }} />
                {hasAvgLine && (
                  <Line type="monotone" dataKey="전체평균" stroke="var(--stu-text-muted)" strokeWidth={1.5}
                    strokeDasharray="4 3" dot={false} connectNulls />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* 시험 석차 & 위치 요약 */}
      {examStats && (() => {
        const ranked = exams.filter((e) => e.rank != null && e.cohort_size != null && e.cohort_size > 1 && e.meta_status !== "NOT_SUBMITTED");
        if (ranked.length === 0) return null;
        const topQuartile = ranked.filter((e) => e.percentile != null && e.percentile <= 25).length;
        const midRange = ranked.filter((e) => e.percentile != null && e.percentile > 25 && e.percentile <= 75).length;
        const bottom = ranked.length - topQuartile - midRange;
        const bestExam = [...ranked].sort((a, b) => (a.percentile ?? 100) - (b.percentile ?? 100))[0];
        const worstExam = [...ranked].sort((a, b) => (b.percentile ?? 0) - (a.percentile ?? 0))[0];
        return (
          <div>
            <div style={sectionTitle}>내 위치 분석</div>
            <StatGrid>
              <StatCard label="상위권" value={`${topQuartile}회`} accent="success" />
              <StatCard label="중위권" value={`${midRange}회`} />
              <StatCard label="하위권" value={`${bottom}회`} accent={bottom > 0 ? "danger" : undefined} />
            </StatGrid>
            <div style={{ marginTop: "var(--stu-space-4)", fontSize: 13, color: "var(--stu-text-muted)", display: "flex", flexDirection: "column", gap: 4 }}>
              {bestExam && (
                <div>
                  <span style={{ color: "var(--stu-success)", fontWeight: 600 }}>최고 성적</span>{" "}
                  {bestExam.title} — {bestExam.rank}등/{bestExam.cohort_size}명
                </div>
              )}
              {worstExam && worstExam.exam_id !== bestExam?.exam_id && (
                <div>
                  <span style={{ color: "var(--stu-danger)", fontWeight: 600 }}>보완 필요</span>{" "}
                  {worstExam.title} — {worstExam.rank}등/{worstExam.cohort_size}명
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* 강좌별 성적 분석 */}
      {(() => {
        const byLecture = new Map<string, { total: number; pass: number; scores: number[] }>();
        for (const e of exams) {
          if (!e.lecture_title || e.total_score == null) continue;
          const key = e.lecture_title;
          if (!byLecture.has(key)) byLecture.set(key, { total: 0, pass: 0, scores: [] });
          const entry = byLecture.get(key)!;
          entry.total++;
          if (e.is_pass) entry.pass++;
          entry.scores.push(e.max_score > 0 ? (e.total_score / e.max_score) * 100 : 0);
        }
        if (byLecture.size < 2) return null;
        const lectureStats = Array.from(byLecture.entries())
          .map(([name, d]) => ({
            name: name.length > 8 ? name.slice(0, 8) + "\u2026" : name,
            avg: Math.round(d.scores.reduce((s, v) => s + v, 0) / d.scores.length),
            passRate: Math.round((d.pass / d.total) * 100),
          }))
          .sort((a, b) => a.avg - b.avg);
        const weakest = lectureStats[0];
        return weakest && weakest.avg < 70 ? (
          <div style={{ background: "var(--stu-surface-soft)", borderRadius: "var(--stu-radius)", padding: "var(--stu-space-4)" }}>
            <div style={sectionTitle}>약점 강좌</div>
            <div style={{ fontSize: 13, color: "var(--stu-text-muted)" }}>
              <span style={{ color: "var(--stu-danger)", fontWeight: 700 }}>{weakest.name}</span> 강좌의
              평균 득점률이 <strong style={{ color: "var(--stu-danger)" }}>{weakest.avg}%</strong>로 가장 낮습니다.
              {weakest.passRate < 50 && ` 합격률도 ${weakest.passRate}%입니다.`}
            </div>
          </div>
        ) : null;
      })()}

      {/* 과제 현황 통계 */}
      {hwStats && (
        <div>
          <div style={sectionTitle}>과제 현황</div>
          <StatGrid>
            <StatCard label="채점 완료" value={`${hwStats.total}건`} />
            <StatCard label="평균 점수" value={hwStats.avgPct != null ? `${hwStats.avgPct}점` : "-"} />
            <StatCard label="합격률" value={`${hwStats.passRate}%`} accent={hwStats.passRate >= 70 ? "success" : hwStats.passRate > 0 ? "danger" : undefined} />
          </StatGrid>

          {hwStats.total > 0 && (
            <div style={{ marginTop: "var(--stu-space-4)", borderRadius: "var(--stu-radius)", overflow: "hidden", height: 8, background: "var(--stu-surface-soft)", display: "flex" }}>
              <div style={{ width: `${(hwStats.passed / hwStats.total) * 100}%`, background: "var(--stu-success)", transition: "width 0.4s ease" }} />
              <div style={{ width: `${(hwStats.failed / hwStats.total) * 100}%`, background: "var(--stu-danger)", transition: "width 0.4s ease" }} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function FilterPill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={active ? filterPillActive : filterPillDefault}>
      {label}
    </button>
  );
}

/* ── Styles ── */
const stack: React.CSSProperties = { display: "flex", flexDirection: "column", gap: "var(--stu-space-8)" };
const sectionTitle: React.CSSProperties = { fontWeight: 700, fontSize: 14, marginBottom: "var(--stu-space-4)" };
const chartWrap: React.CSSProperties = { background: "var(--stu-surface-soft)", borderRadius: "var(--stu-radius)", padding: "var(--stu-space-6)" };
const filterPillWrap: React.CSSProperties = { display: "flex", gap: "var(--stu-space-2)", flexWrap: "wrap", marginBottom: "var(--stu-space-4)" };
const filterPillBase: React.CSSProperties = {
  padding: "var(--stu-space-2) var(--stu-space-4)", borderRadius: 999, fontSize: 12, fontWeight: 600,
  cursor: "pointer", border: "1px solid var(--stu-border-subtle)",
  transition: "background var(--stu-motion-base), color var(--stu-motion-base), border-color var(--stu-motion-base)",
  whiteSpace: "nowrap" as const,
};
const filterPillDefault: React.CSSProperties = { ...filterPillBase, background: "var(--stu-surface)", color: "var(--stu-text-muted)" };
const filterPillActive: React.CSSProperties = { ...filterPillBase, background: "var(--stu-primary)", color: "var(--stu-primary-contrast, #fff)", borderColor: "var(--stu-primary)" };
