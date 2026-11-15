// PATH: src/app_admin/domains/videos/components/features/video-detail/components/AdminHlsPreview.tsx

import { useEffect, useRef } from "react";
import type Hls from "hls.js";
import "./AdminHlsPreview.css";

export default function AdminHlsPreview({ src }: { src: string }) {
  const ref = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video || !src) return;

    let active = true;
    let hls: Hls | undefined;
    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src;
    } else {
      void import("hls.js").then(({ default: HlsPlayer }) => {
        if (!active) return;
        if (!HlsPlayer.isSupported()) {
          video.src = src;
          return;
        }
        hls = new HlsPlayer({
          startLevel: -1,
          abrEwmaDefaultEstimate: 20_000_000,
        });
        hls.loadSource(src);
        hls.attachMedia(video);
      }).catch(() => {
        if (!active) return;
        hls?.destroy();
        hls = undefined;
        video.src = src;
      });
    }

    return () => {
      active = false;
      hls?.destroy();
      if (video.hasAttribute("src")) {
        video.pause();
        video.removeAttribute("src");
        video.load();
      }
    };
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
