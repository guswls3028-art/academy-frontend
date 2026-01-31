// PATH: src/features/videos/ui/VideoThumbnail.tsx

type VideoStatus = "READY" | "PROCESSING" | "FAILED" | "PENDING" | "UPLOADED";

interface Props {
  title?: string;
  status?: VideoStatus;
  thumbnail_url?: string | null;
}

/**
 * ✅ SaaS 표준 Thumbnail
 * - thumbnail_url이 절대 URL이면 그대로 사용
 * - 가공 ❌
 * - 실패 시 placeholder fallback
 */
export default function VideoThumbnail({ title, status, thumbnail_url }: Props) {
  let src = "/placeholder-video.png";

  if (thumbnail_url) {
    src = thumbnail_url;
  } else if (status === "PROCESSING") {
    src = "/placeholder-processing.png";
  } else if (status === "FAILED") {
    src = "/placeholder-failed.png";
  }

  return (
    <div className="aspect-video w-full overflow-hidden rounded-md bg-gray-100 shadow-sm">
      <img
        src={src}
        alt={title || "영상 썸네일"}
        className="h-full w-full object-cover"
        loading="lazy"
        decoding="async"
        onError={(e) => {
          const img = e.currentTarget;
          if (img.src.includes("placeholder")) return;
          img.src = "/placeholder-video.png";
        }}
      />
    </div>
  );
}
