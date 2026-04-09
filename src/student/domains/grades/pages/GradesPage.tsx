/**
 * 성적 — 시험 성적 / 과제 현황 탭 기반 허브
 * 대형학원 SaaS: 학부모·학생에게 시각적·체계적 성적 정보 제공
 * 강좌별 그룹핑 + 필터 pill 기반 추이 차트
 */
import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import StudentPageShell from "@/student/shared/ui/pages/StudentPageShell";
import EmptyState from "@/student/shared/ui/layout/EmptyState";
import { useMyGradesSummary } from "../hooks/useMyGradesSummary";
import GradeBadge from "../components/GradeBadge";
import type { MyExamGradeSummary, MyHomeworkGradeSummary } from "../api/grades";
import {
  IconExam,
  IconChevronRight,
  IconClipboard,
} from "@/student/shared/ui/icons/Icons";

type Tab = "exams" | "homework";

const UNGROUPED_KEY = "__ungrouped__";
const UNGROUPED_LABEL = "기타 시험";
const UNGROUPED_HW_LABEL = "기타 과제";
const ALL_FILTER = "__all__";

/* ── Grouping helpers ── */

type ExamGroup = {
  key: string;
  label: string;
  exams: MyExamGradeSummary[];
  avgPct: number;
};

type HwGroup = {
  key: string;
  label: string;
  homeworks: MyHomeworkGradeSummary[];
  avgPct: number | null;
};

function groupExams(exams: MyExamGradeSummary[]): ExamGroup[] {
  const map = new Map<string, MyExamGradeSummary[]>();
  for (const e of exams) {
    const key = e.lecture_title ?? UNGROUPED_KEY;
    const arr = map.get(key);
    if (arr) arr.push(e);
    else map.set(key, [e]);
  }

  function calcAvgPct(items: MyExamGradeSummary[]): number {
    // 미응시(total_score=null) 제외하고 평균 계산
    const scored = items.filter((e) => e.total_score != null && e.max_score > 0);
    return scored.length > 0
      ? Math.round(
          scored.reduce((s, e) => s + (e.total_score! / e.max_score) * 100, 0) /
            scored.length,
        )
      : 0;
  }

  const groups: ExamGroup[] = [];
  for (const [key, items] of map) {
    if (key === UNGROUPED_KEY) continue;
    groups.push({ key, label: key, exams: items, avgPct: calcAvgPct(items) });
  }
  // "기타 시험" at bottom
  const ungrouped = map.get(UNGROUPED_KEY);
  if (ungrouped) {
    groups.push({ key: UNGROUPED_KEY, label: UNGROUPED_LABEL, exams: ungrouped, avgPct: calcAvgPct(ungrouped) });
  }
  return groups;
}

function groupHomeworks(homeworks: MyHomeworkGradeSummary[]): HwGroup[] {
  const map = new Map<string, MyHomeworkGradeSummary[]>();
  for (const h of homeworks) {
    const key = h.lecture_title ?? UNGROUPED_KEY;
    const arr = map.get(key);
    if (arr) arr.push(h);
    else map.set(key, [h]);
  }
  const groups: HwGroup[] = [];
  for (const [key, items] of map) {
    if (key === UNGROUPED_KEY) continue;
    const withMax = items.filter((h) => h.max_score != null && h.max_score > 0);
    const avgPct =
      withMax.length > 0
        ? Math.round(
            withMax.reduce((s, h) => s + (h.score / h.max_score!) * 100, 0) /
              withMax.length,
          )
        : null;
    groups.push({ key, label: key, homeworks: items, avgPct });
  }
  const ungrouped = map.get(UNGROUPED_KEY);
  if (ungrouped) {
    const withMax = ungrouped.filter((h) => h.max_score != null && h.max_score > 0);
    const avgPct =
      withMax.length > 0
        ? Math.round(
            withMax.reduce((s, h) => s + (h.score / h.max_score!) * 100, 0) /
              withMax.length,
          )
        : null;
    groups.push({ key: UNGROUPED_KEY, label: UNGROUPED_HW_LABEL, homeworks: ungrouped, avgPct });
  }
  return groups;
}

