import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  ChevronRight,
  CircleAlert,
  ClipboardCheck,
  ExternalLink,
  FileCheck2,
  FileX2,
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
import { getPresignedUrl } from "@/shared/api/contracts/storage";
import {
  fetchResultsLandingStats,
  type LandingSubmissionSummary,
} from "../api/landingStats";
import {
  fetchStudentPerformanceConsole,
  reviewStudentReportedScore,
  type StudentPerformancePeriod,
  type StudentPerformanceRow,
  type StudentPerformanceSource,
  type StudentPerformanceSourceSummary,
  type StudentReportedScore,
  type StudentScoreBand,
  type StudentTrendDirection,
} from "../api/studentPerformance";
import { adminResultsQueryKeys } from "../queryKeys";
import styles from "./ResultsPerformanceConsole.module.css";

type ScoreBandFilter = "all" | StudentScoreBand;
type TrendFilter = "all" | StudentTrendDirection;
type SortKey = "attention" | "latest_desc" | "change_desc" | "name";

const SOURCE_OPTIONS: Array<{ value: StudentPerformanceSource; label: string; description: string }> = [
  { value: "overall", label: "종합", description: "세 갈래 성적을 함께 봅니다" },
  { value: "academy", label: "학원 시험", description: "수업별 테스트·정기시험" },
  { value: "school", label: "학교 내신", description: "학기별 1·2차 지필평가" },
  { value: "mock", label: "모의고사", description: "교육청·평가원 모의평가" },
];

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

function reportedEffectiveDate(item: StudentReportedScore): string | null {
  if (item.exam_date) return item.exam_date;
  if (item.source_group === "mock" && item.exam_month) {
    return `${item.academic_year}-${String(item.exam_month).padStart(2, "0")}-01`;
  }
  const schoolMonths: Record<string, number> = {
    "1-first": 4,
    "1-second": 7,
    "2-first": 10,
    "2-second": 12,
  };
  const month = schoolMonths[`${item.semester}-${item.exam_round}`];
  return item.source_group === "school" && month
    ? `${item.academic_year}-${String(month).padStart(2, "0")}-01`
    : null;
}

const EMPTY_SOURCE_SUMMARY: StudentPerformanceSourceSummary = {
  scored_count: 0,
  average_score_pct: null,
  latest_score_pct: null,
  change_pct_points: null,
  first_to_latest_pct_points: null,
  best_score_pct: null,
  score_band: "unscored",
  trend_direction: "insufficient",
};

function sourceSummary(
  student: StudentPerformanceRow,
  source: StudentPerformanceSource,
  subject?: string,
): StudentPerformanceSourceSummary {
  if ((source === "school" || source === "mock") && subject) {
    return student.subject_summaries[source]?.[subject] ?? EMPTY_SOURCE_SUMMARY;
  }
  return student.source_summaries[source];
}

function reportedTrendPoints(student: StudentPerformanceRow, source: "school" | "mock", subject: string): StudentExamTrendPoint[] {
  return student.reported_scores
    .filter((item) => item.status === "verified" && item.source_group === source && item.subject === subject && item.score_pct != null)
    .map((item, index) => ({
      round_index: index + 1,
      exam_id: item.id,
      enrollment_id: 0,
      title: `${item.label} · ${item.subject}`,
      score: item.score,
      max_score: item.max_score,
      score_pct: item.score_pct ?? 0,
      recorded_at: reportedEffectiveDate(item),
      session_id: null,
      session_title: item.label,
      session_order: null,
      session_regular_order: null,
      session_date: reportedEffectiveDate(item),
      lecture_id: null,
      lecture_title: item.subject,
      lecture_color: null,
      lecture_chip_label: null,
      retake_count: 1,
      archived: false,
    }));
}

