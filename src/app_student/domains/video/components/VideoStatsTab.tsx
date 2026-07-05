/**
 * 영상 통계 탭 — 시청 분석, 강좌별 진도
 * GET /student/video/me/stats/ 엔드포인트 사용.
 */
import type { CSSProperties } from "react";
import { useQuery } from "@tanstack/react-query";
import EmptyState from "@student/layout/EmptyState";
import { StatCard, StatGrid } from "@student/shared/ui/components/StatCard";
import ProgressRing from "@student/shared/ui/components/ProgressRing";
import { IconVideo } from "@student/shared/ui/icons/Icons";
import { fetchVideoStats } from "../api/video.api";
import { studentVideoQueryKeys } from "../queryKeys";

function formatDurationHM(seconds: number): string {
  if (seconds <= 0) return "0분";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}시간 ${m}분`;
  return `${m}분`;
}

function progressWidthStyle(value: number): CSSProperties {
  return { "--video-progress": `${Math.min(Math.max(value, 0), 100)}%` } as CSSProperties;
}

export default function VideoStatsTab() {
  const { data: stats, isLoading } = useQuery({
    queryKey: studentVideoQueryKeys.stats,
    queryFn: fetchVideoStats,
    staleTime: 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="stu-skel-stack">
        <div className="stu-skel stu-skel--lg" />
        <div className="stu-skel stu-skel--xl" />
      </div>
    );
  }

  if (!stats || stats.total_videos === 0) {
    return (
      <EmptyState
        title="시청 기록이 없습니다"
        description="영상을 시청하면 통계가 표시됩니다."
        icon={<IconVideo className="stu-emptystate__icon-svg" aria-hidden="true" />}
      />
    );
  }

  const lectureData = stats.lectures.map((l) => ({
    id: l.lecture_id,
    title: l.title,
    progress: l.progress_pct,
    videoCount: l.video_count,
    completedCount: l.completed_count,
  }));
  const totalProgress =
    stats.total_content_duration > 0
      ? (stats.total_watch_duration / stats.total_content_duration) * 100
      : 0;

  return (
    <div className="video-stats-shell">
      <section className="video-stats-overview">
        <ProgressRing
          percent={stats.completion_rate}
          size={88}
          color={stats.completion_rate >= 70 ? "var(--stu-success)" : stats.completion_rate >= 30 ? "var(--stu-warn)" : "var(--stu-primary)"}
          sublabel="완료율"
        />
        <div className="video-stats-overview__copy">
          <div className="video-card__kicker">학습 완주율</div>
          <div className="video-stats-overview__title">{stats.completion_rate}% 완료</div>
          <p className="video-stats-overview__desc">
            완료한 항목과 누적 시간을 기준으로 현재 학습 흐름을 계산했습니다.
          </p>
        </div>
      </section>

      <StatGrid>
        <StatCard label="영상" value={`${stats.total_videos}개`} />
        <StatCard label="완료" value={`${stats.completed_videos}개`} accent={stats.completed_videos > 0 ? "success" : undefined} />
        <StatCard label="시청시간" value={formatDurationHM(stats.total_watch_duration)} />
      </StatGrid>

      <section className="video-stats-card">
        <div className="video-stats-card__head">
          <span>전체 진행</span>
          <span>
            {formatDurationHM(stats.total_watch_duration)} / {formatDurationHM(stats.total_content_duration)}
          </span>
        </div>
        <div className="video-stats-bar" aria-hidden="true">
          <div
            className="video-stats-bar__fill"
            style={progressWidthStyle(totalProgress)}
          />
        </div>
      </section>

      {lectureData.length > 0 && (
        <section className="video-stats-card">
          <div className="video-stats-card__title">
            강좌별 진행 맵
          </div>
          <div className="video-progress-map">
            {lectureData.map((entry) => (
              <div className="video-progress-map__row" key={entry.id}>
                <div className="video-progress-map__head">
                  <span className="video-progress-map__title">{entry.title}</span>
                  <strong>{entry.progress}%</strong>
                </div>
                <div className="video-progress-map__bar" aria-hidden="true">
                  <div
                    className="video-progress-map__fill"
                    data-tone={entry.progress >= 80 ? "success" : entry.progress >= 40 ? "primary" : "warn"}
                    style={progressWidthStyle(entry.progress)}
                  />
                </div>
                <div className="video-progress-map__meta">
                  {entry.completedCount}/{entry.videoCount} 완료
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