export default function GradesPage() {
  const [tab, setTab] = useState<Tab>("exams");
  const [lectureFilter, setLectureFilter] = useState<string>(ALL_FILTER);
  const { data, isLoading, isError } = useMyGradesSummary();
  const exams = data?.exams ?? [];
  const homeworks = data?.homeworks ?? [];

  const examGroups = useMemo(() => groupExams(exams), [exams]);
  const hwGroups = useMemo(() => groupHomeworks(homeworks), [homeworks]);

  // Distinct lecture names for filter pills
  const lectureNames = useMemo(() => {
    const names = new Set<string>();
    for (const e of exams) {
      if (e.lecture_title) names.add(e.lecture_title);
    }
    return Array.from(names);
  }, [exams]);

  const examStats = useMemo(() => {
    if (exams.length === 0) return null;
    // 미응시(total_score=null) 제외하고 평균 계산
    const scoredExams = exams.filter((e) => e.total_score != null);
    const avgPct = scoredExams.length > 0
      ? scoredExams.reduce(
          (s, e) =>
            s + (e.max_score > 0 ? ((e.total_score ?? 0) / e.max_score) * 100 : 0),
          0,
        ) / scoredExams.length
      : 0;
    const examsWithCriteria = exams.filter((e) => e.is_pass !== null);
    const passRate = examsWithCriteria.length > 0
      ? (examsWithCriteria.filter((e) => e.is_pass).length / examsWithCriteria.length) * 100
      : 0;
    // 평균 석차 (석차가 있는 시험만)
    const rankedExams = exams.filter((e) => e.rank != null && e.cohort_size != null && e.cohort_size > 1);
    const avgRank = rankedExams.length > 0
      ? Math.round((rankedExams.reduce((s, e) => s + e.rank!, 0) / rankedExams.length) * 10) / 10
      : null;
    return {
      avgPct: Math.round(avgPct),
      passRate: Math.round(passRate),
      count: exams.length,
      avgRank,
    };
  }, [exams]);

  const trendData = useMemo(() => {
    const filtered =
      lectureFilter === ALL_FILTER
        ? exams
        : exams.filter((e) => e.lecture_title === lectureFilter);
    return filtered
      .filter((e) => e.submitted_at && e.max_score > 0 && e.total_score != null)
      .sort(
        (a, b) =>
          new Date(a.submitted_at!).getTime() -
          new Date(b.submitted_at!).getTime(),
      )
      .map((e) => ({
        name:
          e.title.length > 6 ? e.title.slice(0, 6) + "\u2026" : e.title,
        득점률: Math.round(((e.total_score ?? 0) / e.max_score) * 100),
        반평균: e.cohort_avg != null && e.max_score > 0
          ? Math.round((e.cohort_avg / e.max_score) * 100)
          : undefined,
      }));
  }, [exams, lectureFilter]);

  // 반 평균 데이터 존재 여부
  const hasAvgLine = trendData.some((d) => d.반평균 != null);

  const hwStats = useMemo(() => {
    if (homeworks.length === 0) return null;
    const passed = homeworks.filter((h) => h.passed).length;
    const withMax = homeworks.filter((h) => h.max_score != null && h.max_score > 0);
    const avgPct =
      withMax.length > 0
        ? Math.round(
            withMax.reduce((s, h) => s + (h.score / h.max_score!) * 100, 0) /
              withMax.length,
          )
        : null;
    const passRate = Math.round((passed / homeworks.length) * 100);
    return {
      passed,
      failed: homeworks.length - passed,
      total: homeworks.length,
      avgPct,
      passRate,
    };
  }, [homeworks]);

  return (
    <StudentPageShell title="성적">
      {/* ── Tab switcher ── */}
      <div style={tabBar}>
        <TabBtn
          active={tab === "exams"}
          onClick={() => setTab("exams")}
          label={`시험 성적${exams.length > 0 ? ` ${exams.length}` : ""}`}
        />
        <TabBtn
          active={tab === "homework"}
          onClick={() => setTab("homework")}
          label={`과제 현황${homeworks.length > 0 ? ` ${homeworks.length}` : ""}`}
        />
      </div>

      {isLoading && <Skeletons />}
      {isError && (
        <EmptyState
          title="성적을 불러올 수 없습니다."
          description="잠시 후 다시 시도해 주세요."
        />
      )}

      {/* ── 시험 성적 탭 ── */}
      {!isLoading && !isError && tab === "exams" && (
        <div style={stack}>
          {examStats && (
            <div style={statGrid}>
              <StatCard label="평균 점수" value={`${examStats.avgPct}점`} />
              <StatCard label="합격률" value={`${examStats.passRate}%`} />
              {examStats.avgRank != null ? (
                <StatCard label="평균 석차" value={`${examStats.avgRank}등`} />
              ) : (
                <StatCard label="시험 수" value={`${examStats.count}건`} />
              )}
            </div>
          )}

          {trendData.length >= 2 && (
            <div style={chartWrap}>
              <div style={sectionTitle}>점수 추이</div>

              {/* Lecture filter pills — only when 2+ lectures */}
              {lectureNames.length >= 2 && (
                <div style={filterPillWrap}>
                  <FilterPill
                    label="전체"
                    active={lectureFilter === ALL_FILTER}
                    onClick={() => setLectureFilter(ALL_FILTER)}
                  />
                  {lectureNames.map((name) => (
                    <FilterPill
                      key={name}
                      label={name}
                      active={lectureFilter === name}
                      onClick={() => setLectureFilter(name)}
                    />
                  ))}
                </div>
              )}

              <div style={{ width: "100%", height: 160 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={trendData}
                    margin={{ top: 8, right: 12, bottom: 4, left: -16 }}
                  >
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 11, fill: "var(--stu-text-muted)" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      domain={[0, 100]}
                      ticks={[0, 50, 100]}
                      tick={{ fontSize: 10, fill: "var(--stu-text-subtle)" }}
                      axisLine={false}
                      tickLine={false}
                      width={30}
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: 8,
                        border: "1px solid var(--stu-border)",
                        background: "var(--stu-surface)",
                        fontSize: 13,
                        padding: "6px 10px",
                      }}
                      formatter={(v: number, name: string) => [
                        `${v}%`,
                        name === "반평균" ? "반 평균" : "내 득점률",
                      ]}
                    />
                    <Line
                      type="monotone"
                      dataKey="득점률"
                      stroke="var(--stu-primary)"
                      strokeWidth={2.5}
                      dot={{
                        r: 4,
                        fill: "var(--stu-primary)",
                        strokeWidth: 0,
                      }}
                      activeDot={{ r: 6 }}
                    />
                    {hasAvgLine && (
                      <Line
                        type="monotone"
                        dataKey="반평균"
                        stroke="var(--stu-text-muted)"
                        strokeWidth={1.5}
                        strokeDasharray="4 3"
                        dot={false}
                        connectNulls
                      />
                    )}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          <div>
            <div style={sectionTitle}>시험 결과</div>
            {exams.length === 0 ? (
              <EmptyState
                title="시험 결과가 아직 없습니다."
                description="시험 응시 후 채점이 완료되면 여기에 표시됩니다."
              />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--stu-space-6)" }}>
                {examGroups.map((group) => (
                  <LectureExamGroup key={group.key} group={group} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── 과제 현황 탭 ── */}
      {!isLoading && !isError && tab === "homework" && (
        <div style={stack}>
          {hwStats && (
            <div style={statGrid}>
              <StatCard label="채점 완료" value={`${hwStats.total}건`} />
              <StatCard
                label="평균 점수"
                value={hwStats.avgPct != null ? `${hwStats.avgPct}점` : "-"}
              />
              <StatCard
                label="합격률"
                value={`${hwStats.passRate}%`}
                accent={hwStats.passRate >= 70 ? "success" : hwStats.passRate > 0 ? "danger" : undefined}
              />
            </div>
          )}

          {hwStats && hwStats.total > 0 && (
            <div style={{ borderRadius: "var(--stu-radius)", overflow: "hidden", height: 8, background: "var(--stu-surface-soft)", display: "flex" }}>
              <div
                style={{
                  width: `${(hwStats.passed / hwStats.total) * 100}%`,
                  background: "var(--stu-success)",
                  transition: "width 0.4s ease",
                }}
              />
              <div
                style={{
                  width: `${(hwStats.failed / hwStats.total) * 100}%`,
                  background: "var(--stu-danger)",
                  transition: "width 0.4s ease",
                }}
              />
            </div>
          )}

          <div>
            <div style={sectionTitle}>과제 목록</div>
            {homeworks.length === 0 ? (
              <EmptyState
                title="과제 성적이 아직 없습니다."
                description="과제 점수가 입력되면 여기에 표시됩니다."
              />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--stu-space-6)" }}>
                {hwGroups.map((group) => (
                  <LectureHwGroup key={group.key} group={group} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </StudentPageShell>
  );
}

/* ── Lecture Group Components (inline) ── */

function LectureGroupHeader({
  label,
  count,
  avgPct,
}: {
  label: string;
  count: number;
  avgPct: number | null;
}) {
  return (
    <div style={groupHeader}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: "var(--stu-text)" }}>
          {label}
        </div>
        <div className="stu-muted" style={{ fontSize: 12, marginTop: 2 }}>
          {count}건{avgPct != null ? ` · 평균 ${avgPct}점` : ""}
        </div>
      </div>
    </div>
  );
}

function LectureExamGroup({ group }: { group: ExamGroup }) {
  return (
    <div>
      <LectureGroupHeader label={group.label} count={group.exams.length} avgPct={group.avgPct} />
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--stu-space-2)" }}>
        {group.exams.map((e) => (
          <Link
            key={e.exam_id}
            to={`/student/exams/${e.exam_id}/result`}
            className="stu-panel stu-panel--pressable stu-panel--accent"
            style={{ textDecoration: "none", color: "inherit" }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "var(--stu-space-4)" }}>
              <div style={iconWrap}>
                <IconExam style={{ width: 22, height: 22, color: "var(--stu-primary)" }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{e.title}</div>
                <div className="stu-muted" style={{ fontSize: 13, marginTop: 2 }}>
                  {e.session_title && `${e.session_title} · `}
                  {fmtScore(e.total_score, e.max_score)}
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
                <GradeBadge passed={e.is_pass} achievement={e.achievement} />
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  {e.rank != null && e.cohort_size != null && e.cohort_size > 1 && (
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: "1px 6px",
                        borderRadius: 999,
                        background: "var(--stu-tint-primary)",
                        color: "var(--stu-primary)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {e.rank}/{e.cohort_size}등
                    </span>
                  )}
                  {e.total_score != null && e.max_score > 0 && (
                    <span style={{ fontSize: 11, fontWeight: 700, color: "var(--stu-text-muted)" }}>
                      {Math.round((e.total_score / e.max_score) * 100)}%
                    </span>
                  )}
                </div>
              </div>
              <IconChevronRight style={{ width: 18, height: 18, color: "var(--stu-text-muted)", flexShrink: 0 }} />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function LectureHwGroup({ group }: { group: HwGroup }) {
  return (
    <div>
      <LectureGroupHeader label={group.label} count={group.homeworks.length} avgPct={group.avgPct} />
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--stu-space-2)" }}>
        {group.homeworks.map((h, idx) => (
          <div
            key={`${h.homework_id}-${h.lecture_title ?? ""}-${idx}`}
            className="stu-panel stu-panel--accent"
          >
            <div style={{ display: "flex", alignItems: "center", gap: "var(--stu-space-4)" }}>
              <div style={iconWrap}>
                <IconClipboard style={{ width: 22, height: 22, color: "var(--stu-primary)" }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{h.title}</div>
                <div className="stu-muted" style={{ fontSize: 13, marginTop: 2 }}>
                  {h.session_title && `${h.session_title} · `}
                  {h.max_score != null && h.max_score > 0
                    ? `${h.score}/${h.max_score}점`
                    : `${h.score}점`}
                </div>
              </div>
              <GradeBadge passed={h.passed} achievement={h.achievement} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FilterPill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button onClick={onClick} style={active ? filterPillActive : filterPillDefault}>
      {label}
    </button>
  );
}

/* ── Sub-components ── */

function TabBtn({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        padding: "var(--stu-space-5) var(--stu-space-4)",
        background: "transparent",
        border: "none",
        borderBottom: active
          ? "2px solid var(--stu-primary)"
          : "2px solid transparent",
        marginBottom: -2,
        fontWeight: active ? 700 : 500,
        fontSize: 14,
        color: active ? "var(--stu-primary)" : "var(--stu-text-muted)",
        cursor: "pointer",
        transition: "color var(--stu-motion-base), border-color var(--stu-motion-base)",
      }}
    >
      {label}
    </button>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "success" | "danger";
}) {
  const color =
    accent === "success"
      ? "var(--stu-success-text)"
      : accent === "danger"
        ? "var(--stu-danger-text)"
        : "var(--stu-text)";
  return (
    <div
      style={{
        background: "var(--stu-surface-soft)",
        borderRadius: "var(--stu-radius)",
        padding: "var(--stu-space-5)",
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: 20, fontWeight: 900, color }}>{value}</div>
      <div className="stu-muted" style={{ fontSize: 12, marginTop: 2 }}>
        {label}
      </div>
    </div>
  );
}

function Skeletons() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--stu-space-3)" }}>
      <div className="stu-skel" style={{ height: 44, borderRadius: "var(--stu-radius)" }} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "var(--stu-space-4)" }}>
        <div className="stu-skel" style={{ height: 68, borderRadius: "var(--stu-radius)" }} />
        <div className="stu-skel" style={{ height: 68, borderRadius: "var(--stu-radius)" }} />
        <div className="stu-skel" style={{ height: 68, borderRadius: "var(--stu-radius)" }} />
      </div>
      <div className="stu-skel" style={{ height: 160, borderRadius: "var(--stu-radius)" }} />
      <div className="stu-skel" style={{ height: 80, borderRadius: "var(--stu-radius)" }} />
    </div>
  );
}

function fmtScore(total: number | null, max: number): string {
  if (total == null) return "미응시";
  if (max <= 0) return `${total}점`;
  return `${total}/${max}점`;
}

/* ── Style constants ── */

const tabBar: React.CSSProperties = {
  display: "flex",
  gap: 0,
  borderBottom: "2px solid var(--stu-border)",
  marginBottom: "var(--stu-space-8)",
};

const stack: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "var(--stu-space-8)",
};

const statGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, 1fr)",
  gap: "var(--stu-space-4)",
};

const chartWrap: React.CSSProperties = {
  background: "var(--stu-surface-soft)",
  borderRadius: "var(--stu-radius)",
  padding: "var(--stu-space-6)",
};

const sectionTitle: React.CSSProperties = {
  fontWeight: 700,
  fontSize: 14,
  marginBottom: "var(--stu-space-4)",
};

const iconWrap: React.CSSProperties = {
  width: 44,
  height: 44,
  borderRadius: 12,
  background: "var(--stu-surface-soft)",
  display: "grid",
  placeItems: "center",
  flexShrink: 0,
};

const groupHeader: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  padding: "var(--stu-space-4) var(--stu-space-5)",
  marginBottom: "var(--stu-space-2)",
  borderLeft: "4px solid var(--stu-primary)",
  background: "var(--stu-tint-primary)",
  borderRadius: "0 var(--stu-radius-xl) var(--stu-radius-xl) 0",
};

const filterPillWrap: React.CSSProperties = {
  display: "flex",
  gap: "var(--stu-space-2)",
  flexWrap: "wrap",
  marginBottom: "var(--stu-space-4)",
};

const filterPillBase: React.CSSProperties = {
  padding: "var(--stu-space-2) var(--stu-space-4)",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
  border: "1px solid var(--stu-border-subtle)",
  transition: "background var(--stu-motion-base), color var(--stu-motion-base), border-color var(--stu-motion-base)",
  whiteSpace: "nowrap" as const,
};

const filterPillDefault: React.CSSProperties = {
  ...filterPillBase,
  background: "var(--stu-surface)",
  color: "var(--stu-text-muted)",
};

const filterPillActive: React.CSSProperties = {
  ...filterPillBase,
  background: "var(--stu-primary)",
  color: "var(--stu-primary-contrast, #fff)",
  borderColor: "var(--stu-primary)",
};
