// PATH: src/app_admin/domains/videos/components/features/video-detail/components/VideoEngagementBar.tsx
// YouTube-style engagement stats bar for admin video detail

import { useQuery } from "@tanstack/react-query";
import { fetchVideoEngagement } from "@admin/domains/videos/api/videos.api";

function formatCount(n: number | null | undefined): string {
  if (n == null || n <= 0) return "0";
  if (n < 1000) return n.toLocaleString();
  if (n < 10000) return `${(n / 1000).toFixed(1)}K`;
  const wan = n / 10000;
  return `${wan < 10 ? wan.toFixed(1) : Math.floor(wan)}만`;
}

/* ── SVG Icons ── */
function EyeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function HeartIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

interface Props {
  videoId: number;
  /** Fallback from video.view_count if engagement API not yet ready */
  fallbackViewCount?: number | null;
}

export default function VideoEngagementBar({ videoId, fallbackViewCount }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ["video-engagement", videoId],
    queryFn: () => fetchVideoEngagement(videoId),
    enabled: !!videoId,
    retry: 1,
    staleTime: 30_000,
  });

  const viewCount = data?.view_count ?? fallbackViewCount ?? 0;
  const likeCount = data?.like_count ?? 0;
  const commentCount = data?.comment_count ?? 0;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 0,
        background: "var(--color-bg-surface-soft)",
        borderRadius: 12,
        padding: "2px",
        border: "1px solid var(--color-border-divider)",
      }}
    >
      {/* View Count */}
      <StatPill
        icon={<EyeIcon />}
        value={formatCount(viewCount)}
        label="조회"
        loading={isLoading}
      />

      <Divider />

      {/* Like Count */}
      <StatPill
        icon={<HeartIcon />}
        value={formatCount(likeCount)}
        label="좋아요"
        loading={isLoading}
        accent="var(--color-danger)"
      />

      <Divider />

      {/* Comment Count */}
      <StatPill
        icon={<ChatIcon />}
        value={formatCount(commentCount)}
        label="댓글"
        loading={isLoading}
        accent="var(--color-primary)"
      />
    </div>
  );
}

function Divider() {
  return (
    <div
      style={{
        width: 1,
        height: 28,
        background: "var(--color-border-divider)",
        flexShrink: 0,
      }}
    />
  );
}

function StatPill({
  icon,
  value,
  label,
  loading,
  accent,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
  loading?: boolean;
  accent?: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "10px 20px",
        flex: 1,
        justifyContent: "center",
        minWidth: 0,
      }}
    >
      <span style={{ color: accent ?? "var(--color-text-secondary)", display: "flex", flexShrink: 0 }}>
        {icon}
      </span>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 0, minWidth: 0 }}>
        {loading ? (
          <span
            style={{
              width: 32,
              height: 16,
              borderRadius: 4,
              background: "var(--color-bg-surface)",
              display: "block",
            }}
          />
        ) : (
          <span
            style={{
              fontSize: 16,
              fontWeight: 700,
              color: "var(--color-text-primary)",
              lineHeight: 1.2,
              letterSpacing: "-0.02em",
            }}
          >
            {value}
          </span>
        )}
        <span
          style={{
            fontSize: 11,
            color: "var(--color-text-muted)",
            fontWeight: 500,
            lineHeight: 1.2,
          }}
        >
          {label}
        </span>
      </div>
    </div>
  );
}
