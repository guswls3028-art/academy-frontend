// PATH: src/app_admin/domains/videos/components/features/video-detail/components/VideoEngagementBar.tsx
// YouTube-style engagement stats bar for admin video detail

import { useQuery } from "@tanstack/react-query";
import { Eye, Heart, MessageCircle } from "lucide-react";
import type { ReactNode } from "react";
import { fetchVideoEngagement } from "@admin/domains/videos/api/videos.api";
import { adminVideoQueryKeys } from "@admin/domains/videos/queryKeys";
import { cx } from "@/shared/utils/cx";
import styles from "./VideoEngagementBar.module.css";

type StatTone = "default" | "danger" | "primary";

function formatCount(n: number | null | undefined): string {
  if (n == null || n <= 0) return "0";
  if (n < 1000) return n.toLocaleString();
  if (n < 10000) return `${(n / 1000).toFixed(1)}K`;
  const wan = n / 10000;
  return `${wan < 10 ? wan.toFixed(1) : Math.floor(wan)}만`;
}

interface Props {
  videoId: number;
  /** Fallback from video.view_count if engagement API not yet ready */
  fallbackViewCount?: number | null;
}

export default function VideoEngagementBar({ videoId, fallbackViewCount }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: adminVideoQueryKeys.engagement(videoId),
    queryFn: () => fetchVideoEngagement(videoId),
    enabled: !!videoId,
    retry: 1,
    staleTime: 30_000,
  });

  const viewCount = data?.view_count ?? fallbackViewCount ?? 0;
  const likeCount = data?.like_count ?? 0;
  const commentCount = data?.comment_count ?? 0;

  return (
    <div className={styles.bar}>
      {/* View Count */}
      <StatPill
        icon={<Eye size={18} aria-hidden />}
        value={formatCount(viewCount)}
        label="조회"
        loading={isLoading}
      />

      <Divider />

      {/* Like Count */}
      <StatPill
        icon={<Heart size={18} aria-hidden />}
        value={formatCount(likeCount)}
        label="좋아요"
        loading={isLoading}
        tone="danger"
      />

      <Divider />

      {/* Comment Count */}
      <StatPill
        icon={<MessageCircle size={18} aria-hidden />}
        value={formatCount(commentCount)}
        label="댓글"
        loading={isLoading}
        tone="primary"
      />
    </div>
  );
}

function Divider() {
  return <div className={styles.divider} />;
}

function StatPill({
  icon,
  value,
  label,
  loading,
  tone = "default",
}: {
  icon: ReactNode;
  value: string;
  label: string;
  loading?: boolean;
  tone?: StatTone;
}) {
  return (
    <div className={styles.statPill}>
      <span
        className={cx(
          styles.icon,
          tone === "danger" && styles.iconDanger,
          tone === "primary" && styles.iconPrimary
        )}
      >
        {icon}
      </span>
      <div className={styles.statText}>
        {loading ? (
          <span className={styles.skeletonValue} />
        ) : (
          <span className={styles.value}>{value}</span>
        )}
        <span className={styles.label}>{label}</span>
      </div>
    </div>
  );
}
