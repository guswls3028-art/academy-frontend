/**
 * 성적 — 시험 성적 / 과제 현황 탭 기반 허브
 * 대형학원 SaaS: 학부모·학생에게 시각적·체계적 성적 정보 제공
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
import {
  IconExam,
  IconChevronRight,
  IconClipboard,
} from "@/student/shared/ui/icons/Icons";

type Tab = "exams" | "homework";

export default function GradesPage() {
  const [tab, setTab] = useState<Tab>("exams");
  const { data, isLoading, isError } = useMyGradesSummary();
  const exams = data?.exams ?? [];
  const homeworks = data?.homeworks ?? [];

  const examStats = useMemo(() => {
    if (exams.length === 0) return null;
    const avgPct =
      exams.reduce(
        (s, e) =>
          s + (e.max_score > 0 ? (e.total_score / e.max_score) * 100 : 0),
        0,
      ) / exams.length;
    const passRate =
      (exams.filter((e) => e.is_pass).length / exams.length) * 100;
    return {
      avgPct: Math.round(avgPct),
      passRate: Math.round(passRate),
      count: exams.length,
    };
  }, [exams]);

  const trendData = useMemo(() => {
    return exams
      .filter((e) => e.submitted_at && e.max_score > 0)
      .sort(
        (a, b) =>
          new Date(a.submitted_at!).getTime() -
          new Date(b.submitted_at!).getTime(),
      )
      .map((e) => ({
        name:
          e.title.length > 6 ? e.title.slice(0, 6) + "\u2026" : e.title,
        득점률: Math.round((e.total_score / e.max_score) * 100),
      }));
  }, [exams]);

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
              <StatCard label="응시 횟수" value={`${examStats.count}회`} />
            </div>
          )}

          {trendData.length >= 2 && (
            <div style={chartWrap}>
              <div style={sectionTitle}>점수 추이</div>
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
                      formatter={(v) => [`${v}%`, "득점률"]}
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
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--stu-space-2)" }}>
                {exams.map((e) => (
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
                          {e.lecture_title && `${e.lecture_title} · `}
                          {fmtScore(e.total_score, e.max_score)}
                        </div>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
                        <GradeBadge passed={e.is_pass} />
                        {e.max_score > 0 && (
                          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--stu-text-muted)" }}>
                            {Math.round((e.total_score / e.max_score) * 100)}%
                          </span>
                        )}
                      </div>
                      <IconChevronRight style={{ width: 18, height: 18, color: "var(--stu-text-muted)", flexShrink: 0 }} />
                    </div>
                  </Link>
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
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--stu-space-2)" }}>
                {homeworks.map((h, idx) => (
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
                          {h.lecture_title && `${h.lecture_title} · `}
                          {h.max_score != null && h.max_score > 0
                            ? `${h.score}/${h.max_score}점`
                            : `${h.score}점`}
                        </div>
                      </div>
                      <GradeBadge passed={h.passed} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </StudentPageShell>
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

function fmtScore(total: number, max: number): string {
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
