// src/features/lectures/components/AdminVideoPlayer.tsx

import { useRef, useState, useCallback, useEffect } from "react";

type Rule = "free" | "once";

interface Props {
  src: string;
  rule?: Rule;
  startEndpoint?: number;
  className?: string;

  /** 이미지 워터마크 */
  showWatermark?: boolean;
  watermarkImage?: string | null; // 워터마크 이미지 파일 URL
  watermarkOpacity?: number; // 0~1 (기본 0.2)
  watermarkSize?: number; // 워터마크 타일 크기(px)
}

export default function AdminVideoPlayer({
  src,
  rule = "free",
  startEndpoint = 0,
  className = "",

  showWatermark = false,
  watermarkImage = null,
  watermarkOpacity = 0.2,
  watermarkSize = 140,
}: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const [endpoint, setEndpoint] = useState(startEndpoint || 0);
  const [speed, setSpeed] = useState(1);

  // --------------------------------------------------
  // SPEED API (외부에서 사용 가능)
  // --------------------------------------------------
  const changeSpeed = (value: number) => {
    const video = videoRef.current;
    if (!video) return;

    const newSpeed = Math.max(0.25, Math.min(value, 5));
    video.playbackRate = newSpeed;
    setSpeed(newSpeed);
  };

  // --------------------------------------------------
  // SEEK BLOCK (rule === once 일 때)
  // --------------------------------------------------
  const handleSeeking = useCallback(() => {
    const video = videoRef.current;
    if (!video || rule !== "once") return;

    // 이전에 본 지점(endpoint)보다 앞으로 못 가게 막음
    if (video.currentTime > endpoint) {
      video.currentTime = endpoint;
    }
  }, [endpoint, rule]);

  // --------------------------------------------------
  // TIME UPDATE (endpoint 갱신)
  // --------------------------------------------------
  const handleTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    if (!video || rule !== "once") return;

    if (video.currentTime > endpoint) {
      setEndpoint(video.currentTime);
    }
  }, [endpoint, rule]);

  // --------------------------------------------------
  // HOTKEYS
  // --------------------------------------------------
  const handleKeydown = useCallback(
    (e: KeyboardEvent) => {
      const video = videoRef.current;
      if (!video) return;

      // 비디오에 포커스 있을 때만
      if (document.activeElement !== video) return;

      switch (e.key) {
        case " ":
          e.preventDefault();
          video.paused ? video.play() : video.pause();
          break;

        case "ArrowRight":
          video.currentTime += e.shiftKey ? 10 : 5;
          break;

        case "ArrowLeft":
          video.currentTime -= e.shiftKey ? 10 : 5;
          break;

        case ">":
          changeSpeed(speed + 0.25);
          break;

        case "<":
          changeSpeed(speed - 0.25);
          break;
      }
    },
    [speed]
  );

  // --------------------------------------------------
  // EVENT BINDING
  // --------------------------------------------------
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.currentTime = startEndpoint || 0;

    video.addEventListener("seeking", handleSeeking);
    video.addEventListener("timeupdate", handleTimeUpdate);
    window.addEventListener("keydown", handleKeydown);

    return () => {
      video.removeEventListener("seeking", handleSeeking);
      video.removeEventListener("timeupdate", handleTimeUpdate);
      window.removeEventListener("keydown", handleKeydown);
    };
  }, [startEndpoint, handleSeeking, handleTimeUpdate, handleKeydown]);

  // --------------------------------------------------
  // WATERMARK STYLE
  // --------------------------------------------------
  const overlayStyle = watermarkImage
    ? {
        opacity: Math.max(0, Math.min(1, watermarkOpacity)),
        backgroundImage: `url(${watermarkImage})`,
        backgroundSize: `${watermarkSize}px ${watermarkSize}px`,
        backgroundRepeat: "repeat",
        backgroundPosition: "0 0",
      }
    : {};

  // --------------------------------------------------
  // UI
  // --------------------------------------------------
  return (
    <div className={`space-y-3 ${className}`}>
      {/* WRAPPER */}
      <div className="w-full flex justify-center">
        <div className="relative w-full max-w-3xl rounded-lg overflow-hidden bg-black shadow">

          {/* VIDEO */}
          <video
            ref={videoRef}
            src={src}
            controls
            autoPlay
            muted
            preload="metadata"
            playsInline
            className="w-full h-auto select-none"
            controlsList="nodownload noremoteplayback"
          />

          {/* IMAGE WATERMARK */}
          {showWatermark && watermarkImage && (
            <div
              className="pointer-events-none absolute inset-0 select-none"
              style={{
                ...overlayStyle,
                transform: "rotate(-20deg)",
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
