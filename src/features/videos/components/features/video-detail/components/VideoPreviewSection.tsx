// PATH: src/features/videos/components/features/video-detail/components/VideoPreviewSection.tsx

import AdminHlsPreview from "../components/AdminHlsPreview";

type PreviewMode = "admin" | "student";

interface Props {
  previewMode: PreviewMode;
  setPreviewMode: (v: PreviewMode) => void;
  hlsSrc: string | null;
}

export default function VideoPreviewSection({
  previewMode,
  setPreviewMode,
  hlsSrc,
}: Props) {
  return (
    <div
      className="
        rounded-lg
        border border-[var(--border-divider)]
        bg-[var(--bg-surface-soft)]
        p-4
        space-y-4
      "
    >
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
        {previewMode === "admin" && hlsSrc ? (
          <AdminHlsPreview src={hlsSrc} />
        ) : (
          <div className="text-sm text-[var(--text-muted)]">
            HLS 없음
          </div>
        )}
      </div>
    </div>
  );
}
