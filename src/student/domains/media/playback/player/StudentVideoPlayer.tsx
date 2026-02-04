// PATH: src/student/media/playback/player/StudentVideoPlayer.tsx
import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import Hls from "hls.js";

import { fetchStudentVideoPlayback } from "@/student/domains/media/api/media";

type Props = {
  videoId: number;
  enrollmentId: number;
};

export default function StudentVideoPlayer({ videoId, enrollmentId }: Props) {
  const ref = useRef<HTMLVideoElement | null>(null);

  const q = useQuery({
    queryKey: ["student-video-playback-inner", videoId, enrollmentId],
    queryFn: () => fetchStudentVideoPlayback(videoId, enrollmentId),
    enabled: Number.isFinite(videoId),
    retry: 0,
  });

  useEffect(() => {
    const video = ref.current;
    if (!video || !q.data) return;

    const { hls_url, mp4_url } = q.data;

    if (hls_url && Hls.isSupported()) {
      const hls = new Hls();
      hls.loadSource(hls_url);
      hls.attachMedia(video);
      return () => hls.destroy();
    }

    if (mp4_url) video.src = mp4_url;
  }, [q.data]);

  if (q.isLoading) return <div>영상 준비 중...</div>;
  if (q.isError) return <div>재생 실패</div>;

  return <video ref={ref} controls style={{ width: "100%" }} />;
}
