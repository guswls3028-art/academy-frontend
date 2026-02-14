// PATH: src/features/videos/components/features/video-analytics/VideoAchievementTab.tsx

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "@/shared/api/axios";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
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

/** 사이즈 SSOT: ds-status-badge (2ch) */
function StatusBadge({ status }: { status: Row["status"] }) {
  const tone = status === "completed" ? "success" : status === "danger" ? "danger" : "neutral";
  const colorClass =
    status === "completed" ? "!bg-green-600 !text-white" : status === "danger" ? "!bg-red-600 !text-white" : "!bg-yellow-500 !text-white";
  const label: Record<Row["status"], string> = {
    completed: "완료",
    warning: "주의",
    danger: "위험",
  };
  return (
    <span className={`ds-status-badge ${colorClass}`} data-tone={tone}>
      {label[status]}
    </span>
  );
}

function KpiCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-[var(--border-divider)] bg-[var(--bg-surface)] p-4">
      <div className="text-xs text-[var(--text-muted)]">{label}</div>
      <div className="mt-1 text-2xl font-bold text-[var(--text-primary)]">
        {value}
      </div>
      {sub ? (
        <div className="mt-1 text-xs text-[var(--text-muted)]">{sub}</div>
      ) : null}
    </div>
  );
}

export default function VideoAchievementTab({ videoId, onSelectStudent }: Props) {
  const [sortKey, setSortKey] = useState<"progress" | "name" | "status">("status");

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
      copy.sort((a, b) => (a.student_name || "").localeCompare(b.student_name || ""));
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
          <div className="text-sm font-semibold text-[var(--text-primary)]">
            학습 성취도{" "}
            {isFetching ? (
              <span className="ml-2 text-xs text-[var(--text-muted)]">
                동기화 중...
              </span>
            ) : null}
          </div>
          <div className="mt-1 text-xs text-[var(--text-muted)]">
            * 출석이 <b>ONLINE(영상)</b> 인 학생만 집계합니다.
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="text-xs text-[var(--text-muted)]">정렬</div>
          <select
            className="rounded border border-[var(--border-divider)] bg-[var(--bg-surface)] px-2 py-1 text-xs text-[var(--text-primary)]"
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
        <KpiCard label="영상 수강 학생" value={`${summary?.total_students ?? 0}명`} />
        <KpiCard label="평균 진도율" value={`${summary?.avg_progress ?? 0}%`} />
        <KpiCard label="완료율" value={`${summary?.completed_rate ?? 0}%`} />
        <KpiCard label="미완료" value={`${summary?.incomplete_count ?? 0}명`} />
      </div>

      {/* Chart + Table */}
      <div className="grid flex-1 min-h-0 grid-cols-12 gap-4">
        {/* Chart */}
        <div className="col-span-5 flex min-h-0 flex-col rounded-xl border border-[var(--border-divider)] bg-[var(--bg-surface)] p-4">
          <div className="mb-2 text-sm font-semibold text-[var(--text-primary)]">
            진도 분포
          </div>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={dist}
                margin={{ left: 10, right: 10, top: 10, bottom: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    background: "var(--bg-surface-soft)",
                    border: "1px solid var(--border-divider)",
                    borderRadius: 8,
                    fontSize: 12,
                    color: "var(--text-primary)",
                  }}
                  labelStyle={{ color: "var(--text-secondary)" }}
                />
                <Bar dataKey="count" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-3 text-xs text-[var(--text-muted)]">
            * 95% 이상은 “완료”로 간주(백엔드 status 기준)
          </div>
        </div>

        {/* Table */}
        <div className="col-span-7 flex min-h-0 flex-col overflow-hidden rounded-xl border border-[var(--border-divider)] bg-[var(--bg-surface)]">
          <div className="flex items-center justify-between border-b border-[var(--border-divider)] bg-[var(--bg-surface-soft)] px-3 py-2 text-sm font-semibold">
            <span>학생별 현황</span>
            <span className="text-xs text-[var(--text-muted)]">
              클릭 → 권한 탭으로 이동
            </span>
          </div>

          <div className="grid grid-cols-12 border-b border-[var(--border-divider)] bg-[var(--bg-surface)] px-3 py-2 text-xs font-semibold text-[var(--text-secondary)]">
            <div className="col-span-3">이름</div>
            <div className="col-span-2 text-center">상태</div>
            <div className="col-span-2 text-center">진도</div>
            <div className="col-span-3">시청 위치</div>
            <div className="col-span-2 text-right">완료</div>
          </div>

          <div className="flex-1 overflow-auto">
            {sorted.length === 0 ? (
              <div className="p-4 text-sm text-[var(--text-muted)]">
                영상 수강(ONLINE) 학생이 없습니다.
              </div>
            ) : (
              sorted.map((s) => (
                <button
                  key={s.enrollment}
                  className="grid w-full grid-cols-12 border-b border-[var(--border-divider)] px-3 py-2 text-left text-sm hover:bg-[var(--bg-surface-soft)]"
                  onClick={() => onSelectStudent?.(s.enrollment)}
                >
                  <div className="col-span-3 truncate font-medium">
                    {s.student_name}
                  </div>
                  <div className="col-span-2 flex justify-center">
                    <StatusBadge status={s.status} />
                  </div>
                  <div className="col-span-2 text-center font-semibold">
                    {Number(s.progress ?? 0).toFixed(1)}%
                  </div>
                  <div className="col-span-3 text-[var(--text-secondary)]">
                    {formatSeconds(s.watched_seconds)}
                  </div>
                  <div className="col-span-2 text-right text-[var(--text-secondary)]">
                    {s.completed ? "Y" : "-"}
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
