// PATH: src/features/lectures/hooks/useSessionVideos.ts
import { useQuery } from "@tanstack/react-query";
import api from "@/shared/api/axios";

/**
 * Session 기준 media/videos 조회 + 상태 polling
 *
 * - READY / FAILED 아닌 영상이 있으면 2초 polling
 * - 전부 READY/FAILED면 polling 중단
 */
export function useSessionVideos(sessionId: number) {
  return useQuery({
    queryKey: ["session-videos", sessionId],
    enabled: !!sessionId,

    queryFn: async () => {
      const res = await api.get("/media/videos/", {
        params: { session_id: sessionId },
      });
      return res.data.results ?? res.data;
    },

    refetchInterval: (query) => {
      const videos = query.state.data as any[] | undefined;
      if (!videos || videos.length === 0) return false;

      const hasProcessing = videos.some(
        (v) => v.status === "PENDING" || v.status === "UPLOADED" || v.status === "PROCESSING"
      );

      return hasProcessing ? 2000 : false;
    },
  });
}
