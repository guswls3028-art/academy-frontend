// PATH: src/student/domains/video/components/VideoThumbnailWrapper.tsx
// CourseCard용 VideoThumbnail 래퍼 (aspect-video 오버라이드)

import VideoThumbnail from "@/features/videos/ui/VideoThumbnail";

type Props = {
  title?: string;
  thumbnail_url?: string | null;
  status?: "READY" | "PROCESSING" | "FAILED" | "PENDING" | "UPLOADED";
};

/**
 * CourseCard용 VideoThumbnail 래퍼
 * VideoThumbnail의 aspect-video 클래스를 오버라이드하여 부모 컨테이너에 맞춤
 */
export default function VideoThumbnailWrapper({ title, thumbnail_url, status }: Props) {
  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <div
        style={{
          width: "100%",
          height: "100%",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              width: "100%",
              height: "100%",
              position: "relative",
            }}
            className="video-thumbnail-wrapper"
          >
            <style>{`
              .video-thumbnail-wrapper > div {
                aspect-ratio: unset !important;
                height: 100% !important;
                width: 100% !important;
              }
              .video-thumbnail-wrapper img {
                width: 100% !important;
                height: 100% !important;
                object-fit: cover !important;
              }
            `}</style>
            <VideoThumbnail title={title} thumbnail_url={thumbnail_url} status={status} />
          </div>
        </div>
      </div>
    </div>
  );
}
