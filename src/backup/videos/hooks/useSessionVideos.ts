import { useQuery } from "@tanstack/react-query";
import { fetchSessionVideos, Video } from "../api/videos";

function shouldPoll(videos: Video[]): boolean {
  return videos.some(
    (v) =>
      v.status !== "READY" &&
      v.status !== "FAILED"
  );
}

export function useSessionVideos(sessionId: number) {
  return useQuery({
    queryKey: ["session-videos", sessionId],
    queryFn: () => fetchSessionVideos(sessionId),

    refetchInterval: (query) => {
      const videos = query.state.data;
      if (!videos) return 5000;

      return shouldPoll(videos) ? 5000 : false;
    },
  });
}
