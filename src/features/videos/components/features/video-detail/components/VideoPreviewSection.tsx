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

  return (
    <div
      className="rounded-lg p-4"
      style={{
        border: "1px solid var(--color-border-divider)",
        background: "var(--color-bg-surface-soft)",
      }}
    >
      <div
        className="rounded-md p-3"
        style={{ background: "var(--color-bg-surface)" }}
      >
        {isReady && hlsSrc ? (
          <AdminHlsPreview src={hlsSrc} />
        ) : (
          <VideoProcessingPreview
            status={status}
            percent={progressPercent}
            onRetry={onRetry}
            isRetrying={isRetrying}
          />
        )}
      </div>
    </div>
  );
}
