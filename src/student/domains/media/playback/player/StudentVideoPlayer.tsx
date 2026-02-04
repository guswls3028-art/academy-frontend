// PATH: src/student/media/playback/player/StudentVideoPlayer.tsx
import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import Hls from "hls.js";

import { fetchStudentVideoPlayback } from "@/student/domains/media/api/media";

type Props = {
  videoId: number;
  enrollmentId: number;
  previewMode?: string;
};

export default function StudentVideoPlayer({ videoId, enrollmentId }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const q = useQuery({
    queryKey: ["video-playback", videoId, enrollmentId],
    queryFn: () => fetchStudentVideoPlayback(videoId, enrollmentId),
    enabled: Number.isFinite(videoId),
    retry: false,
  });

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !q.data) return;

    const { hls_url, mp4_url } = q.data;

    if (hls_url && Hls.isSupported()) {
      const hls = new Hls();
      hls.loadSource(hls_url);
      hls.attachMedia(video);
      return () => hls.destroy();
    }

    if (mp4_url) {
      video.src = mp4_url;
    }
  }, [q.data]);

  if (q.isLoading) return <div>영상 로딩 중...</div>;
  if (q.isError || !q.data) return <div>재생 실패</div>;

  return (
    <video
      ref={videoRef}
      controls
      playsInline
      style={{ width: "100%", maxHeight: 520, background: "#000" }}
    />
  );
}