export default function ResultsExplorerPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [source, setSource] = useState<StudentPerformanceSource>("overall");
  const [reportedSubject, setReportedSubject] = useState("");
  const [period, setPeriod] = useState<StudentPerformancePeriod>(180);
  const [lectureId, setLectureId] = useState<number | null>(null);
  const [grade, setGrade] = useState<number | "all">("all");
  const [scoreBand, setScoreBand] = useState<ScoreBandFilter>("all");
  const [trend, setTrend] = useState<TrendFilter>("all");
  const [sort, setSort] = useState<SortKey>("attention");
  const [search, setSearch] = useState("");
  const [studentIdFilter, setStudentIdFilter] = useState<number | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);
  const deferredSearch = useDeferredValue(search);

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
  const reviewMutation = useMutation({
    mutationFn: reviewStudentReportedScore,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-results-student-performance"] });
    },
  });

  useEffect(() => {
    if (source !== "school" && source !== "mock") return;
    const subjects = performanceQuery.data?.filter_options.reported_subjects ?? [];
    if (!subjects.includes(reportedSubject)) {
      setReportedSubject(subjects.includes("수학") ? "수학" : subjects[0] ?? "");
    }
  }, [performanceQuery.data?.filter_options.reported_subjects, reportedSubject, source]);

  const studentOptions = useMemo(
    () => [...(performanceQuery.data?.students ?? [])].sort((a, b) => a.display_name.localeCompare(b.display_name, "ko-KR")),
    [performanceQuery.data?.students],
  );

  useEffect(() => {
    if (studentIdFilter != null && !studentOptions.some((student) => student.student_id === studentIdFilter)) {
      setStudentIdFilter(null);
    }
  }, [studentIdFilter, studentOptions]);

  const filteredStudents = useMemo(() => {
    const keyword = deferredSearch.trim().toLocaleLowerCase("ko-KR");
    const rows = (performanceQuery.data?.students ?? []).filter((student) => {
      const matchesSearch = !keyword || [
        student.display_name,
        student.name,
        student.school,
        ...student.lectures.map((lecture) => lecture.title),
      ].filter(Boolean).some((value) => String(value).toLocaleLowerCase("ko-KR").includes(keyword));
      const metrics = sourceSummary(student, source, reportedSubject);
      return (studentIdFilter == null || student.student_id === studentIdFilter)
        && matchesSearch
        && (grade === "all" || student.grade === grade)
        && (source === "overall" || scoreBand === "all" || metrics.score_band === scoreBand)
        && (source === "overall" || trend === "all" || metrics.trend_direction === trend);
    });
    return [...rows].sort((a, b) => {
      if (source === "overall") {
        return b.pending_reported_score_count - a.pending_reported_score_count
          || a.display_name.localeCompare(b.display_name, "ko-KR");
      }
      if (sort === "name") return a.display_name.localeCompare(b.display_name, "ko-KR");
      const aMetrics = sourceSummary(a, source, reportedSubject);
      const bMetrics = sourceSummary(b, source, reportedSubject);
      if (sort === "latest_desc") return (bMetrics.latest_score_pct ?? -1) - (aMetrics.latest_score_pct ?? -1);
      if (sort === "change_desc") return (bMetrics.change_pct_points ?? -Infinity) - (aMetrics.change_pct_points ?? -Infinity);
      return (aMetrics.latest_score_pct ?? Infinity) - (bMetrics.latest_score_pct ?? Infinity)
        || a.display_name.localeCompare(b.display_name, "ko-KR");
    });
  }, [deferredSearch, grade, performanceQuery.data?.students, reportedSubject, scoreBand, sort, source, studentIdFilter, trend]);

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
    enabled: selectedStudentId != null && source === "academy",
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
  const selectedReportedTrend = useMemo(
    () => selectedStudent && (source === "school" || source === "mock")
      ? reportedTrendPoints(selectedStudent, source, reportedSubject).filter((point) => isWithinPeriod(point, period))
      : [],
    [period, reportedSubject, selectedStudent, source],
  );
  const activeFilterCount = [
    lectureId != null,
    grade !== "all",
    source !== "overall" && scoreBand !== "all",
    source !== "overall" && trend !== "all",
    search.trim() !== "",
    studentIdFilter != null,
  ].filter(Boolean).length;

  function resetFilters() {
    setLectureId(null);
    setGrade("all");
    setScoreBand("all");
    setTrend("all");
    setSearch("");
    setStudentIdFilter(null);
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

      <section className={styles.sourceRail} aria-label="성적 출처" data-guide="results-source">
        {SOURCE_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={source === option.value}
            data-active={source === option.value ? "true" : "false"}
            onClick={() => {
              setSource(option.value);
              if (option.value === "overall") {
                setScoreBand("all");
                setTrend("all");
              }
            }}
          >
            <strong>{option.label}</strong>
            <span>{option.description}</span>
          </button>
        ))}
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
            label="학생"
            value={studentIdFilter == null ? "all" : String(studentIdFilter)}
            onChange={(value) => setStudentIdFilter(value === "all" ? null : Number(value))}
            options={[
              { value: "all", label: "전체 학생" },
              ...studentOptions.map((student) => ({
                value: String(student.student_id),
                label: [student.display_name, student.grade != null ? `${student.grade}학년` : null, student.school].filter(Boolean).join(" · "),
              })),
            ]}
          />
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
          {(source === "school" || source === "mock") && (
            <FilterSelect
              label="과목"
              value={reportedSubject}
              onChange={setReportedSubject}
              options={(performanceQuery.data?.filter_options.reported_subjects ?? []).map((value) => ({ value, label: value }))}
              disabled={(performanceQuery.data?.filter_options.reported_subjects ?? []).length === 0}
            />
          )}
          <FilterSelect label="득점 구간" value={scoreBand} onChange={(value) => setScoreBand(value as ScoreBandFilter)} options={SCORE_BAND_OPTIONS} disabled={source === "overall"} />
          <FilterSelect label="점수 변화" value={trend} onChange={(value) => setTrend(value as TrendFilter)} options={TREND_OPTIONS} disabled={source === "overall"} />
          <FilterSelect label="정렬" value={sort} onChange={(value) => setSort(value as SortKey)} options={SORT_OPTIONS} disabled={source === "overall"} />
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
          <PerformanceSummary students={filteredStudents} source={source} subject={reportedSubject} />
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
                      source={source}
                      subject={reportedSubject}
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
                  source={source}
                  subject={reportedSubject}
                  trend={source === "academy" ? selectedTrend : selectedReportedTrend}
                  exams={selectedExams}
                  isLoading={source === "academy" && gradesQuery.isLoading}
                  isError={source === "academy" && gradesQuery.isError}
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

      <ReportedScoreReviewQueue
        rows={performanceQuery.data?.pending_reported_scores ?? []}
        pendingId={reviewMutation.isPending ? reviewMutation.variables?.scoreId ?? null : null}
        mutationError={reviewMutation.isError}
        onReview={(scoreId, action) => reviewMutation.mutate({ scoreId, action })}
      />

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
  disabled = false,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <label className={styles.selectControl}>
      <span>{label}</span>
      <select aria-label={label} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
}

