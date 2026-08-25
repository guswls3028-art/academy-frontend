import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import { isYouTubeSource } from "@/shared/media/video/youtube";
import type { TeacherVideo } from "../api";
import styles from "./TeacherVideoPreview.module.css";

type PlaybackState = "loading" | "ready" | "error";

type Props = {
  video: TeacherVideo;
};

function statusMessage(status?: string | null) {
  if (status === "FAILED") {
    return {
      title: "영상을 재생할 수 없습니다",
      description: "영상 처리에 실패했습니다. 영상 목록에서 재시도해 주세요.",
    };
  }
  if (status === "PROCESSING" || status === "UPLOADED" || status === "TRANSCODING") {
    return {
      title: "영상을 준비하고 있습니다",
      description: "처리가 끝나면 이 화면에서 바로 확인할 수 있습니다.",
    };
  }
  return {
    title: "재생 주소를 준비하고 있습니다",
    description: "잠시 뒤 다시 열어 주세요.",
  };
}

export default function TeacherVideoPreview({ video }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [playbackState, setPlaybackState] = useState<PlaybackState>("loading");
  const [retryKey, setRetryKey] = useState(0);
  const isReady = video.status === "READY";
  const isYoutube = isYouTubeSource(video.source_type);
  const youtubeEmbedSrc = isReady && isYoutube && video.youtube_video_id
    ? `https://www.youtube.com/embed/${encodeURIComponent(video.youtube_video_id)}?enablejsapi=1&playsinline=1&rel=0`
    : null;
  const hlsSrc = isReady && !isYoutube ? video.hls_url : null;

  useEffect(() => {
    const element = videoRef.current;
    if (!element || !hlsSrc) return;

    setPlaybackState("loading");
    const markReady = () => setPlaybackState("ready");
    const markError = () => setPlaybackState("error");
    element.addEventListener("loadedmetadata", markReady);
    element.addEventListener("canplay", markReady);
    element.addEventListener("error", markError);

    let hls: Hls | null = null;
    if (element.canPlayType("application/vnd.apple.mpegurl")) {
      element.src = hlsSrc;
    } else if (Hls.isSupported()) {
      hls = new Hls({
        startLevel: -1,
        abrEwmaDefaultEstimate: 20_000_000,
      });
      hls.on(Hls.Events.MANIFEST_PARSED, markReady);
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) markError();
      });
      hls.loadSource(hlsSrc);
      hls.attachMedia(element);
    } else {
      element.src = hlsSrc;
    }

    return () => {
      element.removeEventListener("loadedmetadata", markReady);
      element.removeEventListener("canplay", markReady);
      element.removeEventListener("error", markError);
      hls?.destroy();
      element.removeAttribute("src");
      element.load();
    };
  }, [hlsSrc, retryKey]);

  if (youtubeEmbedSrc) {
    return (
      <section className={styles.root} aria-label="선생님 영상 확인">
        <div className={styles.stage}>
          <iframe
            className={styles.media}
            src={youtubeEmbedSrc}
            title="YouTube 선생님 영상 미리보기"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        </div>
        <PreviewNotice />
      </section>
    );
  }

  if (hlsSrc) {
    return (
      <section className={styles.root} aria-label="선생님 영상 확인">
        <div className={styles.stage}>
          <video
            key={retryKey}
            ref={videoRef}
            className={styles.media}
            aria-label="선생님 영상 미리보기"
            controls
            playsInline
            preload="metadata"
            poster={video.thumbnail_url ?? undefined}
            controlsList="nodownload noremoteplayback"
          />
          {playbackState === "loading" && (
            <div className={styles.overlay} role="status">재생 준비 중…</div>
          )}
          {playbackState === "error" && (
            <div className={styles.overlay} role="alert">
              <strong>영상을 불러오지 못했습니다</strong>
              <span>네트워크 상태를 확인한 뒤 다시 시도해 주세요.</span>
              <button type="button" onClick={() => setRetryKey((value) => value + 1)}>
                다시 시도
              </button>
            </div>
          )}
        </div>
        <PreviewNotice />
      </section>
    );
  }

  const message = statusMessage(video.status);
  return (
    <section className={styles.root} aria-label="선생님 영상 확인">
      <div className={`${styles.stage} ${styles.statusStage}`} role="status">
        <span className={styles.statusDot} aria-hidden="true" />
        <strong>{message.title}</strong>
        <span>{message.description}</span>
      </div>
      <PreviewNotice />
    </section>
  );
}

function PreviewNotice() {
  return (
    <div className={styles.notice}>
      <span aria-hidden="true" />
      <strong>선생님 미리보기</strong>
      <small>학생 진도에는 반영되지 않습니다.</small>
    </div>
  );
}
