// PATH: src/features/lectures/hooks/useSessionVideos.ts
import { useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "@/shared/api/axios";
import { VIDEO_STATUS_IN_PROGRESS } from "@/features/videos/constants/videoProcessing";
import type { VideoStatus } from "@/features/videos/api/videos";

const POLL_INTERVAL_MS = 2000;
const POLL_BACKOFF_AFTER_MS = 3 * 60 * 1000; // 3 minutes
const POLL_BACKOFF_INTERVAL_MS = 10000;      // 10s after backoff
const POLL_MAX_DURATION_MS = 4 * 60 * 60 * 1000; // 4 hours cap

/**
 * Session-scoped video list with Batch-only safe polling.
 * - Poll only when at least one video is in progress (PENDING, UPLOADED, PROCESSING).
 * - Stop when all are READY or FAILED.
 * - Stop when tab is hidden.
 * - Exponential backoff: after 3 min, poll every 10s.
 * - Hard cap: stop polling after 4 hours.
 */
export function useSessionVideos(sessionId: number) {
  const pollStartedAt = useRef<number | null>(null);

  return useQuery({
    queryKey: ["session-videos", sessionId],
    enabled: !!sessionId,

    queryFn: async () => {
      const res = await api.get("/media/videos/", {
        params: { session: sessionId },
      });
      return res.data.results ?? res.data;
    },

    refetchInterval: (query) => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return false;
      }

      const videos = query.state.data as { status?: string }[] | undefined;
      if (!videos || videos.length === 0) return false;

      const hasInProgress = videos.some((v) =>
        v.status != null && VIDEO_STATUS_IN_PROGRESS.includes(v.status as VideoStatus)
      );

      if (!hasInProgress) {
        pollStartedAt.current = null;
        return false;
      }

      const now = Date.now();
      if (pollStartedAt.current === null) pollStartedAt.current = now;
      const elapsed = now - pollStartedAt.current;

      if (elapsed >= POLL_MAX_DURATION_MS) return false;
      if (elapsed >= POLL_BACKOFF_AFTER_MS) return POLL_BACKOFF_INTERVAL_MS;
      return POLL_INTERVAL_MS;
    },
  });
}
