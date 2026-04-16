// PATH: src/app_teacher/domains/results/components/ResultsStatsTab.tsx
// 성적 통계 탭 — 강의 → 시험 선택 후 KPI + 차트 + 문항분석 + 학생 석차
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { EmptyState } from "@/shared/ui/ds";
import LectureChip from "@/shared/ui/chips/LectureChip";
import { Card, SectionTitle, KpiCard } from "@teacher/shared/ui/Card";
import { AchievementBadge } from "@teacher/shared/ui/Badge";
import { fetchLectures, fetchLectureSessions } from "@teacher/domains/lectures/api";
import { fetchExams } from "@teacher/domains/exams/api";
import {
  fetchExamSummary,
  fetchQuestionStats,
  fetchExamResults,
  fetchHomeworkScores,
} from "@teacher/domains/results/statsApi";
import { fetchHomeworks } from "@teacher/domains/exams/api";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

export default function ResultsStatsTab() {
  const [selectedLecture, setSelectedLecture] = useState<number | null>(null);
  const [selectedExam, setSelectedExam] = useState<number | null>(null);

  /* ─── Data fetching ─── */
  const { data: lectures } = useQuery({
    queryKey: ["tc-stats-lectures"],
    queryFn: () => fetchLectures(true),
  });

  const { data: exams } = useQuery({
    queryKey: ["tc-stats-exams", selectedLecture],
    queryFn: () => fetchExams({ lecture_id: selectedLecture! }),
    enabled: selectedLecture != null,
  });

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ["tc-exam-summary", selectedExam],
    queryFn: () => fetchExamSummary(selectedExam!),
    enabled: selectedExam != null,
  });

  const { data: questionStats } = useQuery({
    queryKey: ["tc-question-stats", selectedExam],
    queryFn: () => fetchQuestionStats(selectedExam!),
    enabled: selectedExam != null,
  });

  const { data: results } = useQuery({
    queryKey: ["tc-exam-results", selectedExam],
    queryFn: () => fetchExamResults(selectedExam!),
    enabled: selectedExam != null,
  });

  /* ─── 과제 데이터 ─── */
  const { data: homeworks } = useQuery({
    queryKey: ["tc-stats-homeworks", selectedLecture],
    queryFn: () => fetchHomeworks({ lecture_id: selectedLecture! }),
    enabled: selectedLecture != null,
  });

  const { data: hwScores } = useQuery({
    queryKey: ["tc-hw-scores", selectedLecture],
    queryFn: () => fetchHomeworkScores(selectedLecture!),
    enabled: selectedLecture != null,
  });

  /* ─── Derived ─── */
  const selectedExamObj = exams?.find((e: any) => e.id === selectedExam);
  // 시험 만점 = exam 객체의 max_score (summary.max_score는 "최고 득점"이므로 사용 금지)
  const examMaxScore = selectedExamObj?.max_score ?? 100;
  const participantCount = summary?.participant_count ?? 0;
  const isSparse = participantCount > 0 && participantCount < 3;

  // Homework stats (강좌 전체)
  const hwStats = (() => {
    if (!hwScores?.length) return null;
    const scored = hwScores.filter((s: any) => s.score != null && s.meta?.status !== "NOT_SUBMITTED");
    const submitted = scored.length;
    const total = hwScores.length;
    const passed = scored.filter((s: any) => s.passed).length;
    const withMax = scored.filter((s: any) => s.max_score != null && s.max_score > 0);
    const avgScore = withMax.length > 0
      ? withMax.reduce((sum: number, s: any) => sum + ((s.score / s.max_score) * 100), 0) / withMax.length
      : null;
    const submissionRate = total > 0 ? Math.round((submitted / total) * 100) : 0;
    const passRate = submitted > 0 ? Math.round((passed / submitted) * 100) : 0;
    return { submitted, total, passed, avgScore, submissionRate, passRate, homeworkCount: homeworks?.length ?? 0 };
  })();

  // Question accuracy chart data
  const qChartData = (questionStats ?? []).map((q: any, i: number) => ({
    name: `${i + 1}번`,
    정답률: Math.round((q.accuracy ?? 0) * 100),
    questionId: q.question_id,
  }));

  // Sorted results for ranking
  const rankedResults = [...(results ?? [])].sort(
    (a: any, b: any) =>
      (b.final_score ?? b.exam_score ?? b.total_score ?? 0) -
      (a.final_score ?? a.exam_score ?? a.total_score ?? 0)
  );

  // Score distribution (만점 기준 10등분)
  const distribution = (() => {
    if (!results?.length) return [];
    const step = examMaxScore / 10;
    const buckets = Array.from({ length: 10 }, (_, i) => {
      const lo = Math.round(step * i);
      const hi = i === 9 ? examMaxScore : Math.round(step * (i + 1) - 1);
      return { range: lo === hi ? `${lo}` : `${lo}~${hi}`, count: 0, lo };
    });
    for (const r of results) {
      const score = r.final_score ?? r.exam_score ?? r.total_score ?? 0;
      if (score >= examMaxScore) buckets[9].count++;
      else {
        const idx = Math.min(Math.floor((score / examMaxScore) * 10), 9);
        buckets[idx].count++;
      }
    }
    return buckets.filter((b) => b.count > 0);
  })();

  return (
    <div className="flex flex-col gap-3">
      {/* ── 강의 선택 ── */}
      <div
        className="flex gap-2 overflow-x-auto pb-1"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        {(lectures ?? []).map((l: any) => (
          <button
            key={l.id}
            onClick={() => {
              setSelectedLecture(l.id);
              setSelectedExam(null);
            }}
            className="shrink-0 flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-full cursor-pointer"
            style={{
              border:
                selectedLecture === l.id
                  ? "2px solid var(--tc-primary)"
                  : "1px solid var(--tc-border)",
              background:
                selectedLecture === l.id
                  ? "var(--tc-primary-bg)"
                  : "var(--tc-surface)",
              color:
                selectedLecture === l.id
                  ? "var(--tc-primary)"
                  : "var(--tc-text-secondary)",
            }}
          >
            <LectureChip
              lectureName={l.title}
              color={l.color}
              chipLabel={l.chip_label ?? l.chipLabel}
              size={14}
            />
            {l.title}
          </button>
        ))}
      </div>

      {selectedLecture == null && (
        <EmptyState scope="panel" tone="empty" title="강의를 선택하세요" />
      )}

      {/* ── 시험 선택 ── */}
      {selectedLecture != null && exams && (
        exams.length > 0 ? (
          <>
            <div
              className="flex gap-2 overflow-x-auto pb-1"
              style={{ WebkitOverflowScrolling: "touch" }}
            >
              {exams.map((e: any) => (
                <button
                  key={e.id}
                  onClick={() => setSelectedExam(e.id)}
                  className="shrink-0 text-[12px] font-semibold px-3 py-1.5 rounded-full cursor-pointer"
                  style={{
                    border:
                      selectedExam === e.id
                        ? "2px solid var(--tc-primary)"
                        : "1px solid var(--tc-border)",
                    background:
                      selectedExam === e.id
                        ? "var(--tc-primary-bg)"
                        : "var(--tc-surface)",
                    color:
                      selectedExam === e.id
                        ? "var(--tc-primary)"
                        : "var(--tc-text-secondary)",
                  }}
                >
                  {e.title}
                </button>
              ))}
            </div>

            {selectedExam == null && (
              <EmptyState scope="panel" tone="empty" title="시험을 선택하세요" />
            )}

            {/* ── 통계 본문 ── */}
            {selectedExam != null && (
              summaryLoading ? (
                <div className="flex flex-col gap-3">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      style={{
                        height: i === 1 ? 80 : 160,
                        borderRadius: "var(--tc-radius)",
                        background: "var(--tc-surface-soft)",
                        animation: "pulse 1.5s ease-in-out infinite",
                      }}
                    />
                  ))}
                </div>
              ) : !summary ? (
                <EmptyState scope="panel" tone="empty" title="통계 데이터가 없습니다" />
              ) : participantCount === 0 ? (
                <EmptyState scope="panel" tone="empty" title="아직 응시한 학생이 없습니다" />
              ) : (
                <div className="flex flex-col gap-4">
                  {/* ─ KPI 카드 ─ */}
                  <div className="grid grid-cols-4 gap-2">
                    <KpiCard
                      label="응시"
                      value={`${summary.participant_count}명`}
                    />
                    <KpiCard
                      label="평균"
                      value={summary.avg_score?.toFixed(1) ?? "-"}
                      color={
                        summary.avg_score >= examMaxScore * 0.7
                          ? "var(--tc-success)"
                          : summary.avg_score >= examMaxScore * 0.4
                            ? "var(--tc-warn)"
                            : "var(--tc-danger)"
                      }
                    />
                    <KpiCard
                      label="합격률"
                      value={`${(summary.pass_rate * 100).toFixed(0)}%`}
                      color={
                        summary.pass_rate >= 0.7
                          ? "var(--tc-success)"
                          : summary.pass_rate >= 0.4
                            ? "var(--tc-warn)"
                            : "var(--tc-danger)"
                      }
                    />
                    <KpiCard
                      label="클리닉"
                      value={`${summary.clinic_count}명`}
                      color={
                        summary.clinic_count > 0
                          ? "var(--tc-info)"
                          : "var(--tc-text-muted)"
                      }
                    />
                  </div>

                  {/* ─ 소수 데이터 안내 ─ */}
                  {isSparse && (
                    <div
                      className="rounded-lg text-center"
                      style={{
                        background: "var(--tc-warn-bg)",
                        color: "var(--tc-warn)",
                        fontSize: 13,
                        fontWeight: 600,
                        padding: "var(--tc-space-2) var(--tc-space-3)",
                      }}
                    >
                      응시 인원이 {participantCount}명으로, 통계 해석에 주의가 필요합니다.
                    </div>
                  )}

                  {/* ─ 점수 범위 / 최고·최저 ─ */}
                  <Card>
                    <SectionTitle>점수 분포</SectionTitle>
                    <div
                      className="flex items-center justify-between mt-1 mb-3"
                      style={{ fontSize: 13, color: "var(--tc-text-secondary)" }}
                    >
                      <span>
                        최저{" "}
                        <strong style={{ color: "var(--tc-danger)" }}>
                          {summary.min_score?.toFixed(0)}
                        </strong>
                      </span>
                      <span>
                        최고{" "}
                        <strong style={{ color: "var(--tc-success)" }}>
                          {summary.max_score?.toFixed(0)}
                        </strong>
                      </span>
                    </div>
                    {distribution.length > 0 && (
                      <ResponsiveContainer width="100%" height={Math.max(100, distribution.length * 32)}>
                        <BarChart
                          data={distribution}
                          layout="vertical"
                          margin={{ top: 0, right: 24, bottom: 0, left: 0 }}
                        >
                          <XAxis
                            type="number"
                            tick={{ fontSize: 10, fill: "var(--tc-text-muted)" }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <YAxis
                            type="category"
                            dataKey="range"
                            tick={{ fontSize: 11, fill: "var(--tc-text-secondary)" }}
                            axisLine={false}
                            tickLine={false}
                            width={48}
                          />
                          <Tooltip
                            contentStyle={{
                              borderRadius: 8,
                              border: "1px solid var(--tc-border)",
                              background: "var(--tc-surface)",
                              fontSize: 13,
                              padding: "6px 10px",
                            }}
                            formatter={(v: any) => [`${v}명`, "학생 수"]}
                          />
                          <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={18}>
                            {distribution.map((_, i) => (
                              <Cell
                                key={i}
                                fill="var(--tc-primary)"
                                fillOpacity={0.75}
                              />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </Card>

                  {/* ─ 문항별 정답률 ─ */}
                  {qChartData.length > 0 && (
                    <Card>
                      <SectionTitle>문항별 정답률</SectionTitle>
                      <ResponsiveContainer
                        width="100%"
                        height={Math.max(120, qChartData.length * 28)}
                      >
                        <BarChart
                          data={qChartData}
                          layout="vertical"
                          margin={{ top: 4, right: 24, bottom: 4, left: 0 }}
                        >
                          <XAxis
                            type="number"
                            domain={[0, 100]}
                            tick={{ fontSize: 10, fill: "var(--tc-text-muted)" }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <YAxis
                            type="category"
                            dataKey="name"
                            tick={{ fontSize: 11, fill: "var(--tc-text-secondary)" }}
                            axisLine={false}
                            tickLine={false}
                            width={36}
                          />
                          <Tooltip
                            contentStyle={{
                              borderRadius: 8,
                              border: "1px solid var(--tc-border)",
                              background: "var(--tc-surface)",
                              fontSize: 13,
                              padding: "6px 10px",
                            }}
                            formatter={(v: any) => [`${v}%`, "정답률"]}
                          />
                          <Bar dataKey="정답률" radius={[0, 4, 4, 0]} barSize={16}>
                            {qChartData.map((entry, i) => (
                              <Cell
                                key={i}
                                fill={
                                  entry.정답률 >= 70
                                    ? "var(--tc-success)"
                                    : entry.정답률 >= 40
                                      ? "var(--tc-warn)"
                                      : "var(--tc-danger)"
                                }
                              />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                      {/* 오답률 높은 문항 하이라이트 */}
                      {(() => {
                        const weak = qChartData
                          .filter((q) => q.정답률 < 50)
                          .sort((a, b) => a.정답률 - b.정답률);
                        if (!weak.length) return null;
                        return (
                          <div
                            className="mt-3 rounded-lg"
                            style={{
                              background: "var(--tc-danger-bg)",
                              padding: "var(--tc-space-3)",
                              fontSize: 13,
                              color: "var(--tc-danger)",
                              fontWeight: 600,
                            }}
                          >
                            주의 문항:{" "}
                            {weak
                              .slice(0, 5)
                              .map((q) => `${q.name}(${q.정답률}%)`)
                              .join(", ")}
                          </div>
                        );
                      })()}
                    </Card>
                  )}

                  {/* ─ 학생 석차 ─ */}
                  {rankedResults.length > 0 && (
                    <Card style={{ padding: 0 }}>
                      <div style={{ padding: "var(--tc-space-4) var(--tc-space-4) 0" }}>
                        <SectionTitle>학생별 성적</SectionTitle>
                      </div>
                      <div style={{ maxHeight: 320, overflowY: "auto" }}>
                        {rankedResults.map((r: any, idx: number) => (
                          <div
                            key={r.id ?? idx}
                            className="flex justify-between items-center"
                            style={{
                              padding: "var(--tc-space-3) var(--tc-space-4)",
                              borderBottom: "1px solid var(--tc-border-subtle)",
                              fontSize: 14,
                            }}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span
                                className="shrink-0 text-[12px] font-bold"
                                style={{
                                  width: 24,
                                  textAlign: "center",
                                  color:
                                    idx < 3
                                      ? "var(--tc-primary)"
                                      : "var(--tc-text-muted)",
                                }}
                              >
                                {idx + 1}
                              </span>
                              <span
                                className="truncate"
                                style={{ color: "var(--tc-text)" }}
                              >
                                {r.student_name ??
                                  r.enrollment_name ??
                                  "이름 없음"}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span
                                className="font-bold text-[14px]"
                                style={{ color: "var(--tc-text)" }}
                              >
                                {r.final_score ?? r.exam_score ?? r.total_score ?? "-"}/{examMaxScore}
                              </span>
                              <AchievementBadge
                                passed={r.is_pass}
                                achievement={r.achievement}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </Card>
                  )}
                </div>
              )
            )}
          </>
        ) : (
          <EmptyState scope="panel" tone="empty" title="이 강의에 시험이 없습니다" />
        )
      )}

      {/* ── 과제 현황 (강의 선택 시 항상 표시) ── */}
      {selectedLecture != null && hwStats && (
        <Card>
          <SectionTitle>과제 현황</SectionTitle>
          <div className="grid grid-cols-3 gap-2 mt-2">
            <KpiCard
              label="제출률"
              value={`${hwStats.submissionRate}%`}
              color={
                hwStats.submissionRate >= 80
                  ? "var(--tc-success)"
                  : hwStats.submissionRate >= 50
                    ? "var(--tc-warn)"
                    : "var(--tc-danger)"
              }
            />
            <KpiCard
              label="평균 점수"
              value={hwStats.avgScore != null ? `${hwStats.avgScore.toFixed(0)}점` : "-"}
              color={
                hwStats.avgScore != null && hwStats.avgScore >= 70
                  ? "var(--tc-success)"
                  : hwStats.avgScore != null && hwStats.avgScore >= 40
                    ? "var(--tc-warn)"
                    : "var(--tc-text-muted)"
              }
            />
            <KpiCard
              label="합격률"
              value={`${hwStats.passRate}%`}
              color={
                hwStats.passRate >= 70
                  ? "var(--tc-success)"
                  : hwStats.passRate >= 40
                    ? "var(--tc-warn)"
                    : "var(--tc-danger)"
              }
            />
          </div>

          {/* 진행 바 */}
          {hwStats.total > 0 && (
            <div className="mt-3">
              <div
                className="flex items-center justify-between mb-1"
                style={{ fontSize: 12, color: "var(--tc-text-muted)" }}
              >
                <span>제출 {hwStats.submitted} / 전체 {hwStats.total}</span>
                <span>과제 {hwStats.homeworkCount}건</span>
              </div>
              <div
                className="rounded-full overflow-hidden flex"
                style={{ height: 8, background: "var(--tc-surface-soft)" }}
              >
                <div
                  style={{
                    width: `${(hwStats.passed / hwStats.total) * 100}%`,
                    background: "var(--tc-success)",
                    transition: "width 0.4s ease",
                  }}
                />
                <div
                  style={{
                    width: `${((hwStats.submitted - hwStats.passed) / hwStats.total) * 100}%`,
                    background: "var(--tc-danger)",
                    transition: "width 0.4s ease",
                  }}
                />
              </div>
              <div
                className="flex items-center gap-4 mt-1"
                style={{ fontSize: 11, color: "var(--tc-text-muted)" }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 4, background: "var(--tc-success)" }} />
                  합격
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 4, background: "var(--tc-danger)" }} />
                  불합격
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 4, background: "var(--tc-surface-soft)", border: "1px solid var(--tc-border)" }} />
                  미제출
                </span>
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
