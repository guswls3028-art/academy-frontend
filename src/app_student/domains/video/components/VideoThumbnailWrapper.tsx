// PATH: src/app_student/domains/video/components/VideoThumbnailWrapper.tsx
// CourseCard용 VideoThumbnail 래퍼 (aspect-video 오버라이드)

import VideoThumbnail from "@/shared/media/video/VideoThumbnail";

import styles from "./VideoThumbnailWrapper.module.css";

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
    <div className={styles.root}>
      <VideoThumbnail title={title} thumbnail_url={thumbnail_url} status={status} />
    </div>
  );
}
