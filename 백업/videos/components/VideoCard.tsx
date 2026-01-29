// src/features/videos/components/VideoCard.tsx

import VideoThumbnail from "./VideoThumbnail";
import VideoStatusBadge from "./VideoStatusBadge";
import { Video } from "@/features/videos/api/videos";

/**
 * ✅ SaaS 표준: CDN Base URL
 * - Vite env 기준
 * - 예: https://pub-xxxx.r2.dev
 */
const CDN_BASE_URL = import.meta.env.VITE_CDN_BASE_URL;

interface Props {
  video: Video;
  onClick?: () => void;
}

/**
 * ✅ Admin / Student 공용 VideoCard
 *
 * 썸네일 처리 규칙:
 * 1. video.thumbnail_url (최우선)
 * 2. legacy video.thumbnail + CDN_BASE_URL
 * 3. 없으면 null → VideoThumbnail 에서 placeholder 처리
 */
export default function VideoCard({ video, onClick }: Props) {
  const resolvedThumbnailUrl =
    video.thumbnail_url
      ?? (video.thumbnail
        ? `${CDN_BASE_URL}/${video.thumbnail}`
        : null);

  return (
    <div
      onClick={onClick}
      className="group cursor-pointer rounded-xl border bg-white overflow-hidden hover:shadow-md transition"
    >
      {/* Thumbnail */}
      <div className="relative">
        <VideoThumbnail
          title={video.title}
          status={video.status}
          thumbnail_url={resolvedThumbnailUrl}
        />

        {/* Status Badge */}
        <div className="absolute top-2 left-2">
          <VideoStatusBadge status={video.status} />
        </div>
      </div>

      {/* Meta */}
      <div className="p-3 space-y-1">
        <div className="text-sm font-semibold truncate">
          {video.title}
        </div>

        <div className="text-xs text-gray-500">
          {video.duration
            ? `${Math.round(video.duration)}초`
            : "길이 정보 없음"}
        </div>
      </div>
    </div>
  );
}
