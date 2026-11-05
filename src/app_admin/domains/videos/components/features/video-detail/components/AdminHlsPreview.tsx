// PATH: src/app_admin/domains/videos/components/features/video-detail/components/AdminHlsPreview.tsx

import { useEffect, useRef } from "react";
import Hls from "hls.js";
import "./AdminHlsPreview.css";

export default function AdminHlsPreview({ src }: { src: string }) {
  const ref = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;

    if (!src) {
      video.removeAttribute("src");
      video.load();
      return;
    }

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src;
      return;
    }

    if (Hls.isSupported()) {
      const hls = new Hls({
        startLevel: -1,
        abrEwmaDefaultEstimate: 20_000_000,
      });
      hls.loadSource(src);
      hls.attachMedia(video);
      return () => hls.destroy();
    }

    video.src = src;
  }, [src]);

  return (
    <div className="admin-hls-preview">
      <video
        ref={ref}
        controls
        autoPlay
        muted
        playsInline
        className="admin-hls-preview__video"
        controlsList="nodownload noremoteplayback"
      />
    </div>
  );
}
