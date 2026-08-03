import { useId, useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
  type TooltipValueType,
} from "recharts";
import { Badge, ICON } from "@/shared/ui/ds";
import LectureChip from "@/shared/ui/chips/LectureChip";
import type {
  StudentExamTrendPoint,
  StudentScoreLectureOption,
} from "@/shared/api/contracts/studentGrades";
import {
  ALL_LECTURES,
  filterStudentScoreTrend,
  studentScoreTrendMetricValue,
  summarizeStudentScoreTrend,
  type StudentScoreLectureFilter,
  type StudentScoreTrendDisplayPoint,
  type StudentScoreTrendMetric,
} from "@/shared/scoring/studentScoreTrend";
import { ArrowDownRight, ArrowUpRight, Minus, Route } from "lucide-react";
import styles from "./StudentScoreTrendChart.module.css";

type Props = {
  points: StudentExamTrendPoint[];
  className?: string;
  audience?: "staff" | "learner";
  showLectureFilters?: boolean;
  title?: string;
  description?: string;
  badgeLabel?: string;
  lectureOptions?: StudentScoreLectureOption[];
};

const STAFF_METRIC_OPTIONS: Array<{ value: StudentScoreTrendMetric; label: string }> = [
  { value: "score_pct", label: "득점률" },
  { value: "rank", label: "등수" },
  { value: "percentile", label: "상위 %" },
];

const LEARNER_METRIC_OPTIONS: typeof STAFF_METRIC_OPTIONS = [
  { value: "rank", label: "등수" },
  { value: "percentile", label: "상위 %" },
  { value: "score_pct", label: "득점률" },
];

function lectureOptionLabel(option: StudentScoreLectureOption) {
  const chipLabel = option.chip_label?.trim();
  return chipLabel ? `[${chipLabel}] ${option.title}` : option.title;
}

function formatPct(value: number | null | undefined) {
  if (value == null) return "-";
  return `${Number.isInteger(value) ? value : value.toFixed(1)}%`;
}

function formatScore(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatDate(value: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value.slice(0, 10);
  return parsed.toLocaleDateString("ko-KR", { year: "numeric", month: "short", day: "numeric" });
}

function metricDescription(metric: StudentScoreTrendMetric, audience: "staff" | "learner") {
  if (metric === "rank") {
    return audience === "learner"
      ? "같은 시험 응시자 중 1차 응시 점수 기준 내 등수입니다. 1등에 가까울수록 좋습니다."
      : "같은 시험 응시자 중 1차 응시 점수 기준 등수입니다. 1등에 가까울수록 좋습니다.";
  }
  if (metric === "percentile") {
    return "1차 응시 점수 기준 상위 위치입니다. 시험별 응시 인원이 달라도 비교할 수 있고, 낮을수록 좋습니다.";
  }
  return audience === "learner"
    ? "시험이 추가될 때마다 1회차부터 자동으로 이어집니다. 서로 다른 만점은 득점률로 비교합니다."
    : "점수가 입력된 테스트를 시간순으로 쌓아 득점률로 비교합니다.";
}

function formatMetricValue(
  metric: StudentScoreTrendMetric,
  value: number | null,
  cohortSize?: number | null,
) {
  if (value == null) return "-";
  if (metric === "rank") {
    const rank = Number.isInteger(value) ? value : value.toFixed(1);
    return cohortSize != null ? `${rank}등 / ${cohortSize}명` : `${rank}등`;
  }
  return formatPct(value);
}

function improvementTone(metric: StudentScoreTrendMetric, delta: number | null) {
  if (delta == null || delta === 0) return "flat";
  const improvement = metric === "score_pct" ? delta : -delta;
  return improvement > 0 ? "up" : "down";
}

function formatMetricDelta(metric: StudentScoreTrendMetric, delta: number | null) {
  if (delta == null) return "다음 시험 후";
  if (delta === 0) return "변동 없음";
  if (metric === "score_pct") return `${delta > 0 ? "+" : ""}${delta}%p`;
  const direction = delta < 0 ? "상승" : "하락";
  const magnitude = Math.abs(delta);
  return metric === "rank" ? `${magnitude}등 ${direction}` : `${magnitude}%p ${direction}`;
}

function TrendTooltip({
  active,
  payload,
  metric,
}: TooltipContentProps<TooltipValueType, string | number> & { metric: StudentScoreTrendMetric }) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload as StudentScoreTrendDisplayPoint | undefined;
  if (!point) return null;
  return (
    <div className={styles.tooltip}>
      <div className={styles.tooltipRound}>{point.round_label}</div>
      <strong>{point.title}</strong>
      {metric === "rank" && (
        <span>{formatMetricValue("rank", point.rank ?? null, point.cohort_size)} · 상위 {formatPct(point.percentile)}</span>
      )}
      {metric === "percentile" && (
        <span>상위 {formatPct(point.percentile)} · {formatMetricValue("rank", point.rank ?? null, point.cohort_size)}</span>
      )}
      <span>{formatScore(point.score)} / {formatScore(point.max_score)}점 · 득점률 {formatPct(point.score_pct)}</span>
      <span>{[point.lecture_title, point.session_title, formatDate(point.session_date ?? point.recorded_at)].filter(Boolean).join(" · ")}</span>
      {(point.retake_count ?? 1) > 1 && <span>대표 결과 · 재시험 {(point.retake_count ?? 1) - 1}회</span>}
      {point.archived && <span>보관된 시험</span>}
    </div>
  );
}

