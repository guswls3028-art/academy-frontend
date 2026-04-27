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

type Props = {
  videoId: number;
  onSelectStudent?: (enrollmentId: number) => void;
};

type Row = {
  enrollment: number;
  student_name: string;
  progress: number; // 0~100
  completed: boolean;
  watched_seconds: number;
  status: "completed" | "warning" | "danger";
};

function formatSeconds(sec: number) {
  const s = Math.max(0, Math.floor(sec || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m > 0) return `${m}분 ${r}초`;
  return `${r}초`;
}

/** ds-status-badge + data-tone (success/danger/warning) */
function StatusBadge({ status }: { status: Row["status"] }) {
  const tone =
    status === "completed"
      ? "success"
      : status === "danger"
        ? "danger"
        : "warning";
  const label: Record<Row["status"], string> = {
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
      className="kpi"
      style={{
        background: accent
          ? "color-mix(in srgb, var(--color-brand-primary) 4%, var(--color-bg-surface))"
          : "var(--color-bg-surface)",
        borderColor: accent
          ? "color-mix(in srgb, var(--color-brand-primary) 16%, var(--color-border-divider))"
          : undefined,
      }}
    >
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      {sub ? (
        <div
          className="mt-1"
          style={{
            fontSize: "var(--text-xs, 11px)",
            color: "var(--color-text-muted)",
          }}
        >
          {sub}
        </div>
      ) : null}
    </div>
  );
}

/** Progress bar with color based on value */
function ProgressBar({ value }: { value: number }) {
  const pct = Math.min(100, Math.max(0, value));
  const color =
    pct >= 95
      ? "var(--color-success)"
      : pct >= 50
        ? "var(--color-brand-primary)"
        : pct >= 30
          ? "var(--color-warning)"
          : "var(--color-danger)";

  return (
    <div className="flex items-center gap-2 w-full">
      <div
        style={{
          flex: 1,
          height: 6,
          borderRadius: 3,
          background:
            "color-mix(in srgb, var(--color-border-divider) 30%, var(--color-bg-surface))",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            borderRadius: 3,
            background: color,
            transition: "width 400ms ease",
          }}
        />
      </div>
      <span
        className="font-semibold tabular-nums"
        style={{
          fontSize: "var(--text-xs, 11px)",
          color: "var(--color-text-primary)",
          minWidth: 36,
          textAlign: "right",
        }}
      >
        {pct.toFixed(1)}%
      </span>
    </div>
  );
}

const BAR_COLORS = [
  "var(--color-danger)",
  "var(--color-warning)",
  "var(--color-brand-primary)",
  "var(--color-success)",
];

export default function VideoAchievementTab({
  videoId,
  onSelectStudent,
}: Props) {
  const [sortKey, setSortKey] = useState<"progress" | "name" | "status">(
    "status"
  );

  const { data, isFetching } = useQuery({
    queryKey: ["video", videoId, "achievement"],
    queryFn: async () => {
      const res = await api.get(`/media/videos/${videoId}/achievement/`);
      return res.data;
    },
    enabled: !!videoId,
    staleTime: 5000,
    retry: 1,
  });

  const students: Row[] = data?.students ?? [];
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

    const statusRank: Record<Row["status"], number> = {
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

  return (
    <div className="flex h-full flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div
            className="font-semibold flex items-center gap-2"
            style={{
              fontSize: "var(--text-sm, 13px)",
              color: "var(--color-text-primary)",
            }}
          >
            학습 성취도
            {isFetching && (
              <span
                style={{
                  fontSize: "var(--text-xs, 11px)",
                  color: "var(--color-text-muted)",
                  fontWeight: 400,
                }}
              >
                동기화 중...
              </span>
            )}
          </div>
          <div
            className="mt-1"
            style={{
              fontSize: "var(--text-xs, 11px)",
              color: "var(--color-text-muted)",
            }}
          >
            출석이 <b>ONLINE(영상)</b>인 학생만 집계합니다.
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span
            style={{
              fontSize: "var(--text-xs, 11px)",
              color: "var(--color-text-muted)",
            }}
          >
            정렬
          </span>
          <select
            style={{
              height: 28,
              padding: "0 var(--space-3)",
              fontSize: "var(--text-xs, 11px)",
              color: "var(--color-text-primary)",
              background: "var(--color-bg-surface)",
              border: "1px solid var(--color-border-default)",
              borderRadius: "var(--radius-sm)",
              cursor: "pointer",
            }}
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as any)}
          >
            <option value="status">상태(위험→완료)</option>
            <option value="progress">진도(높은순)</option>
            <option value="name">이름(가나다)</option>
          </select>
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-4 gap-3">
        <KpiCard
          label="영상 수강 학생"
          value={`${summary?.total_students ?? 0}명`}
        />
        <KpiCard
          label="평균 진도율"
          value={`${summary?.avg_progress ?? 0}%`}
          accent
        />
        <KpiCard
          label="완료율"
          value={`${summary?.completed_rate ?? 0}%`}
          accent
        />
        <KpiCard
          label="미완료"
          value={`${summary?.incomplete_count ?? 0}명`}
          sub={
            summary?.incomplete_count > 0 ? "관리 필요" : undefined
          }
        />
      </div>

      {/* Chart + Table */}
      <div className="grid flex-1 min-h-0 grid-cols-12 gap-4">
        {/* Chart */}
        <div
          className="col-span-5 flex min-h-0 flex-col"
          style={{
            borderRadius: "var(--radius-xl)",
            border: "1px solid var(--color-border-subtle)",
            background: "var(--color-bg-surface)",
            padding: "var(--space-4)",
          }}
        >
          <div
            className="font-semibold"
            style={{
              fontSize: "var(--text-sm, 13px)",
              color: "var(--color-text-primary)",
              marginBottom: "var(--space-3)",
            }}
          >
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
                  cursor={{ fill: "color-mix(in srgb, var(--color-brand-primary) 6%, transparent)" }}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {dist.map((_entry, index) => (
                    <Cell key={index} fill={BAR_COLORS[index]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div
            className="mt-2"
            style={{
              fontSize: "10px",
              color: "var(--color-text-muted)",
            }}
          >
            95% 이상은 "완료"로 간주 (백엔드 status 기준)
          </div>
        </div>

        {/* Table */}
        <div
          className="col-span-7 flex min-h-0 flex-col overflow-hidden"
          style={{
            borderRadius: "var(--radius-xl)",
            border: "1px solid var(--color-border-subtle)",
            background: "var(--color-bg-surface)",
          }}
        >
          {/* Table header bar */}
          <div
            className="flex items-center justify-between"
            style={{
              padding: "var(--space-3) var(--space-4)",
              borderBottom: "1px solid var(--color-border-subtle)",
              background:
                "var(--color-bg-surface-soft, var(--bg-surface-soft))",
            }}
          >
            <span
              className="font-semibold"
              style={{
                fontSize: "var(--text-sm, 13px)",
                color: "var(--color-text-primary)",
              }}
            >
              학생별 현황
            </span>
            <span
              style={{
                fontSize: "10px",
                color: "var(--color-text-muted)",
              }}
            >
              클릭 시 권한 탭으로 이동
            </span>
          </div>

          {/* Column headers */}
          <div
            className="grid grid-cols-12 items-center"
            style={{
              padding: "var(--space-2) var(--space-4)",
              borderBottom: "1px solid var(--color-border-subtle)",
              background: "var(--color-bg-surface)",
              fontSize: "var(--text-xs, 11px)",
              fontWeight: 600,
              color: "var(--color-text-tertiary)",
              letterSpacing: "0.01em",
            }}
          >
            <div className="col-span-3">이름</div>
            <div className="col-span-2 text-center">상태</div>
            <div className="col-span-3">진도</div>
            <div className="col-span-2">시청 위치</div>
            <div className="col-span-2 text-center">완료</div>
          </div>

          {/* Table body */}
          <div className="flex-1 min-h-0 overflow-auto">
            {sorted.length === 0 ? (
              <div
                className="flex items-center justify-center"
                style={{
                  padding: "var(--space-8)",
                  fontSize: "var(--text-sm, 13px)",
                  color: "var(--color-text-muted)",
                }}
              >
                영상 수강(ONLINE) 학생이 없습니다.
              </div>
            ) : (
              sorted.map((s, idx) => (
                <button
                  key={s.enrollment}
                  className="grid w-full grid-cols-12 items-center text-left"
                  onClick={() => onSelectStudent?.(s.enrollment)}
                  type="button"
                  style={{
                    padding: "var(--space-2) var(--space-4)",
                    borderBottom: "1px solid var(--color-border-subtle)",
                    background:
                      idx % 2 === 1
                        ? "color-mix(in srgb, var(--color-brand-primary) 2%, var(--color-bg-surface))"
                        : "var(--color-bg-surface)",
                    cursor: "pointer",
                    transition: "background 120ms ease",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background =
                      "var(--color-bg-surface-hover, var(--bg-surface-soft))";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background =
                      idx % 2 === 1
                        ? "color-mix(in srgb, var(--color-brand-primary) 2%, var(--color-bg-surface))"
                        : "var(--color-bg-surface)";
                  }}
                >
                  <div
                    className="col-span-3 truncate font-medium"
                    style={{
                      fontSize: "var(--text-sm, 13px)",
                      color: "var(--color-text-primary)",
                    }}
                  >
                    <StudentNameWithLectureChip name={s.student_name} enrollmentId={s.enrollment} />
                  </div>
                  <div className="col-span-2 flex justify-center">
                    <StatusBadge status={s.status} />
                  </div>
                  <div className="col-span-3">
                    <ProgressBar value={Number(s.progress ?? 0)} />
                  </div>
                  <div
                    className="col-span-2"
                    style={{
                      fontSize: "var(--text-xs, 11px)",
                      color: "var(--color-text-secondary)",
                    }}
                  >
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
