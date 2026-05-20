// PATH: src/app_admin/domains/videos/components/features/video-analytics/VideoAchievementTab.tsx

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "@/shared/api/axios";
import StudentNameWithLectureChip from "@/shared/ui/chips/StudentNameWithLectureChip";
import { Badge } from "@/shared/ui/ds";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from "recharts";
import "./VideoAnalyticsTabs.css";

type Props = {
  videoId: number;
  onSelectStudent?: (enrollmentId: number) => void;
};

type AchievementStatus = "completed" | "warning" | "danger";
type SortKey = "progress" | "name" | "status";

type Row = {
  enrollment: number;
  student_name: string;
  progress: number;
  completed: boolean;
  watched_seconds: number;
  status: AchievementStatus;
};

type AchievementSummary = {
  total_students: number;
  avg_progress: number;
  completed_rate: number;
  incomplete_count: number;
};

type AchievementResponse = {
  summary?: AchievementSummary;
  students?: Row[];
};

type ProgressTone = "success" | "primary" | "warning" | "danger";

const SORT_KEYS: readonly SortKey[] = ["progress", "name", "status"];

const BAR_COLORS = [
  "var(--color-danger)",
  "var(--color-warning)",
  "var(--color-brand-primary)",
  "var(--color-success)",
];

function isSortKey(value: string): value is SortKey {
  return SORT_KEYS.includes(value as SortKey);
}

