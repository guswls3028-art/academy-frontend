import AdminHlsPreview from "./AdminHlsPreview";
import VideoProcessingPreview from "./VideoProcessingPreview";
import { isYouTubeSource } from "@/shared/media/video/youtube";
import styles from "./VideoPreviewSection.module.css";

interface Props {
  hlsSrc: string | null;
  status: string;
  sourceType?: string | null;
  youtubeVideoId?: string | null;
  progressPercent?: number | null;
  errorReason?: string | null;
  onRetry?: () => void;
  isRetrying?: boolean;
}

export default function VideoPreviewSection({
  hlsSrc,
  status,
  sourceType,
  youtubeVideoId,
  progressPercent,
  errorReason,
  onRetry,
  isRetrying,
}: Props) {
  const isReady = status === "READY";
  const isYoutube = isYouTubeSource(sourceType);
  const youtubeEmbedSrc = isYoutube && youtubeVideoId
    ? `https://www.youtube.com/embed/${encodeURIComponent(youtubeVideoId)}?enablejsapi=1&playsinline=1&rel=0`
    : null;

  return isReady && youtubeEmbedSrc ? (
    <div className={styles.youtubeFrame}>
      <iframe
        src={youtubeEmbedSrc}
        title="YouTube video preview"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
      />
    </div>
  ) : isReady && hlsSrc ? (
    <AdminHlsPreview src={hlsSrc} />
  ) : (
    <div className={styles.processingFrame}>
      <VideoProcessingPreview
        status={status}
        percent={progressPercent}
        errorReason={errorReason}
        onRetry={onRetry}
        isRetrying={isRetrying}
      />
    </div>
  );
}
