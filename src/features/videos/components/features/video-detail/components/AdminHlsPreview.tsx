// PATH: src/features/videos/components/features/video-detail/components/AdminHlsPreview.tsx

import { useEffect, useRef } from "react";
import Hls from "hls.js";

export default function AdminHlsPreview({ src }: { src: string }) {
  const ref = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;

    if (!src) {
      video.removeAttribute("src");
      try {
        video.load();
      } catch {}
      return;
    }

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src;
      return;
    }

    if (Hls.isSupported()) {
      const hls = new Hls();
      hls.loadSource(src);
      hls.attachMedia(video);
      return () => hls.destroy();
    }

    video.src = src;
  }, [src]);

  return (
    <div
      style={{
        borderRadius: 16,
        overflow: "hidden",
        background: "#000",
        position: "relative",
      }}
    >
      <video
        ref={ref}
        controls
        autoPlay
        muted
        playsInline
        style={{
          width: "100%",
          maxHeight: 520,
          objectFit: "contain",
          display: "block",
        }}
        controlsList="nodownload noremoteplayback"
      />
    </div>
  );
}
