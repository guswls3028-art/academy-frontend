// PATH: src/app_teacher/domains/results/components/ResultsStatsTab.tsx
// 성적 통계 탭 — 강의 → 시험 선택 후 KPI + 차트 + 문항분석 + 학생 석차
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { EmptyState , ICON } from "@/shared/ui/ds";
import LectureChip from "@/shared/ui/chips/LectureChip";
import { cx } from "@/shared/utils/cx";
import StudentNameWithLectureChip from "@/shared/ui/chips/StudentNameWithLectureChip";
import { Card, SectionTitle, KpiCard } from "@teacher/shared/ui/Card";
import { AchievementBadge } from "@teacher/shared/ui/Badge";
import { EmptyActionButton } from "@teacher/shared/ui/EmptyActionButton";
import { fetchLectures } from "@teacher/domains/lectures/api";
import { fetchExams } from "@teacher/domains/exams/api";
import {
  fetchExamSummary,
  fetchQuestionStats,
  fetchExamResults,
  fetchHomeworkScores,
} from "@teacher/domains/results/statsApi";
import {
  getExamResultEnrollmentId,
  getExamResultMaxScore,
  getExamResultScore,
} from "@teacher/domains/results/examResultContract";
import type { TeacherExamResultRow } from "@teacher/domains/scores/api";
import { teacherResultsQueryKeys } from "@teacher/domains/results/queryKeys";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import styles from "./ResultsStatsTab.module.css";

type LectureOption = {
  id: number;
  title: string;
  color?: string | null;
  chip_label?: string | null;
  chipLabel?: string | null;
};

type ExamOption = {
  id: number;
  title: string;
  max_score?: number | null;
};

type HomeworkScore = {
  homework: number;
  score: number | null;
  max_score: number | null;
  passed?: boolean | null;
  meta?: { status?: string } | null;
};

type QuestionStat = {
  question_id: number;
  accuracy?: number | null;
};

