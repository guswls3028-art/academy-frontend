// PATH: src/student/media/playback/player/StudentVideoPlayer.tsx
/**
 * ✅ StudentVideoPlayer (STUDENT / REAL PLAYER)
 * - 학생 전용 실제 재생 플레이어
 * - 판단/정책 계산 ❌
 * - playback API를 단일진실로 신뢰
 */

import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import Hls from "hls.js";

import { fetchStudentVideoPlayback } from "@/student/domains/media/api/media";

type Props = {
  videoId: number;
  enrollmentId: number;
  previewMode?: "student";
};

export default function StudentVideoPlayer({
  videoId,
  enrollmentId,
}: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const playbackQ = useQuery({
    queryKey: ["student-video-playback-inner", videoId, enrollmentId],
    queryFn: () => fetchStudentVideoPlayback(videoId, enrollmentId),
    enabled: Number.isFinite(videoId),
    retry: 0,
  });

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !playbackQ.data) return;

    const { hls_url, mp4_url } = playbackQ.data;

    // ✅ HLS 우선
    if (hls_url && Hls.isSupported()) {
      const hls = new Hls();
      hls.loadSource(hls_url);
      hls.attachMedia(video);
      return () => {
        hls.destroy();
      };
    }

    // ✅ MP4 fallback
    if (mp4_url) {
      video.src = mp4_url;
    }
  }, [playbackQ.data]);

  if (playbackQ.isLoading) {
    return <div style={{ fontSize: 14, color: "#666" }}>영상 준비 중...</div>;
  }

  if (playbackQ.isError || !playbackQ.data) {
    return (
      <div style={{ fontSize: 14, color: "#c00" }}>
        재생 정보를 불러올 수 없습니다.
      </div>
    );
  }

  return (
    <video
      ref={videoRef}
      controls
      playsInline
      style={{
        width: "100%",
        borderRadius: 8,
        background: "#000",
      }}
    />
  );
}
