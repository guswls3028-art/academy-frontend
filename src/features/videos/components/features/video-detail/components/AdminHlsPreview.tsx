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
    <div className="rounded-lg overflow-hidden bg-black shadow">
      <video
        ref={ref}
        controls
        autoPlay
        muted
        playsInline
        className="w-full max-h-[520px] object-contain"
        controlsList="nodownload noremoteplayback"
      />
    </div>
  );
}
