import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  ChevronRight,
  CircleAlert,
  Minus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Users,
} from "lucide-react";
import { Badge, Button, EmptyState, ICON } from "@/shared/ui/ds";
import StudentNameWithLectureChip from "@/shared/ui/chips/StudentNameWithLectureChip";
import StudentScoreTrendChart from "@/shared/ui/assessment/StudentScoreTrendChart";
import {
  fetchAdminStudentGrades,
  type StudentExamGrade,
  type StudentExamTrendPoint,
} from "@/shared/api/contracts/studentGrades";
import { adminStudentsQueryKeys } from "@admin/domains/students/queryKeys";
import {
  fetchResultsLandingStats,
  type LandingSubmissionSummary,
} from "../api/landingStats";
import {
  fetchStudentPerformanceConsole,
  type StudentPerformancePeriod,
  type StudentPerformanceRow,
  type StudentScoreBand,
  type StudentTrendDirection,
} from "../api/studentPerformance";
import { adminResultsQueryKeys } from "../queryKeys";
import styles from "./ResultsPerformanceConsole.module.css";

type ScoreBandFilter = "all" | StudentScoreBand;
type TrendFilter = "all" | StudentTrendDirection;
type SortKey = "attention" | "latest_desc" | "change_desc" | "name";

const PERIOD_OPTIONS: Array<{ value: StudentPerformancePeriod; label: string }> = [
  { value: 30, label: "30일" },
  { value: 90, label: "90일" },
  { value: 180, label: "180일" },
  { value: 365, label: "1년" },
  { value: "all", label: "전체" },
];

const SCORE_BAND_OPTIONS: Array<{ value: ScoreBandFilter; label: string }> = [
  { value: "all", label: "전체 득점" },
  { value: "under_60", label: "60% 미만" },
  { value: "60_to_79", label: "60–79%" },
  { value: "80_plus", label: "80% 이상" },
  { value: "unscored", label: "점수 없음" },
];

const TREND_OPTIONS: Array<{ value: TrendFilter; label: string }> = [
  { value: "all", label: "전체 변화" },
  { value: "up", label: "직전보다 상승" },
  { value: "down", label: "직전보다 하락" },
  { value: "flat", label: "변화 없음" },
  { value: "insufficient", label: "비교 전" },
];

const SORT_OPTIONS: Array<{ value: SortKey; label: string }> = [
  { value: "attention", label: "낮은 최근 점수순" },
  { value: "latest_desc", label: "높은 최근 점수순" },
  { value: "change_desc", label: "상승폭 큰 순" },
  { value: "name", label: "이름순" },
];

function formatPct(value: number | null | undefined): string {
  if (value == null) return "—";
  return `${Number.isInteger(value) ? value : value.toFixed(1)}%`;
}

function formatPointChange(value: number | null | undefined): string {
  if (value == null) return "비교 전";
  return `${value > 0 ? "+" : ""}${Number.isInteger(value) ? value : value.toFixed(1)}%p`;
}

function formatShortDate(value: string | null | undefined): string {
  if (!value) return "기록 없음";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value.slice(0, 10);
  return parsed.toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
}

function isWithinPeriod(point: StudentExamTrendPoint, period: StudentPerformancePeriod): boolean {
  if (period === "all") return true;
  const raw = point.recorded_at || point.session_date;
  if (!raw) return true;
  const timestamp = new Date(raw).getTime();
  if (Number.isNaN(timestamp)) return true;
  return timestamp >= Date.now() - period * 24 * 60 * 60 * 1000;
}