function PerformanceSummary({
  students,
  source,
  subject,
}: {
  students: StudentPerformanceRow[];
  source: StudentPerformanceSource;
  subject: string;
}) {
  if (source === "overall") {
    const academy = students.filter((student) => student.source_summaries.academy.scored_count > 0).length;
    const school = students.filter((student) => student.source_summaries.school.scored_count > 0).length;
    const mock = students.filter((student) => student.source_summaries.mock.scored_count > 0).length;
    const pending = students.reduce((sum, student) => sum + student.pending_reported_score_count, 0);
    return (
      <section className={styles.summaryRail} aria-label="성적 출처별 기록 현황">
        <SummaryMetric icon={<Users size={ICON.md} />} label="조회 학생" value={`${students.length}명`} note="현재 조건" />
        <SummaryMetric icon={<Activity size={ICON.md} />} label="학원 시험 기록" value={`${academy}명`} note="학원 채점 결과" />
        <SummaryMetric icon={<FileCheck2 size={ICON.md} />} label="학교 내신 확인" value={`${school}명`} note={`확인 대기 ${pending}건`} tone={pending > 0 ? "attention" : undefined} />
        <SummaryMetric icon={<ClipboardCheck size={ICON.md} />} label="모의고사 확인" value={`${mock}명`} note="교육청·평가원" />
      </section>
    );
  }
  const scored = students.filter((student) => sourceSummary(student, source, subject).scored_count > 0);
  const scoreValues = scored.flatMap((student) => {
    const value = sourceSummary(student, source, subject).average_score_pct;
    return value == null ? [] : [value];
  });
  const average = scoreValues.length ? scoreValues.reduce((sum, value) => sum + value, 0) / scoreValues.length : null;
  const low = students.filter((student) => sourceSummary(student, source, subject).score_band === "under_60").length;
  const improving = students.filter((student) => sourceSummary(student, source, subject).trend_direction === "up").length;
  const declining = students.filter((student) => sourceSummary(student, source, subject).trend_direction === "down").length;
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
  source,
  subject,
  onClick,
}: {
  student: StudentPerformanceRow;
  selected: boolean;
  source: StudentPerformanceSource;
  subject: string;
  onClick: () => void;
}) {
  const metrics = sourceSummary(student, source, subject);
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
        <small>{[student.grade != null ? `${student.grade}학년` : null, student.school, source === "academy" ? student.latest_exam_title : null].filter(Boolean).join(" · ") || "시험 기록 없음"}</small>
      </span>
      {source === "overall" ? (
        <span className={styles.sourceMiniMetrics}>
          <span><small>학원</small><strong>{formatPct(student.source_summaries.academy.latest_score_pct)}</strong></span>
          <span><small>내신</small><strong>{Object.keys(student.subject_summaries.school).length}과목</strong></span>
          <span><small>모의</small><strong>{Object.keys(student.subject_summaries.mock).length}과목</strong></span>
        </span>
      ) : (
        <span className={styles.rowMetrics}>
          <span><small>최근</small><strong>{formatPct(metrics.latest_score_pct)}</strong></span>
          <TrendValue value={metrics.change_pct_points} />
          <span><small>누적</small><strong>{metrics.scored_count}회</strong></span>
        </span>
      )}
      {source === "overall" ? (
        <Badge tone={student.pending_reported_score_count > 0 ? "warning" : "muted"} size="xs">
          {student.pending_reported_score_count > 0 ? `확인 ${student.pending_reported_score_count}건` : "출처별"}
        </Badge>
      ) : <ScoreBandBadge band={metrics.score_band} />}
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
  source,
  subject,
  trend,
  exams,
  isLoading,
  isError,
  onRetry,
  onOpenStudent,
}: {
  student: StudentPerformanceRow;
  source: StudentPerformanceSource;
  subject: string;
  trend: StudentExamTrendPoint[];
  exams: StudentExamGrade[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  onOpenStudent: () => void;
}) {
  const sourceLabel = SOURCE_OPTIONS.find((option) => option.value === source)?.label ?? "성적";
  const visibleReportedIds = new Set(trend.map((point) => point.exam_id));
  const reportedRows = source === "school" || source === "mock"
    ? student.reported_scores.filter((item) => item.status === "verified" && item.source_group === source && item.subject === subject && visibleReportedIds.has(item.id))
    : [];
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
          <p>{[student.grade != null ? `${student.grade}학년` : null, student.school, sourceLabel, source === "school" || source === "mock" ? subject : null].filter(Boolean).join(" · ")}</p>
        </div>
        <Button intent="secondary" size="sm" rightIcon={<ChevronRight size={ICON.sm} />} onClick={onOpenStudent}>학생 상세</Button>
      </header>

      {source === "overall" ? (
        <SourceOverview student={student} />
      ) : isLoading ? (
        <EmptyState scope="panel" tone="loading" title="회차별 성적을 불러오는 중…" />
      ) : isError ? (
        <EmptyState scope="panel" tone="error" title="회차별 성적을 불러올 수 없습니다" actions={<Button intent="secondary" size="sm" onClick={onRetry}>다시 시도</Button>} />
      ) : (
        <>
          <StudentScoreTrendChart
            points={trend}
            showLectureFilters={false}
            title={source === "academy" ? "학원 시험 누적 추이" : source === "school" ? "학교 내신 누적 추이" : "모의고사 누적 추이"}
            description={source === "academy"
              ? "학원에서 채점된 테스트를 회차순으로 비교합니다."
              : "학생이 제출하고 선생님이 확인한 성적만 시험 순서대로 비교합니다."}
            badgeLabel={source === "academy" ? "자동 누적" : "확인된 성적"}
          />
          <div className={styles.historyHeader}>
            <div>
              <span className={styles.panelKicker}>시험 기록</span>
              <h4>최근 회차 상세</h4>
            </div>
            <span>총 {trend.length}회</span>
          </div>
          {source === "academy" && exams.length > 0 ? (
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
          ) : source === "academy" ? (
            <div className={styles.historyEmpty}>선택한 조건에 기록된 시험 점수가 없습니다.</div>
          ) : reportedRows.length > 0 ? (
            <ReportedScoreHistory rows={reportedRows} />
          ) : (
            <div className={styles.historyEmpty}>확인 완료된 {source === "school" ? "학교 내신" : "모의고사"} 성적이 없습니다.</div>
          )}
        </>
      )}
    </div>
  );
}

