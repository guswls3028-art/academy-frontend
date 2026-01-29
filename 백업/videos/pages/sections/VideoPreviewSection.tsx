// src/features/videos/pages/sections/VideoPreviewSection.tsx

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
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button
          onClick={() => setPreviewMode("admin")}
          className={`rounded border px-3 py-1 text-xs ${
            previewMode === "admin"
              ? "bg-white font-semibold"
              : "bg-gray-100"
          }`}
        >
          관리자 미리보기
        </button>

        <button
          onClick={() => setPreviewMode("student")}
          className={`rounded border px-3 py-1 text-xs ${
            previewMode === "student"
              ? "bg-white font-semibold"
              : "bg-gray-100"
          }`}
        >
          학생 페이지로 보기
        </button>
      </div>

      {previewMode === "admin" && hlsSrc ? (
        <AdminHlsPreview src={hlsSrc} />
      ) : (
        <div className="border p-4 text-sm">HLS 없음</div>
      )}
    </div>
  );
}
