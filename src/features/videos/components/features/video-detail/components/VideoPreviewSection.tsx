import AdminHlsPreview from "./AdminHlsPreview";
import AdminStudentVideoPreview from "./AdminStudentVideoPreview";
import VideoProcessingPreview from "./VideoProcessingPreview";

type PreviewMode = "admin" | "student";

interface Props {
  videoId: number;
  previewMode: PreviewMode;
  setPreviewMode: (v: PreviewMode) => void;
  hlsSrc: string | null;
  status: string;
  progressPercent?: number | null;
  onRetry?: () => void;
  isRetrying?: boolean;
  selectedEnrollmentId?: number | null;
}

export default function VideoPreviewSection({
  videoId,
  previewMode,
  setPreviewMode,
  hlsSrc,
  status,
  progressPercent,
  onRetry,
  isRetrying,
  selectedEnrollmentId,
}: Props) {
  const isReady = status === "READY";

  return (
    <div
      className="rounded-lg p-4 space-y-4"
      style={{
        border: "1px solid var(--color-border-divider)",
        background: "var(--color-bg-surface-soft)",
      }}
    >
      {/* MODE TOGGLE */}
      <div className="flex items-center gap-2">
        {(["admin", "student"] as PreviewMode[]).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => setPreviewMode(mode)}
            style={{
              borderRadius: 6,
              border: "1px solid var(--color-border-divider)",
              padding: "4px 12px",
              fontSize: 12,
              cursor: "pointer",
              background:
                previewMode === mode
                  ? "var(--color-bg-surface)"
                  : "var(--color-bg-surface-soft)",
              fontWeight: previewMode === mode ? 600 : 400,
              color: "var(--color-text-primary)",
            }}
          >
            {mode === "admin" ? "관리자 미리보기" : "학생 페이지로 보기"}
          </button>
        ))}
      </div>

      {/* PREVIEW */}
      <div
        className="rounded-md p-3"
        style={{ background: "var(--color-bg-surface)" }}
      >
        {isReady && previewMode === "admin" && hlsSrc ? (
          <AdminHlsPreview src={hlsSrc} />
        ) : isReady && previewMode === "student" ? (
          <AdminStudentVideoPreview
            videoId={videoId}
            enrollmentId={selectedEnrollmentId}
          />
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