function SourceOverview({ student }: { student: StudentPerformanceRow }) {
  const sources: Array<{ key: "academy" | "school" | "mock"; label: string; note: string }> = [
    { key: "academy", label: "학원 시험", note: "학원 채점 결과" },
    { key: "school", label: "학교 내신", note: "학기별 지필평가" },
    { key: "mock", label: "모의고사", note: "교육청·평가원" },
  ];
  return (
    <div className={styles.sourceOverview}>
      <div className={styles.overviewIntro}>
        <strong>성적을 세 갈래로 나눠 봅니다.</strong>
        <span>시험 성격이 다른 점수를 섞지 않고, 각 출처의 최근값과 흐름을 비교합니다.</span>
      </div>
      <div className={styles.sourceCards}>
        {sources.map((item) => {
          const metrics = student.source_summaries[item.key];
          const subjectCount = item.key === "academy" ? 0 : Object.keys(student.subject_summaries[item.key]).length;
          return (
            <article key={item.key} data-source={item.key}>
              <header><span>{item.label}</span><small>{item.note}</small></header>
              <strong>{item.key === "academy" ? formatPct(metrics.latest_score_pct) : `${subjectCount}과목`}</strong>
              {item.key === "academy" ? (
                <dl>
                  <div><dt>누적</dt><dd>{metrics.scored_count}회</dd></div>
                  <div><dt>평균</dt><dd>{formatPct(metrics.average_score_pct)}</dd></div>
                  <div><dt>직전 대비</dt><dd>{formatPointChange(metrics.change_pct_points)}</dd></div>
                </dl>
              ) : (
                <dl>
                  <div><dt>확인 성적</dt><dd>{metrics.scored_count}건</dd></div>
                  <div><dt>비교 기준</dt><dd>과목별</dd></div>
                  <div><dt>상세</dt><dd>{item.label} 탭</dd></div>
                </dl>
              )}
            </article>
          );
        })}
      </div>
      {student.pending_reported_score_count > 0 && (
        <div className={styles.pendingNotice}><ClipboardCheck size={ICON.sm} aria-hidden /><span>학생이 제출한 성적표 {student.pending_reported_score_count}건이 확인을 기다리고 있습니다.</span></div>
      )}
    </div>
  );
}

