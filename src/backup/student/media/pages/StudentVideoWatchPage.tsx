// src/student/media/pages/StudentVideoWatchPage.tsx
import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import Hls from "hls.js";
import { playVideoFacade } from "@/student/media/playback/api/media";
import { getDeviceId } from "@/student/media/playback/utils/deviceId";

export default function StudentVideoWatchPage() {
  const { videoId } = useParams();
  const id = Number(videoId);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);

  const [playUrl, setPlayUrl] = useState("");
  const [err, setErr] = useState("");

  // 1️⃣ play facade (세션 + 쿠키 발급용)
  useEffect(() => {
    if (!id) return;

    (async () => {
      try {
        const res = await playVideoFacade(id, getDeviceId());
        setPlayUrl(res.play_url);
      } catch (e: any) {
        setErr(e?.response?.data?.detail || "play_failed");
      }
    })();
  }, [id]);

  // 2️⃣ HLS attach (🍪 Signed Cookie 기반)
  useEffect(() => {
    if (!playUrl || !videoRef.current) return;

    // 기존 HLS 정리
    hlsRef.current?.destroy();
    hlsRef.current = null;

    const video = videoRef.current;

    // ✅ Safari 판별 (중요)
    const isSafari =
      /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

    // ✅ Safari / iOS만 네이티브 HLS 허용
    if (isSafari && video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = playUrl; // 쿠키 자동 포함
      return;
    }

    // ✅ Chrome / Edge / Firefox → HLS.js 강제
    if (Hls.isSupported()) {
      const hls = new Hls(); // ❌ Authorization 헤더 절대 넣지 말 것

      hls.loadSource(playUrl);
      hls.attachMedia(video);

      hlsRef.current = hls;
    }
  }, [playUrl]);

  if (err) {
    return <div className="p-4 text-red-600">재생 실패: {err}</div>;
  }

  if (!playUrl) {
    return <div className="p-4">재생 준비중...</div>;
  }

  return (
    <video
      ref={videoRef}
      controls
      autoPlay
      playsInline
      className="w-full bg-black"
      style={{ maxWidth: 900 }}
    />
  );
}