function formatSeconds(sec: number) {
  const s = Math.max(0, Math.floor(sec || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m > 0) return `${m}분 ${r}초`;
  return `${r}초`;
}

function progressTone(pct: number): ProgressTone {
  if (pct >= 95) return "success";
  if (pct >= 50) return "primary";
  if (pct >= 30) return "warning";
  return "danger";
}

function rowClassName(isAlt: boolean) {
  return [
    "video-analytics-row",
    "grid w-full grid-cols-12 items-center text-left",
    isAlt && "video-analytics-row--alt",
  ]
    .filter(Boolean)
    .join(" ");
}

function StatusBadge({ status }: { status: AchievementStatus }) {
  const tone =
    status === "completed"
      ? "success"
      : status === "danger"
        ? "danger"
        : "warning";
  const label: Record<AchievementStatus, string> = {
    completed: "완료",
    warning: "주의",
    danger: "위험",
  };

  return (
    <Badge variant="solid" tone={tone}>
      {label[status]}
    </Badge>
  );
}

function KpiCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div
      className={[
        "video-analytics-kpi",
        accent && "video-analytics-kpi--accent",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="video-analytics-kpi-label">{label}</div>
      <div className="video-analytics-kpi-value">{value}</div>
      {sub ? (
        <div className="video-analytics-muted video-analytics-kpi-sub">
          {sub}
        </div>
      ) : null}
    </div>
  );
}

function ProgressBar({ value }: { value: number }) {
  const pct = Math.min(100, Math.max(0, value));

  return (
    <div className="video-analytics-progress">
      <progress
        className="video-analytics-progress-meter"
        data-tone={progressTone(pct)}
        max={100}
        value={pct}
        aria-label={`진도율 ${pct.toFixed(1)}%`}
      />
      <span className="video-analytics-progress-value">
        {pct.toFixed(1)}%
      </span>
    </div>
  );
}

export default function VideoAchievementTab({
  videoId,
  onSelectStudent,
}: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("status");

  const { data, isFetching } = useQuery<AchievementResponse>({
    queryKey: ["video", videoId, "achievement"],
    queryFn: async () => {
      const res = await api.get(`/media/videos/${videoId}/achievement/`);
      return res.data as AchievementResponse;
    },
    enabled: !!videoId,
    staleTime: 5000,
    retry: 1,
  });

  const students = useMemo(() => data?.students ?? [], [data?.students]);
  const summary = data?.summary;

  const dist = useMemo(() => {
    const buckets = [
      { key: "0-49", label: "0~49%", count: 0 },
      { key: "50-79", label: "50~79%", count: 0 },
      { key: "80-94", label: "80~94%", count: 0 },
      { key: "95-100", label: "95~100%", count: 0 },
    ];

    for (const s of students) {
      const p = Number(s.progress ?? 0);
      if (p < 50) buckets[0].count += 1;
      else if (p < 80) buckets[1].count += 1;
      else if (p < 95) buckets[2].count += 1;
      else buckets[3].count += 1;
    }

    return buckets;
  }, [students]);

  const sorted = useMemo(() => {
    const copy = [...students];

    const statusRank: Record<AchievementStatus, number> = {
      danger: 0,
      warning: 1,
      completed: 2,
    };

    if (sortKey === "progress") {
      copy.sort((a, b) => (b.progress ?? 0) - (a.progress ?? 0));
    } else if (sortKey === "name") {
      copy.sort((a, b) =>
        (a.student_name || "").localeCompare(b.student_name || "")
      );
    } else {
      copy.sort((a, b) => {
        const ra = statusRank[a.status] ?? 99;
        const rb = statusRank[b.status] ?? 99;
        if (ra !== rb) return ra - rb;
        return (a.student_name || "").localeCompare(b.student_name || "");
      });
    }
    return copy;
  }, [students, sortKey]);

  if (!data) return null;

  const totalStudents = summary?.total_students ?? 0;
  const avgProgress = summary?.avg_progress ?? 0;
  const completedRate = summary?.completed_rate ?? 0;
  const incompleteCount = summary?.incomplete_count ?? 0;

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="video-analytics-header">
        <div>
          <div className="video-analytics-title">
            학습 성취도
            {isFetching && (
              <span className="video-analytics-muted video-analytics-sync">
                동기화 중...
              </span>
            )}
          </div>
          <div className="video-analytics-muted video-analytics-description">
            출석이 <b>ONLINE(영상)</b>인 학생만 집계합니다.
          </div>
        </div>

        <div className="video-analytics-control">
          <span className="video-analytics-muted video-analytics-control-label">
            정렬
          </span>
          <select
            className="video-analytics-select"
            value={sortKey}
            onChange={(e) => {
              const next = e.target.value;
              if (isSortKey(next)) setSortKey(next);
            }}
          >
            <option value="status">상태(위험→완료)</option>
            <option value="progress">진도(높은순)</option>
            <option value="name">이름(가나다)</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <KpiCard label="영상 수강 학생" value={`${totalStudents}명`} />
        <KpiCard label="평균 진도율" value={`${avgProgress}%`} accent />
        <KpiCard label="완료율" value={`${completedRate}%`} accent />
        <KpiCard
          label="미완료"
          value={`${incompleteCount}명`}
          sub={incompleteCount > 0 ? "관리 필요" : undefined}
        />
      </div>

      <div className="grid flex-1 min-h-0 grid-cols-12 gap-4">
        <div className="video-analytics-card col-span-5 flex min-h-0 flex-col">
          <div className="video-analytics-section-title">
            진도 분포
          </div>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={dist}
                margin={{ left: 10, right: 10, top: 10, bottom: 10 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--color-border-subtle)"
                />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: "var(--color-text-secondary)" }}
                  axisLine={{ stroke: "var(--color-border-subtle)" }}
                  tickLine={{ stroke: "var(--color-border-subtle)" }}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: "var(--color-text-secondary)" }}
                  axisLine={{ stroke: "var(--color-border-subtle)" }}
                  tickLine={{ stroke: "var(--color-border-subtle)" }}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--color-bg-surface)",
                    border: "1px solid var(--color-border-subtle)",
                    borderRadius: "var(--radius-md)",
                    fontSize: 12,
                    color: "var(--color-text-primary)",
                    boxShadow: "var(--elevation-2)",
                  }}
                  labelStyle={{ color: "var(--color-text-secondary)" }}
                  cursor={{
                    fill: "color-mix(in srgb, var(--color-brand-primary) 6%, transparent)",
                  }}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {dist.map((entry, index) => (
                    <Cell key={entry.key} fill={BAR_COLORS[index]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="video-analytics-muted video-analytics-chart-note">
            95% 이상은 "완료"로 간주 (백엔드 status 기준)
          </div>
        </div>

        <div className="video-analytics-card video-analytics-card--flush col-span-7 flex min-h-0 flex-col overflow-hidden">
          <div className="video-analytics-panel-header">
            <span className="video-analytics-section-title">
              학생별 현황
            </span>
            <span className="video-analytics-muted video-analytics-hint">
              클릭 시 권한 탭으로 이동
            </span>
          </div>

          <div className="video-analytics-table-header grid grid-cols-12 items-center">
            <div className="col-span-3">이름</div>
            <div className="col-span-2 text-center">상태</div>
            <div className="col-span-3">진도</div>
            <div className="col-span-2">시청 위치</div>
            <div className="col-span-2 text-center">완료</div>
          </div>

          <div className="flex-1 min-h-0 overflow-auto">
            {sorted.length === 0 ? (
              <div className="video-analytics-empty">
                영상 수강(ONLINE) 학생이 없습니다.
              </div>
            ) : (
              sorted.map((s, idx) => (
                <button
                  key={s.enrollment}
                  className={rowClassName(idx % 2 === 1)}
                  onClick={() => onSelectStudent?.(s.enrollment)}
                  type="button"
                >
                  <div className="col-span-3 truncate font-medium video-analytics-primary-text">
                    <StudentNameWithLectureChip
                      name={s.student_name}
                      enrollmentId={s.enrollment}
                    />
                  </div>
                  <div className="col-span-2 flex justify-center">
                    <StatusBadge status={s.status} />
                  </div>
                  <div className="col-span-3">
                    <ProgressBar value={Number(s.progress ?? 0)} />
                  </div>
                  <div className="col-span-2 video-analytics-secondary-text">
                    {formatSeconds(s.watched_seconds)}
                  </div>
                  <div className="col-span-2 flex justify-center">
                    <Badge
                      variant="solid"
                      tone={s.completed ? "success" : "neutral"}
                      oneChar
                    >
                      {s.completed ? "완료" : "미완료"}
                    </Badge>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