function ReportedScoreHistory({ rows }: { rows: StudentReportedScore[] }) {
  const ordered = [...rows].sort((a, b) => (reportedEffectiveDate(b) || "").localeCompare(reportedEffectiveDate(a) || ""));
  return (
    <div className={styles.historyTableWrap}>
      <table className={`${styles.historyTable} ${styles.reportedTable}`}>
        <thead><tr><th>시험</th><th>과목</th><th>점수</th><th>성적 지표</th><th>시험일</th></tr></thead>
        <tbody>
          {ordered.slice(0, 12).map((row) => (
            <tr key={row.id}>
              <td><strong>{row.label}</strong><small>{row.source === "kice_mock" ? "평가원" : row.source === "national_mock" ? "교육청" : "학교"}</small></td>
              <td>{row.subject}</td>
              <td><strong>{formatPct(row.score_pct)}</strong><small>{row.score} / {row.max_score}점</small></td>
              <td>{[
                row.grade_rank ? `${row.grade_rank}등급${row.grade_scale === "five" ? "(5등급제)" : ""}` : null,
                row.achievement_level ? `성취도 ${row.achievement_level}` : null,
                row.subject_average != null ? `평균 ${row.subject_average}` : null,
                row.standard_deviation != null ? `표준편차 ${row.standard_deviation}` : null,
                row.cohort_size != null ? `${row.cohort_size}명` : null,
                row.standard_score != null ? `표준 ${row.standard_score}` : null,
                row.percentile != null ? `백분위 ${row.percentile}` : null,
              ].filter(Boolean).join(" · ") || "—"}</td>
              <td>{formatShortDate(reportedEffectiveDate(row))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ReportedScoreReviewQueue({
  rows,
  pendingId,
  mutationError,
  onReview,
}: {
  rows: StudentReportedScore[];
  pendingId: number | null;
  mutationError: boolean;
  onReview: (scoreId: number, action: "verify" | "reject") => void;
}) {
  const [evidenceError, setEvidenceError] = useState(false);
  const openEvidence = async (row: StudentReportedScore) => {
    setEvidenceError(false);
    try {
      const { url } = await getPresignedUrl(row.evidence_r2_key);
      if (url) window.open(url, "_blank", "noopener");
    } catch {
      setEvidenceError(true);
    }
  };
  return (
    <section className={styles.reviewQueue} aria-labelledby="reported-score-review-title" data-testid="reported-score-review-queue">
      <header className={styles.operationsHeader}>
        <div>
          <span className={styles.panelKicker}>학생 제출 성적표</span>
          <h3 id="reported-score-review-title">원본 확인 후 성적 반영</h3>
          <p>학생이 입력한 값과 성적표 원본이 일치할 때만 승인합니다.</p>
        </div>
        <span className={styles.reviewCount}><ClipboardCheck size={ICON.sm} aria-hidden /><strong>{rows.length}건</strong> 확인 대기</span>
      </header>
      {(mutationError || evidenceError) && (
        <div role="alert" className={styles.reviewError}>
          {evidenceError ? "성적표 원본을 열지 못했습니다. 잠시 후 다시 시도해 주세요." : "성적 반영 상태를 저장하지 못했습니다. 새로고침 후 다시 시도해 주세요."}
        </div>
      )}
      {rows.length === 0 ? (
        <div className={styles.reviewEmpty}><FileCheck2 size={ICON.md} aria-hidden /><strong>확인할 성적표가 없습니다.</strong><span>새 제출이 들어오면 이곳에 자동으로 표시됩니다.</span></div>
      ) : (
        <div className={styles.reviewList}>
          {rows.map((row) => (
            <article key={row.id} className={styles.reviewRow}>
              <div className={styles.reviewStudent}>
                <strong>{row.student_name || "학생"}</strong>
                <span>{[row.grade != null ? `${row.grade}학년` : null, row.school].filter(Boolean).join(" · ") || "학교 정보 없음"}</span>
              </div>
              <div className={styles.reviewExam}>
                <strong>{row.label}</strong>
                <span>{row.subject} · {row.score}/{row.max_score}점 ({formatPct(row.score_pct)})</span>
              </div>
              <div className={styles.reviewIndicators}>
                {row.grade_rank && <span>{row.grade_rank}등급</span>}
                {row.grade_scale && <span>{row.grade_scale === "five" ? "5등급제" : "9등급제"}</span>}
                {row.achievement_level && <span>성취도 {row.achievement_level}</span>}
                {row.subject_average != null && <span>평균 {row.subject_average}</span>}
                {row.standard_score != null && <span>표준 {row.standard_score}</span>}
                {row.percentile != null && <span>백분위 {row.percentile}</span>}
              </div>
              <div className={styles.reviewActions}>
                <Button intent="secondary" size="sm" leftIcon={<ExternalLink size={ICON.xs} />} onClick={() => { void openEvidence(row); }}>원본 보기</Button>
                <Button intent="secondary" size="sm" leftIcon={<FileX2 size={ICON.xs} />} disabled={pendingId === row.id} onClick={() => onReview(row.id, "reject")}>반려</Button>
                <Button intent="primary" size="sm" leftIcon={<FileCheck2 size={ICON.xs} />} loading={pendingId === row.id} onClick={() => onReview(row.id, "verify")}>확인·반영</Button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
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