export default function ResultsStatsTab() {
  const navigate = useNavigate();
  const [selectedLecture, setSelectedLecture] = useState<number | null>(null);
  const [selectedExam, setSelectedExam] = useState<number | null>(null);

  /* ─── Data fetching ─── */
  const { data: lectures } = useQuery({
    queryKey: teacherResultsQueryKeys.statsLectures,
    queryFn: () => fetchLectures(true),
  });

  const { data: exams } = useQuery({
    queryKey: teacherResultsQueryKeys.statsExams(selectedLecture),
    queryFn: () => fetchExams({ lecture_id: selectedLecture! }),
    enabled: selectedLecture != null,
  });

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: teacherResultsQueryKeys.examSummary(selectedExam),
    queryFn: () => fetchExamSummary(selectedExam!),
    enabled: selectedExam != null,
  });

  const { data: questionStats } = useQuery({
    queryKey: teacherResultsQueryKeys.questionStats(selectedExam),
    queryFn: () => fetchQuestionStats(selectedExam!),
    enabled: selectedExam != null,
  });

  const { data: results } = useQuery({
    queryKey: teacherResultsQueryKeys.statsExamResults(selectedExam),
    queryFn: () => fetchExamResults(selectedExam!),
    enabled: selectedExam != null,
  });

  /* ─── 과제 데이터 ─── */
  const { data: hwScores } = useQuery({
    queryKey: teacherResultsQueryKeys.homeworkScores(selectedLecture),
    queryFn: () => fetchHomeworkScores(selectedLecture!),
    enabled: selectedLecture != null,
  });

  /* ─── Derived ─── */
  const lectureList = (lectures ?? []) as LectureOption[];
  const examList = (exams ?? []) as ExamOption[];
  const homeworkScores = (hwScores ?? []) as HomeworkScore[];
  const questionRows = (questionStats ?? []) as QuestionStat[];
  const resultRows = (results ?? []) as TeacherExamResultRow[];
  const selectedExamObj = examList.find((e) => e.id === selectedExam);
  const selectedLectureObj = lectureList.find((lecture) => lecture.id === selectedLecture);
  // 시험 만점 = exam 객체의 max_score (summary.highest_score는 최고 득점)
  const rawExamMaxScore = selectedExamObj?.max_score;
  const examMaxScore = typeof rawExamMaxScore === "number" && rawExamMaxScore > 0 ? rawExamMaxScore : 100;
  const participantCount = summary?.participant_count ?? 0;
  const isSparse = participantCount > 0 && participantCount < 3;

  // Homework stats (강좌 전체)
  const hwStats = (() => {
    if (!hwScores?.length) return null;
    const scored = homeworkScores.filter((s) => s.score != null && s.meta?.status !== "NOT_SUBMITTED");
    const submitted = scored.length;
    const total = homeworkScores.length;
    const passed = scored.filter((s) => s.passed).length;
    const withMax = scored.filter((s) => s.max_score != null && s.max_score > 0);
    const avgScore = withMax.length > 0
      ? withMax.reduce((sum, s) => sum + (((s.score ?? 0) / (s.max_score ?? 1)) * 100), 0) / withMax.length
      : null;
    const submissionRate = total > 0 ? Math.round((submitted / total) * 100) : 0;
    const passRate = submitted > 0 ? Math.round((passed / submitted) * 100) : 0;
    const uniqueHomeworks = new Set(homeworkScores.map((s) => s.homework)).size;
    return { submitted, total, passed, avgScore, submissionRate, passRate, homeworkCount: uniqueHomeworks };
  })();

  // Question accuracy chart data
  const qChartData = questionRows.map((q, i) => ({
    name: `${i + 1}번`,
    정답률: Math.round((q.accuracy ?? 0) * 100),
    questionId: q.question_id,
  }));

  // 석차 정책: 서버가 계산한 1차 점수 기준 rank를 신뢰한다.
  // 클라이언트에서 final_score(= 재응시로 덮어써진 점수)로 재정렬하면
  // "석차=1차" 정책이 깨진다. rank 필드를 오름차순으로 정렬하고,
  // rank가 없는 행(미응시/미집계)은 뒤로.
  const rankedResults = [...resultRows].sort((a, b) => {
    const ra = typeof a.rank === "number" ? a.rank : Infinity;
    const rb = typeof b.rank === "number" ? b.rank : Infinity;
    if (ra !== rb) return ra - rb;
    // tie-break: 점수 높은 순 (cosmetic — rank가 같으면 점수도 같은 dense_rank)
    return (
      (getExamResultScore(b) ?? 0) -
      (getExamResultScore(a) ?? 0)
    );
  });

  // Score distribution (만점 기준 10등분)
  const distribution = (() => {
    if (!resultRows.length) return [];
    const step = examMaxScore / 10;
    const buckets = Array.from({ length: 10 }, (_, i) => {
      const lo = Math.round(step * i);
      const hi = i === 9 ? examMaxScore : Math.round(step * (i + 1) - 1);
      return { range: lo === hi ? `${lo}` : `${lo}~${hi}`, count: 0, lo };
    });
    for (const r of resultRows) {
      const score = getExamResultScore(r) ?? 0;
      if (score >= examMaxScore) buckets[9].count++;
      else {
        const idx = Math.max(0, Math.min(Math.floor((score / examMaxScore) * 10), 9));
        buckets[idx].count++;
      }
    }
    return buckets.filter((b) => b.count > 0);
  })();

  return (
    <div className="flex flex-col gap-3">
      {/* ── 강의 선택 ── */}
      <div className={cx("flex gap-2 overflow-x-auto pb-1", styles.scrollTabs)}>
        {lectureList.map((l) => (
          <button
            key={l.id}
            onClick={() => {
              setSelectedLecture(l.id);
              setSelectedExam(null);
            }}
            className={cx(
              "shrink-0 flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-full cursor-pointer",
              selectedLecture === l.id ? styles.selectorButtonActive : styles.selectorButton,
            )}
          >
            <LectureChip
              lectureName={l.title}
              color={l.color ?? undefined}
              chipLabel={l.chip_label ?? l.chipLabel ?? undefined}
              size={ICON.xs}
            />
            {l.title}
          </button>
        ))}
      </div>

      {selectedLecture == null && (
        <EmptyState
          scope="panel"
          tone="empty"
          title="강의를 선택하세요"
          description="강의를 선택하면 시험 통계와 과제 제출 현황이 함께 표시됩니다."
          actions={
            <EmptyActionButton variant="secondary" onClick={() => navigate("/teacher/classes")}>
              강의 확인
            </EmptyActionButton>
          }
        />
      )}

      {/* ── 시험 선택 ── */}
      {selectedLecture != null && exams && (
        exams.length > 0 ? (
          <>
            <div className={cx("flex gap-2 overflow-x-auto pb-1", styles.scrollTabs)}>
              {examList.map((e) => (
                <button
                  key={e.id}
                  onClick={() => setSelectedExam(e.id)}
                  className={cx(
                    "shrink-0 text-[12px] font-semibold px-3 py-1.5 rounded-full cursor-pointer",
                    selectedExam === e.id ? styles.selectorButtonActive : styles.selectorButton,
                  )}
                >
                  {e.title}
                </button>
              ))}
            </div>

            {selectedExam == null && (
              <EmptyState
                scope="panel"
                tone="empty"
                title="시험을 선택하세요"
                description="위 시험 칩을 선택하면 응시, 평균, 문항별 리스크를 바로 볼 수 있습니다."
              />
            )}

            {/* ── 통계 본문 ── */}
            {selectedExam != null && (
              summaryLoading ? (
                <div className="flex flex-col gap-3">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className={i === 1 ? styles.skeletonShort : styles.skeletonTall}
                    />
                  ))}
                </div>
              ) : !summary ? (
                <EmptyState
                  scope="panel"
                  tone="empty"
                  title="통계 데이터가 없습니다"
                  description="성적 입력 또는 OMR 채점이 완료되면 이 화면에 운영 지표가 쌓입니다."
                />
              ) : participantCount === 0 ? (
                <EmptyState
                  scope="panel"
                  tone="empty"
                  title="아직 응시한 학생이 없습니다"
                  description="학생 점수를 입력하거나 OMR을 채점하면 통계가 생성됩니다."
                  actions={
                    <EmptyActionButton onClick={() => navigate("/teacher/exams")}>
                      시험 관리
                    </EmptyActionButton>
                  }
                />
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
                    <div className={cx("rounded-lg text-center", styles.sparseNotice)}>
                      응시 인원이 {participantCount}명으로, 통계 해석에 주의가 필요합니다.
                    </div>
                  )}

                  {/* ─ 점수 범위 / 최고·최저 ─ */}
                  <Card>
                    <SectionTitle>점수 분포</SectionTitle>
                    <div className={cx("flex items-center justify-between mt-1 mb-3", styles.scoreRange)}>
                      <span>
                        최저{" "}
                        <strong className={styles.dangerText}>
                          {summary.min_score?.toFixed(0)}
                        </strong>
                      </span>
                      <span>
                        최고{" "}
                        <strong className={styles.successText}>
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
                            formatter={(v: unknown) => [`${v ?? 0}명`, "학생 수"]}
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
                            formatter={(v: unknown) => [`${v ?? 0}%`, "정답률"]}
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
                          <div className={cx("mt-3 rounded-lg", styles.weakQuestions)}>
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
                    <div className={styles.studentCard}>
                      <div className={styles.studentCardHeader}>
                        <SectionTitle>학생별 성적</SectionTitle>
                      </div>
                      <div className={styles.studentList}>
                        {rankedResults.map((r, idx) => (
                          <div
                            key={getExamResultEnrollmentId(r) ?? r.id ?? idx}
                            className={cx("flex justify-between items-center", styles.studentRow)}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span
                                className={cx(
                                  "shrink-0 text-[12px] font-bold",
                                  styles.rank,
                                  typeof r.rank === "number" && r.rank <= 3 && styles.rankTop,
                                )}
                                title="서버 계산 석차(1차 점수 기준)"
                              >
                                {typeof r.rank === "number" ? r.rank : idx + 1}
                              </span>
                              <StudentNameWithLectureChip
                                name={r.student_name ?? r.enrollment_name ?? "이름 없음"}
                                lectures={
                                  selectedLectureObj
                                    ? [{
                                        lectureName: selectedLectureObj.title,
                                        color: selectedLectureObj.color,
                                        chipLabel: selectedLectureObj.chip_label ?? selectedLectureObj.chipLabel,
                                      }]
                                    : undefined
                                }
                                chipSize={18}
                                className={cx("truncate", styles.primaryText)}
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <span
                                className={cx("font-bold text-[14px]", styles.primaryText)}
                              >
                                {getExamResultScore(r) ?? "-"}/{getExamResultMaxScore(r, examMaxScore)}
                              </span>
                              <AchievementBadge
                                passed={r.final_pass ?? r.passed ?? r.is_pass}
                                achievement={r.achievement}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            )}
          </>
        ) : (
          <EmptyState
            scope="panel"
            tone="empty"
            title="이 강의에 시험이 없습니다"
            description="차시에 시험을 추가하면 강의별 성적 통계가 생성됩니다."
            actions={
              <EmptyActionButton onClick={() => navigate("/teacher/exams")}>
                시험 관리
              </EmptyActionButton>
            }
          />
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
              <div className={cx("flex items-center justify-between mb-1", styles.homeworkMeta)}>
                <span>제출 {hwStats.submitted} / 전체 {hwStats.total}</span>
                <span>과제 {hwStats.homeworkCount}건</span>
              </div>
              <div className={styles.submissionProgressStack} aria-label="과제 제출 현황">
                <progress
                  className={styles.submissionProgressBase}
                  max={hwStats.total}
                  value={hwStats.submitted}
                />
                <progress
                  className={styles.submissionProgressPassed}
                  max={hwStats.total}
                  value={hwStats.passed}
                />
              </div>
              <div className={cx("flex items-center gap-4 mt-1", styles.legend)}>
                <span className={styles.legendItem}>
                  <span className={cx(styles.legendDot, styles.legendDotSuccess)} />
                  합격
                </span>
                <span className={styles.legendItem}>
                  <span className={cx(styles.legendDot, styles.legendDotDanger)} />
                  불합격
                </span>
                <span className={styles.legendItem}>
                  <span className={cx(styles.legendDot, styles.legendDotMuted)} />
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
