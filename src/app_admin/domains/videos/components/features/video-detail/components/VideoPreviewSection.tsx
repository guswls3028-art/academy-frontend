import AdminHlsPreview from "./AdminHlsPreview";
import VideoProcessingPreview from "./VideoProcessingPreview";

interface Props {
  hlsSrc: string | null;
  status: string;
  progressPercent?: number | null;
  onRetry?: () => void;
  isRetrying?: boolean;
}

export default function VideoPreviewSection({
  hlsSrc,
  status,
  progressPercent,
  onRetry,
  isRetrying,
}: Props) {
  const isReady = status === "READY";

  return isReady && hlsSrc ? (
    <AdminHlsPreview src={hlsSrc} />
  ) : (
    <div
      style={{
        borderRadius: 16,
        overflow: "hidden",
        background: "var(--color-bg-surface-soft)",
      }}
    >
      <VideoProcessingPreview
        status={status}
        percent={progressPercent}
        onRetry={onRetry}
        isRetrying={isRetrying}
      />
    </div>
  );
}