export default function ResultsExplorerPage() {
  const navigate = useNavigate();
  const [period, setPeriod] = useState<StudentPerformancePeriod>(180);
  const [lectureId, setLectureId] = useState<number | null>(null);
  const [grade, setGrade] = useState<number | "all">("all");
  const [scoreBand, setScoreBand] = useState<ScoreBandFilter>("all");
  const [trend, setTrend] = useState<TrendFilter>("all");
  const [sort, setSort] = useState<SortKey>("attention");
  const [search, setSearch] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);

  const performanceQuery = useQuery({
    queryKey: adminResultsQueryKeys.studentPerformance(period, lectureId),
    queryFn: () => fetchStudentPerformanceConsole({ period, lectureId }),
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  });
  const operationsQuery = useQuery({
    queryKey: adminResultsQueryKeys.landingStats,
    queryFn: fetchResultsLandingStats,
    staleTime: 60_000,
  });

  const filteredStudents = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase("ko-KR");
    const rows = (performanceQuery.data?.students ?? []).filter((student) => {
      const matchesSearch = !keyword || [
        student.display_name,
        student.name,
        student.school,
        ...student.lectures.map((lecture) => lecture.title),
      ].filter(Boolean).some((value) => String(value).toLocaleLowerCase("ko-KR").includes(keyword));
      return matchesSearch
        && (grade === "all" || student.grade === grade)
        && (scoreBand === "all" || student.score_band === scoreBand)
        && (trend === "all" || student.trend_direction === trend);
    });
    return [...rows].sort((a, b) => {
      if (sort === "name") return a.display_name.localeCompare(b.display_name, "ko-KR");
      if (sort === "latest_desc") return (b.latest_score_pct ?? -1) - (a.latest_score_pct ?? -1);
      if (sort === "change_desc") return (b.change_pct_points ?? -Infinity) - (a.change_pct_points ?? -Infinity);
      return (a.latest_score_pct ?? Infinity) - (b.latest_score_pct ?? Infinity)
        || a.display_name.localeCompare(b.display_name, "ko-KR");
    });
  }, [grade, performanceQuery.data?.students, scoreBand, search, sort, trend]);

  useEffect(() => {
    if (filteredStudents.length === 0) {
      setSelectedStudentId(null);
      return;
    }
    if (!filteredStudents.some((student) => student.student_id === selectedStudentId)) {
      setSelectedStudentId(filteredStudents[0].student_id);
    }
  }, [filteredStudents, selectedStudentId]);

  const selectedStudent = filteredStudents.find((student) => student.student_id === selectedStudentId) ?? null;
  const gradesQuery = useQuery({
    queryKey: adminStudentsQueryKeys.studentGrades(selectedStudentId ?? 0),
    queryFn: () => fetchAdminStudentGrades(selectedStudentId!),
    enabled: selectedStudentId != null,
    staleTime: 30_000,
  });
  const selectedTrend = useMemo(
    () => (gradesQuery.data?.exam_trend ?? []).filter((point) => (
      (lectureId == null || point.lecture_id === lectureId) && isWithinPeriod(point, period)
    )),
    [gradesQuery.data?.exam_trend, lectureId, period],
  );
  const selectedExams = useMemo(() => {
    const visibleExamIds = new Set(selectedTrend.map((point) => point.exam_id));
    return (gradesQuery.data?.exams ?? [])
      .filter((exam) => visibleExamIds.has(exam.exam_id))
      .sort((a, b) => {
        const aDate = a.recorded_at || a.submitted_at || a.session_date || "";
        const bDate = b.recorded_at || b.submitted_at || b.session_date || "";
        return bDate.localeCompare(aDate) || b.exam_id - a.exam_id;
      });
  }, [gradesQuery.data?.exams, selectedTrend]);
  const activeFilterCount = [
    lectureId != null,
    grade !== "all",
    scoreBand !== "all",
    trend !== "all",
    search.trim() !== "",
  ].filter(Boolean).length;

  function resetFilters() {
    setLectureId(null);
    setGrade("all");
    setScoreBand("all");
    setTrend("all");
    setSearch("");
    setSort("attention");
  }

  return (
    <div className={styles.page} data-testid="results-performance-console">
      <section className={styles.consoleHeader} aria-labelledby="performance-console-title">
        <div className={styles.consoleHeading}>
          <span className={styles.eyebrow}>누적 성적 기록부</span>
          <div className={styles.headingLine}>
            <h2 id="performance-console-title">학생의 변화를 회차로 봅니다</h2>
            <Badge tone="teal" size="sm">시험 추가 시 자동 누적</Badge>
          </div>
          <p>최근 점수만 보지 않고 1회차부터 이어진 흐름을 비교해 상담과 보강 대상을 빠르게 찾습니다.</p>
        </div>
        <Button
          intent="secondary"
          size="sm"
          leftIcon={<RefreshCw size={ICON.sm} />}
          loading={performanceQuery.isFetching}
          onClick={() => { void performanceQuery.refetch(); void operationsQuery.refetch(); }}
        >
          새로고침
        </Button>
      </section>

      <section className={styles.filterPanel} aria-label="성적 콘솔 필터" data-guide="results-filter">
        <div className={styles.periodGroup} aria-label="조회 기간">
          {PERIOD_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              data-active={period === option.value ? "true" : "false"}
              aria-pressed={period === option.value}
              onClick={() => setPeriod(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <div className={styles.filterControls}>
          <label className={styles.searchControl}>
            <Search size={ICON.sm} aria-hidden />
            <span className="sr-only">학생 검색</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="학생·학교·강의 검색"
            />
          </label>
          <FilterSelect
            label="강의"
            value={lectureId == null ? "all" : String(lectureId)}
            onChange={(value) => setLectureId(value === "all" ? null : Number(value))}
            options={[
              { value: "all", label: "전체 강의" },
              ...(performanceQuery.data?.filter_options.lectures ?? []).map((lecture) => ({
                value: String(lecture.id),
                label: lecture.is_active ? lecture.title : `${lecture.title} (종료)`,
              })),
            ]}
          />
          <FilterSelect
            label="학년"
            value={String(grade)}
            onChange={(value) => setGrade(value === "all" ? "all" : Number(value))}
            options={[
              { value: "all", label: "전체 학년" },
              ...(performanceQuery.data?.filter_options.grades ?? []).map((value) => ({ value: String(value), label: `${value}학년` })),
            ]}
          />
          <FilterSelect label="득점 구간" value={scoreBand} onChange={(value) => setScoreBand(value as ScoreBandFilter)} options={SCORE_BAND_OPTIONS} />
          <FilterSelect label="점수 변화" value={trend} onChange={(value) => setTrend(value as TrendFilter)} options={TREND_OPTIONS} />
          <FilterSelect label="정렬" value={sort} onChange={(value) => setSort(value as SortKey)} options={SORT_OPTIONS} />
          <button type="button" className={styles.resetButton} onClick={resetFilters} disabled={activeFilterCount === 0}>
            <SlidersHorizontal size={ICON.sm} aria-hidden />
            초기화{activeFilterCount > 0 ? ` ${activeFilterCount}` : ""}
          </button>
        </div>
      </section>

      {performanceQuery.isLoading ? (
        <EmptyState scope="panel" tone="loading" title="누적 성적을 정리하는 중…" />
      ) : performanceQuery.isError ? (
        <EmptyState
          scope="panel"
          tone="error"
          title="학생별 성적을 불러올 수 없습니다"
          description="잠시 후 다시 시도해 주세요."
          actions={<Button intent="secondary" onClick={() => performanceQuery.refetch()}>다시 시도</Button>}
        />
      ) : (
        <>
          <PerformanceSummary students={filteredStudents} />
          <div className={styles.workspace}>
            <section className={styles.rosterPanel} aria-labelledby="roster-title">
              <div className={styles.panelHeader}>
                <div>
                  <span className={styles.panelKicker}>학생 목록</span>
                  <h3 id="roster-title">조건에 맞는 {filteredStudents.length}명</h3>
                </div>
                <span className={styles.liveNote}>1분마다 갱신</span>
              </div>
              {filteredStudents.length === 0 ? (
                <EmptyState
                  scope="panel"
                  tone="empty"
                  title="조건에 맞는 학생이 없습니다"
                  description="필터를 초기화하거나 다른 조건을 선택해 주세요."
                  actions={<Button intent="secondary" size="sm" onClick={resetFilters}>필터 초기화</Button>}
                />
              ) : (
                <div className={styles.rosterList} data-testid="performance-student-list">
                  {filteredStudents.map((student) => (
                    <StudentPerformanceButton
                      key={student.student_id}
                      student={student}
                      selected={student.student_id === selectedStudentId}
                      onClick={() => setSelectedStudentId(student.student_id)}
                    />
                  ))}
                </div>
              )}
            </section>

            <section className={styles.detailPanel} aria-live="polite">
              {selectedStudent ? (
                <StudentPerformanceDetail
                  student={selectedStudent}
                  trend={selectedTrend}
                  exams={selectedExams}
                  isLoading={gradesQuery.isLoading}
                  isError={gradesQuery.isError}
                  onRetry={() => { void gradesQuery.refetch(); }}
                  onOpenStudent={() => navigate(`/admin/students/${selectedStudent.student_id}`)}
                />
              ) : (
                <EmptyState scope="panel" tone="empty" title="학생을 선택해 주세요" description="왼쪽 학생 목록에서 누적 추이를 확인할 학생을 선택합니다." />
              )}
            </section>
          </div>
        </>
      )}

      <GradingOperations
        data={operationsQuery.data}
        isLoading={operationsQuery.isLoading}
        isError={operationsQuery.isError}
        onNavigate={navigate}
      />
    </div>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <label className={styles.selectControl}>
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
}

function PerformanceSummary({ students }: { students: StudentPerformanceRow[] }) {
  const scored = students.filter((student) => student.scored_count > 0);
  const scoreValues = scored.flatMap((student) => student.average_score_pct == null ? [] : [student.average_score_pct]);
  const average = scoreValues.length ? scoreValues.reduce((sum, value) => sum + value, 0) / scoreValues.length : null;
  const low = students.filter((student) => student.score_band === "under_60").length;
  const improving = students.filter((student) => student.trend_direction === "up").length;
  const declining = students.filter((student) => student.trend_direction === "down").length;
  return (
    <section className={styles.summaryRail} aria-label="필터 결과 요약">
      <SummaryMetric icon={<Users size={ICON.md} />} label="조회 학생" value={`${students.length}명`} note={`점수 기록 ${scored.length}명`} />
      <SummaryMetric icon={<Activity size={ICON.md} />} label="학생 평균" value={formatPct(average)} note="학생별 평균의 평균" />
      <SummaryMetric icon={<CircleAlert size={ICON.md} />} label="최근 60% 미만" value={`${low}명`} note="득점률 기준" tone={low > 0 ? "attention" : undefined} />
      <SummaryMetric icon={<ArrowUpRight size={ICON.md} />} label="직전보다 상승" value={`${improving}명`} note={`하락 ${declining}명`} tone="positive" />
    </section>
  );
}

function SummaryMetric({
  icon,
  label,
  value,
  note,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  note: string;
  tone?: "attention" | "positive";
}) {
  return (
    <div className={styles.summaryMetric} data-tone={tone}>
      <span className={styles.summaryIcon}>{icon}</span>
      <span><small>{label}</small><strong>{value}</strong></span>
      <em>{note}</em>
    </div>
  );
}

function StudentPerformanceButton({
  student,
  selected,
  onClick,
}: {
  student: StudentPerformanceRow;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" className={styles.studentRow} data-selected={selected ? "true" : "false"} onClick={onClick}>
      <span className={styles.studentIdentity}>
        <StudentNameWithLectureChip
          name={student.display_name}
          avatarSize={28}
          chipSize={18}
          maxLectureChips={2}
          density="compact"
          lectures={student.lectures.map((lecture) => ({
            lectureName: lecture.title,
            color: lecture.color,
            chipLabel: lecture.chip_label,
          }))}
        />
        <small>{[student.grade != null ? `${student.grade}학년` : null, student.school, student.latest_exam_title].filter(Boolean).join(" · ") || "시험 기록 없음"}</small>
      </span>
      <span className={styles.rowMetrics}>
        <span><small>최근</small><strong>{formatPct(student.latest_score_pct)}</strong></span>
        <TrendValue value={student.change_pct_points} />
        <span><small>누적</small><strong>{student.scored_count}회</strong></span>
      </span>
      <ScoreBandBadge band={student.score_band} />
      <ChevronRight size={ICON.sm} className={styles.rowChevron} aria-hidden />
    </button>
  );
}

function TrendValue({ value }: { value: number | null }) {
  const tone = value == null || value === 0 ? "flat" : value > 0 ? "up" : "down";
  const Icon = tone === "up" ? ArrowUpRight : tone === "down" ? ArrowDownRight : Minus;
  return (
    <span className={styles.trendValue} data-tone={tone}>
      <small>직전 대비</small>
      <strong><Icon size={ICON.xs} aria-hidden />{formatPointChange(value)}</strong>
    </span>
  );
}

function ScoreBandBadge({ band }: { band: StudentScoreBand }) {
  const map = {
    under_60: { label: "60% 미만", tone: "danger" as const },
    "60_to_79": { label: "60–79%", tone: "warning" as const },
    "80_plus": { label: "80% 이상", tone: "success" as const },
    unscored: { label: "점수 없음", tone: "muted" as const },
  };
  const item = map[band];
  return <Badge tone={item.tone} size="xs">{item.label}</Badge>;
}

function StudentPerformanceDetail({
  student,
  trend,
  exams,
  isLoading,
  isError,
  onRetry,
  onOpenStudent,
}: {
  student: StudentPerformanceRow;
  trend: StudentExamTrendPoint[];
  exams: StudentExamGrade[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  onOpenStudent: () => void;
}) {
  return (
    <div className={styles.detailContent} data-testid="performance-student-detail">
      <header className={styles.studentHeader}>
        <div>
          <span className={styles.panelKicker}>선택 학생</span>
          <StudentNameWithLectureChip
            name={student.display_name}
            avatarSize={32}
            chipSize={20}
            lectures={student.lectures.map((lecture) => ({ lectureName: lecture.title, color: lecture.color, chipLabel: lecture.chip_label }))}
          />
          <p>{[student.grade != null ? `${student.grade}학년` : null, student.school, `마지막 기록 ${formatShortDate(student.last_recorded_at)}`].filter(Boolean).join(" · ")}</p>
        </div>
        <Button intent="secondary" size="sm" rightIcon={<ChevronRight size={ICON.sm} />} onClick={onOpenStudent}>학생 상세</Button>
      </header>

      {isLoading ? (
        <EmptyState scope="panel" tone="loading" title="회차별 성적을 불러오는 중…" />
      ) : isError ? (
        <EmptyState scope="panel" tone="error" title="회차별 성적을 불러올 수 없습니다" actions={<Button intent="secondary" size="sm" onClick={onRetry}>다시 시도</Button>} />
      ) : (
        <>
          <StudentScoreTrendChart points={trend} showLectureFilters={false} />
          <div className={styles.historyHeader}>
            <div>
              <span className={styles.panelKicker}>시험 기록</span>
              <h4>최근 회차 상세</h4>
            </div>
            <span>총 {trend.length}회</span>
          </div>
          {exams.length > 0 ? (
            <div className={styles.historyTableWrap}>
              <table className={styles.historyTable}>
                <thead><tr><th>회차</th><th>시험</th><th>점수</th><th>수업</th><th>기록일</th></tr></thead>
                <tbody>
                  {exams.slice(0, 8).map((exam) => {
                    const pointIndex = trend.findIndex((point) => point.exam_id === exam.exam_id);
                    const point = pointIndex >= 0 ? trend[pointIndex] : null;
                    return (
                      <tr key={exam.exam_id}>
                        <td>{pointIndex >= 0 ? `${pointIndex + 1}회차` : "—"}</td>
                        <td><strong>{exam.title}</strong>{exam.archived && <small>보관된 시험</small>}</td>
                        <td><strong>{point ? formatPct(point.score_pct) : "—"}</strong><small>{exam.total_score ?? "—"} / {exam.max_score ?? "—"}점</small></td>
                        <td>{exam.session_title || exam.lecture_title || "—"}</td>
                        <td>{formatShortDate(exam.recorded_at || exam.submitted_at || exam.session_date)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className={styles.historyEmpty}>선택한 조건에 기록된 시험 점수가 없습니다.</div>
          )}
        </>
      )}
    </div>
  );
}

function GradingOperations({
  data,
  isLoading,
  isError,
  onNavigate,
}: {
  data: Awaited<ReturnType<typeof fetchResultsLandingStats>> | undefined;
  isLoading: boolean;
  isError: boolean;
  onNavigate: (path: string) => void;
}) {
  const pending = data?.pending_top ?? [];
  const done = data?.recent_done_top ?? [];
  return (
    <section className={styles.operations} aria-labelledby="grading-operations-title">
      <div className={styles.operationsHeader}>
        <div>
          <span className={styles.panelKicker}>채점 흐름</span>
          <h3 id="grading-operations-title">성적에 반영할 작업</h3>
          <p>누적 그래프에 들어가기 전, 확인이 필요한 제출을 처리합니다.</p>
        </div>
        <div className={styles.operationCounts}>
          <span><small>채점 대기</small><strong>{isLoading ? "…" : isError ? "—" : `${data?.pending_submissions ?? 0}건`}</strong></span>
          <span><small>최근 7일 완료</small><strong>{isLoading ? "…" : isError ? "—" : `${data?.done_last_7d ?? 0}건`}</strong></span>
          <Button intent="secondary" size="sm" onClick={() => onNavigate("/admin/results/submissions")}>제출함 열기</Button>
        </div>
      </div>
      <div className={styles.operationGrid}>
        <OperationList title="채점 대기" empty="대기 중인 제출이 없습니다." rows={pending} action="채점하기" onNavigate={onNavigate} />
        <OperationList title="최근 채점 완료" empty="최근 완료된 채점이 없습니다." rows={done} action="결과 보기" onNavigate={onNavigate} />
      </div>
    </section>
  );
}

function OperationList({
  title,
  empty,
  rows,
  action,
  onNavigate,
}: {
  title: string;
  empty: string;
  rows: LandingSubmissionSummary[];
  action: string;
  onNavigate: (path: string) => void;
}) {
  return (
    <div className={styles.operationList}>
      <h4>{title}</h4>
      {rows.length === 0 ? <p>{empty}</p> : rows.slice(0, 4).map((submission) => (
        <button
          type="button"
          key={submission.id}
          onClick={() => {
            if (action === "결과 보기" && submission.target_type === "exam" && submission.lecture_id && submission.session_id) {
              onNavigate(`/admin/lectures/${submission.lecture_id}/sessions/${submission.session_id}/scores`);
              return;
            }
            onNavigate("/admin/results/submissions");
          }}
        >
          <span>
            <strong>{submission.target_title || `원본 없음 · 제출 #${submission.id}`}</strong>
            <StudentNameWithLectureChip
              name={submission.student_name || "학생 미식별"}
              avatarSize={20}
              chipSize={16}
              density="compact"
              lectures={submission.lecture_title ? [{ lectureName: submission.lecture_title }] : []}
            />
          </span>
          <em>{action}<ChevronRight size={ICON.xs} aria-hidden /></em>
        </button>
      ))}
    </div>
  );
}
