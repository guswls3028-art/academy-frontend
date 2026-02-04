import AdminHlsPreview from "./AdminHlsPreview";
import VideoProcessingPreview from "./VideoProcessingPreview";

type PreviewMode = "admin" | "student";

interface Props {
  previewMode: PreviewMode;
  setPreviewMode: (v: PreviewMode) => void;
  hlsSrc: string | null;
  status: string;
  progressPercent?: number | null;
}

export default function VideoPreviewSection({
  previewMode,
  setPreviewMode,
  hlsSrc,
  status,
  progressPercent,
}: Props) {
  const isReady = status === "READY";

  return (
    <div className="rounded-lg border border-[var(--border-divider)] bg-[var(--bg-surface-soft)] p-4 space-y-4">
      {/* MODE TOGGLE */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setPreviewMode("admin")}
          className={`rounded border px-3 py-1 text-xs ${
            previewMode === "admin"
              ? "bg-[var(--bg-surface)] font-semibold"
              : "bg-[var(--bg-surface-soft)]"
          }`}
        >
          관리자 미리보기
        </button>

        <button
          onClick={() => setPreviewMode("student")}
          className={`rounded border px-3 py-1 text-xs ${
            previewMode === "student"
              ? "bg-[var(--bg-surface)] font-semibold"
              : "bg-[var(--bg-surface-soft)]"
          }`}
        >
          학생 페이지로 보기
        </button>
      </div>

      {/* PREVIEW */}
      <div className="rounded-md bg-[var(--bg-surface)] p-3">
        {isReady && previewMode === "admin" && hlsSrc ? (
          <AdminHlsPreview src={hlsSrc} />
        ) : (
          <VideoProcessingPreview
            status={status}
            percent={progressPercent}
          />
        )}
      </div>
    </div>
  );
}
