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
import type { StudentExamTrendPoint } from "@/shared/api/contracts/studentGrades";
import {
  ALL_LECTURES,
  filterStudentScoreTrend,
  summarizeStudentScoreTrend,
  type StudentScoreLectureFilter,
  type StudentScoreTrendDisplayPoint,
} from "@/shared/scoring/studentScoreTrend";
import { ArrowDownRight, ArrowUpRight, Minus, Route } from "lucide-react";
import styles from "./StudentScoreTrendChart.module.css";

type Props = {
  points: StudentExamTrendPoint[];
  className?: string;
};

type LectureOption = {
  id: number;
  title: string;
  color: string | null;
  chipLabel: string | null;
};

function formatPct(value: number | null) {
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

function ScoreTooltip({ active, payload }: TooltipContentProps<TooltipValueType, string | number>) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload as StudentScoreTrendDisplayPoint | undefined;
  if (!point) return null;
  return (
    <div className={styles.tooltip}>
      <div className={styles.tooltipRound}>{point.round_label}</div>
      <strong>{point.title}</strong>
      <span>{formatScore(point.score)} / {formatScore(point.max_score)}점 · 득점률 {formatPct(point.score_pct)}</span>
      <span>{[point.lecture_title, point.session_title, formatDate(point.session_date ?? point.recorded_at)].filter(Boolean).join(" · ")}</span>
      {(point.retake_count ?? 1) > 1 && <span>대표 결과 · 재시험 {(point.retake_count ?? 1) - 1}회</span>}
      {point.archived && <span>보관된 시험</span>}
    </div>
  );
}

export default function StudentScoreTrendChart({ points, className }: Props) {
  const titleId = useId();
  const [lectureFilter, setLectureFilter] = useState<StudentScoreLectureFilter>(ALL_LECTURES);
  const lectureOptions = useMemo(() => {
    const map = new Map<number, LectureOption>();
    for (const point of points) {
      if (point.lecture_id == null || !point.lecture_title || map.has(point.lecture_id)) continue;
      map.set(point.lecture_id, {
        id: point.lecture_id,
        title: point.lecture_title,
        color: point.lecture_color,
        chipLabel: point.lecture_chip_label,
      });
    }
    return Array.from(map.values());
  }, [points]);
  const selectedLecture = lectureFilter === ALL_LECTURES || lectureOptions.some((option) => option.id === lectureFilter)
    ? lectureFilter
    : ALL_LECTURES;
  const displayPoints = useMemo(
    () => filterStudentScoreTrend(points, selectedLecture),
    [points, selectedLecture],
  );
  const metrics = useMemo(() => summarizeStudentScoreTrend(displayPoints), [displayPoints]);
  const chartWidth = Math.max(320, displayPoints.length * 72);
  const chartUpperBound = Math.max(100, Math.ceil((metrics.best ?? 100) / 25) * 25);

  return (
    <section
      className={[styles.root, className].filter(Boolean).join(" ")}
      aria-labelledby={titleId}
      data-testid="student-score-trend"
    >
      <div className={styles.header}>
        <div className={styles.headingGroup}>
          <span className={styles.iconWrap} aria-hidden><Route size={ICON.md} /></span>
          <div>
            <div className={styles.titleRow}>
              <h3 id={titleId}>회차별 성적 추이</h3>
              <Badge size="xs" tone="info">자동 누적</Badge>
            </div>
            <p>점수가 확정된 테스트를 시간순으로 쌓아 득점률로 비교합니다.</p>
          </div>
        </div>
        {metrics.firstToLatest != null && (
          <div className={styles.growth} data-tone={metrics.firstToLatest > 0 ? "up" : metrics.firstToLatest < 0 ? "down" : "flat"}>
            <span>첫 회차 대비</span>
            <strong>{metrics.firstToLatest > 0 ? "+" : ""}{metrics.firstToLatest}%p</strong>
          </div>
        )}
      </div>

      {lectureOptions.length > 1 && (
        <div className={styles.filters} aria-label="강의별 성적 추이">
          <button type="button" aria-pressed={selectedLecture === ALL_LECTURES} data-active={selectedLecture === ALL_LECTURES} onClick={() => setLectureFilter(ALL_LECTURES)}>
            전체
          </button>
          {lectureOptions.map((option) => (
            <button key={option.id} type="button" aria-pressed={selectedLecture === option.id} data-active={selectedLecture === option.id} onClick={() => setLectureFilter(option.id)}>
              <LectureChip lectureName={option.title} color={option.color ?? undefined} chipLabel={option.chipLabel} size={20} />
              <span>{option.title}</span>
            </button>
          ))}
        </div>
      )}

      {displayPoints.length === 0 ? (
        <div className={styles.empty}>
          <strong>아직 연결할 점수가 없습니다.</strong>
          <span>첫 시험 점수가 입력되면 1회차부터 자동으로 표시됩니다.</span>
        </div>
      ) : (
        <>
          <div className={styles.metrics}>
            <Metric label="최근" value={formatPct(metrics.latest)} />
            <Metric label="누적" value={`${metrics.count}회`} />
            <Metric label="평균" value={formatPct(metrics.average)} />
            <Metric label="최고" value={formatPct(metrics.best)} />
            <ChangeMetric value={metrics.change} />
          </div>

          <div className={styles.chartScroller}>
            {/* The width grows with round count so long histories scroll instead of compressing labels. */}
            {/* eslint-disable-next-line no-restricted-syntax */}
            <div className={styles.chartPaper} style={{ width: chartWidth }} data-testid="student-score-trend-chart">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={displayPoints} margin={{ top: 18, right: 24, bottom: 8, left: 2 }} accessibilityLayer>
                  <CartesianGrid stroke="var(--score-grid)" strokeDasharray="2 6" vertical />
                  <XAxis dataKey="round_label" tickLine={false} axisLine={false} interval={0} tick={{ fontSize: 11, fill: "var(--color-text-muted)" }} />
                  <YAxis domain={[0, chartUpperBound]} width={34} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}`} tick={{ fontSize: 10, fill: "var(--color-text-muted)" }} />
                  <ReferenceLine y={metrics.average ?? 0} stroke="var(--color-text-muted)" strokeDasharray="5 5" strokeOpacity={0.55} />
                  <Tooltip content={ScoreTooltip} cursor={{ stroke: "var(--color-border-strong)", strokeDasharray: "3 4" }} />
                  <Line
                    type="monotone"
                    dataKey="score_pct"
                    name="득점률"
                    stroke="var(--score-line)"
                    strokeWidth={3}
                    dot={{ r: 5, fill: "var(--color-bg-surface)", stroke: "var(--score-line)", strokeWidth: 3 }}
                    activeDot={{ r: 7, fill: "var(--score-line)", stroke: "var(--color-bg-surface)", strokeWidth: 3 }}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          {displayPoints.length === 1 && (
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

function ChangeMetric({ value }: { value: number | null }) {
  const tone = value == null || value === 0 ? "flat" : value > 0 ? "up" : "down";
  const Icon = tone === "up" ? ArrowUpRight : tone === "down" ? ArrowDownRight : Minus;
  return (
    <div className={styles.metric} data-tone={tone}>
      <span>직전 대비</span>
      <strong><Icon size={ICON.sm} aria-hidden />{value == null ? "-" : `${value > 0 ? "+" : ""}${value}%p`}</strong>
    </div>
  );
}
