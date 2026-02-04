// PATH: src/features/videos/components/features/video-detail/components/VideoProcessingPreview.tsx

interface Props {
  percent?: number | null;
  status: string;
}

export default function VideoProcessingPreview({ percent, status }: Props) {
  const safePercent =
    typeof percent === "number"
      ? Math.min(100, Math.max(0, Math.round(percent)))
      : null;

  return (
    <div className="flex flex-col items-center justify-center h-[320px] rounded-lg bg-[var(--bg-surface)] border border-[var(--border-divider)]">
      <div className="text-sm font-semibold text-[var(--text-primary)]">
        {status === "UPLOADED" ? "업로드 완료" : "영상 처리 중"}
      </div>

      <div className="mt-2 text-xs text-[var(--text-muted)]">
        썸네일 생성 및 인코딩 진행 중
      </div>

      {/* Progress Bar */}
      <div className="mt-6 w-[260px]">
        <div className="h-2 rounded bg-[var(--bg-app)] overflow-hidden">
          <div
            className="h-full bg-[var(--color-primary)] transition-all"
            style={{
              width: `${safePercent ?? 0}%`,
            }}
          />
        </div>

        <div className="mt-2 text-center text-xs text-[var(--text-secondary)]">
          {safePercent != null ? `${safePercent}%` : "진행률 계산 중..."}
        </div>
      </div>
    </div>
  );
}
