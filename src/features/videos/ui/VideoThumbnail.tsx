// PATH: src/features/videos/ui/VideoThumbnail.tsx

import { useEffect, useState } from "react";

type VideoStatus = "READY" | "PROCESSING" | "FAILED" | "PENDING" | "UPLOADED";

interface Props {
  title?: string;
  status?: VideoStatus;
  thumbnail_url?: string | null;
}

/**
 * ✅ SaaS 표준 Thumbnail
 * - thumbnail_url이 절대 URL이면 그대로 사용
 * - 상대 경로면 CDN BASE + default tenant 보정
 * - 실패 시 placeholder fallback
 * - 🔁 수동 재처리(캐시 무효화) 버튼
 */
export default function VideoThumbnail({ title, status, thumbnail_url }: Props) {
  const CDN_BASE = import.meta.env.VITE_MEDIA_CDN_BASE || "";

  const resolveThumbnailSrc = () => {
    if (!thumbnail_url) return null;

    // ✅ 이미 절대 URL이면 그대로
    if (thumbnail_url.startsWith("http://") || thumbnail_url.startsWith("https://")) {
      return thumbnail_url;
    }

    // ✅ 상대경로 + tenant 누락 → default 보정
    let path = thumbnail_url.replace(/^\/+/, "");

    if (path.startsWith("media/hls/videos/")) {
      // media/hls/videos/{video_id}/...  → default tenant 삽입
      path = path.replace(
        "media/hls/videos/",
        "media/hls/videos/default/videos/"
      );
    }

    return CDN_BASE ? `${CDN_BASE}/${path}` : `/${path}`;
  };

  let computedSrc = "/placeholder-video.png";

  const resolved = resolveThumbnailSrc();
  if (resolved) {
    computedSrc = resolved;
  } else if (status === "PROCESSING") {
    computedSrc = "/placeholder-processing.png";
  } else if (status === "FAILED") {
    computedSrc = "/placeholder-failed.png";
  }

  const [src, setSrc] = useState(computedSrc);

  // ✅ props 변경 시 동기화
  useEffect(() => {
    setSrc(computedSrc);
  }, [computedSrc]);

  const refreshThumbnail = () => {
    if (!resolved) return;
    const v = Date.now();
    const next =
      resolved.includes("?")
        ? `${resolved}&v=${v}`
        : `${resolved}?v=${v}`;
    setSrc(next);
  };

  return (
    <div className="aspect-video w-full overflow-hidden rounded-md bg-gray-100 shadow-sm relative">
      <img
        src={src}
        alt={title || "영상 썸네일"}
        className="h-full w-full object-cover"
        loading="lazy"
        decoding="async"
        onError={() => {
          setSrc("/placeholder-video.png");
        }}
      />

      {resolved && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            refreshThumbnail();
          }}
          className="absolute bottom-2 right-2 rounded bg-black/60 px-2 py-1 text-xs text-white hover:bg-black/80"
        >
          🔄 썸네일 새로고침
        </button>
      )}
    </div>
  );
}