export default function StudentScoreTrendChart({
  points,
  className,
  audience = "staff",
  showLectureFilters = true,
  title = "회차별 성적 추이",
  description,
  badgeLabel = "자동 누적",
  lectureOptions: providedLectureOptions = [],
}: Props) {
  const titleId = useId();
  const hasComparativeMetrics = points.some(
    (point) => studentScoreTrendMetricValue(point, "rank") != null
      || studentScoreTrendMetricValue(point, "percentile") != null,
  );
  const [lectureFilter, setLectureFilter] = useState<StudentScoreLectureFilter>(ALL_LECTURES);
  const [metricPreference, setMetricPreference] = useState<StudentScoreTrendMetric>(
    audience === "learner" && hasComparativeMetrics ? "rank" : "score_pct",
  );
  const metricOptions = audience === "learner" ? LEARNER_METRIC_OPTIONS : STAFF_METRIC_OPTIONS;
  const pointLectureOptions = useMemo(() => {
    const map = new Map<number, StudentScoreLectureOption>();
    for (const point of points) {
      if (point.lecture_id == null || !point.lecture_title || map.has(point.lecture_id)) continue;
      map.set(point.lecture_id, {
        id: point.lecture_id,
        title: point.lecture_title,
        color: point.lecture_color,
        chip_label: point.lecture_chip_label,
      });
    }
    return Array.from(map.values());
  }, [points]);
  const lectureOptions = useMemo(() => {
    if (audience !== "learner" || providedLectureOptions.length === 0) {
      return pointLectureOptions;
    }
    const map = new Map<number, StudentScoreLectureOption>();
    for (const option of providedLectureOptions) {
      if (!Number.isFinite(option.id) || !option.title?.trim() || map.has(option.id)) continue;
      map.set(option.id, option);
    }
    for (const option of pointLectureOptions) {
      if (!map.has(option.id)) map.set(option.id, option);
    }
    return Array.from(map.values());
  }, [audience, pointLectureOptions, providedLectureOptions]);
  const selectedLecture = lectureOptions.some((option) => option.id === lectureFilter)
    ? lectureFilter
    : audience === "learner"
      ? lectureOptions[0]?.id ?? ALL_LECTURES
      : ALL_LECTURES;
  const displayPoints = useMemo(
    () => filterStudentScoreTrend(points, selectedLecture),
    [points, selectedLecture],
  );
  const metric = audience === "learner" && !displayPoints.some(
    (point) => studentScoreTrendMetricValue(point, metricPreference) != null,
  )
    ? "score_pct"
    : metricPreference;
  const metrics = useMemo(() => summarizeStudentScoreTrend(displayPoints, metric), [displayPoints, metric]);
  const metricDisplayPoints = useMemo(
    () => displayPoints.flatMap((point) => {
      const metricValue = studentScoreTrendMetricValue(point, metric);
      return metricValue == null ? [] : [{ ...point, metric_value: metricValue }];
    }),
    [displayPoints, metric],
  );
  const latestMetricPoint = metricDisplayPoints[metricDisplayPoints.length - 1];
  const chartWidth = Math.max(320, metricDisplayPoints.length * 72);
  const chartUpperBound = metric === "score_pct"
    ? Math.max(100, Math.ceil((metrics.best ?? 100) / 25) * 25)
    : metric === "rank"
      ? Math.max(2, ...metricDisplayPoints.map((point) => point.cohort_size ?? point.metric_value ?? 1))
      : 100;
  const chartLowerBound = metric === "rank" ? 1 : 0;
  const resolvedDescription = metric === "score_pct" && description
    ? description
    : metricDescription(metric, audience);
  const selectedLectureOption = lectureOptions.find((option) => option.id === selectedLecture);
  const showLectureControl = showLectureFilters && (
    audience === "learner" ? lectureOptions.length > 0 : lectureOptions.length > 1
  );

  return (
    <section
      className={[styles.root, className].filter(Boolean).join(" ")}
      aria-labelledby={titleId}
      data-audience={audience}
      data-testid="student-score-trend"
    >
      <div className={styles.header}>
        <div className={styles.headingGroup}>
          <span className={styles.iconWrap} aria-hidden><Route size={ICON.md} /></span>
          <div>
            <div className={styles.titleRow}>
              <h3 id={titleId}>{title}</h3>
              <Badge size="xs" tone="info">{badgeLabel}</Badge>
            </div>
            <p>
              {resolvedDescription}
            </p>
          </div>
        </div>
        {metrics.firstToLatest != null && (
          <div className={styles.growth} data-tone={improvementTone(metric, metrics.firstToLatest)}>
            <span>첫 회차 대비</span>
            <strong>{formatMetricDelta(metric, metrics.firstToLatest)}</strong>
          </div>
        )}
      </div>

      {(hasComparativeMetrics || showLectureControl) && (
        <div className={styles.controls}>
          {showLectureControl && (
            audience === "learner" ? (
              <label className={styles.lectureSelect}>
                <span>강좌 선택</span>
                <select
                  className="stu-select"
                  aria-label="강좌별 성적 추이"
                  data-testid="student-score-trend-lecture-select"
                  title={selectedLectureOption?.title}
                  value={selectedLecture}
                  onChange={(event) => setLectureFilter(Number(event.target.value))}
                >
                  {lectureOptions.map((option) => (
                    <option key={option.id} value={option.id}>{lectureOptionLabel(option)}</option>
                  ))}
                </select>
              </label>
            ) : (
              <div className={styles.filters} aria-label="강의별 성적 추이">
                <button type="button" aria-pressed={selectedLecture === ALL_LECTURES} data-active={selectedLecture === ALL_LECTURES} onClick={() => setLectureFilter(ALL_LECTURES)}>
                  전체
                </button>
                {lectureOptions.map((option) => (
                  <button key={option.id} type="button" aria-pressed={selectedLecture === option.id} data-active={selectedLecture === option.id} onClick={() => setLectureFilter(option.id)}>
                    <LectureChip lectureName={option.title} color={option.color ?? undefined} chipLabel={option.chip_label} size={20} />
                    <span>{option.title}</span>
                  </button>
                ))}
              </div>
            )
          )}
          {hasComparativeMetrics && (
            <div className={styles.metricSwitch} role="group" aria-label="성적 추이 기준">
              {metricOptions.map((option) => {
                const unavailable = audience === "learner"
                  && option.value !== "score_pct"
                  && !displayPoints.some(
                    (point) => studentScoreTrendMetricValue(point, option.value) != null,
                  );
                return (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={metric === option.value}
                    data-active={metric === option.value}
                    data-testid={`student-score-trend-metric-${option.value}`}
                    disabled={unavailable}
                    title={unavailable ? "이 강좌에는 아직 비교 데이터가 없습니다." : undefined}
                    onClick={() => setMetricPreference(option.value)}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {displayPoints.length === 0 ? (
        <div className={styles.empty}>
          <strong>
            {audience === "learner" && selectedLectureOption
              ? "이 강좌에는 아직 연결할 점수가 없습니다."
              : "아직 연결할 점수가 없습니다."}
          </strong>
          <span>
            {audience === "learner"
              ? "첫 시험 점수가 입력되면 1회차 성적이 이곳에 표시됩니다."
              : "첫 시험 점수가 입력되면 1회차부터 자동으로 표시됩니다."}
          </span>
        </div>
      ) : metricDisplayPoints.length === 0 ? (
        <div className={styles.empty}>
          <strong>비교 가능한 석차가 아직 없습니다.</strong>
          <span>같은 시험에 2명 이상 응시하면 등수와 상위 % 추이가 표시됩니다.</span>
        </div>
      ) : (
        <>
          <div className={styles.metrics}>
            <Metric
              label="최근"
              value={formatMetricValue(metric, metrics.latest, latestMetricPoint?.cohort_size)}
            />
            <Metric label="누적" value={`${metrics.count}회`} />
            <Metric
              label={metric === "rank" ? "평균 등수" : metric === "percentile" ? "평균 위치" : "평균"}
              value={formatMetricValue(metric, metrics.average)}
            />
            <Metric
              label={metric === "rank" ? "최고 등수" : metric === "percentile" ? "최고 위치" : "최고"}
              value={formatMetricValue(metric, metrics.best)}
            />
            <ChangeMetric metric={metric} value={metrics.change} />
          </div>

          <div className={styles.chartScroller}>
            {/* The width grows with round count so long histories scroll instead of compressing labels. */}
            {/* eslint-disable-next-line no-restricted-syntax */}
            <div className={styles.chartPaper} style={{ width: chartWidth }} data-testid="student-score-trend-chart">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={metricDisplayPoints} margin={{ top: 18, right: 24, bottom: 8, left: 2 }} accessibilityLayer>
                  <CartesianGrid stroke="var(--score-grid)" strokeDasharray="2 6" vertical />
                  <XAxis dataKey="round_label" tickLine={false} axisLine={false} interval={0} tick={{ fontSize: 11, fill: "var(--score-text-muted)" }} />
                  <YAxis
                    domain={[chartLowerBound, chartUpperBound]}
                    reversed={metric !== "score_pct"}
                    allowDecimals={metric !== "rank"}
                    width={38}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => metric === "rank" ? `${value}등` : metric === "percentile" ? `${value}%` : `${value}`}
                    tick={{ fontSize: 10, fill: "var(--score-text-muted)" }}
                  />
                  <ReferenceLine y={metrics.average ?? 0} stroke="var(--score-text-muted)" strokeDasharray="5 5" strokeOpacity={0.55} />
                  <Tooltip content={(props) => <TrendTooltip {...props} metric={metric} />} cursor={{ stroke: "var(--score-border-strong)", strokeDasharray: "3 4" }} />
                  <Line
                    type="monotone"
                    dataKey="metric_value"
                    name={metricOptions.find((option) => option.value === metric)?.label}
                    stroke="var(--score-line)"
                    strokeWidth={3}
                    dot={{ r: 5, fill: "var(--score-surface)", stroke: "var(--score-line)", strokeWidth: 3 }}
                    activeDot={{ r: 7, fill: "var(--score-line)", stroke: "var(--score-surface)", strokeWidth: 3 }}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          {metricDisplayPoints.length === 1 && (
            <p className={styles.onePoint}>1회차가 기록되었습니다. 다음 시험부터 변화선이 이어집니다.</p>
          )}
        </>
      )}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.metric}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ChangeMetric({ metric, value }: { metric: StudentScoreTrendMetric; value: number | null }) {
  const tone = improvementTone(metric, value);
  const Icon = tone === "up" ? ArrowUpRight : tone === "down" ? ArrowDownRight : Minus;
  return (
    <div className={styles.metric} data-tone={tone}>
      <span>직전 대비</span>
      <strong><Icon size={ICON.sm} aria-hidden />{formatMetricDelta(metric, value)}</strong>
    </div>
  );
}
