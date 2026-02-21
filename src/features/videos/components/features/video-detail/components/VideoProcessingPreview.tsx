// PATH: src/features/videos/components/features/video-detail/components/VideoProcessingPreview.tsx

import { Button } from "@/shared/ui/ds";

interface Props {
  percent?: number | null;
  status: string;
  onRetry?: () => void;
  isRetrying?: boolean;
}

export default function VideoProcessingPreview({
  percent,
  status,
  onRetry,
  isRetrying,
}: Props) {
  const safePercent =
    typeof percent === "number"
      ? Math.min(100, Math.max(0, Math.round(percent)))
      : null;

  const statusLabel =
    status === "FAILED"
      ? "처리 실패"
      : status === "UPLOADED"
        ? "업로드 완료"
        : "처리 중";

  return (
    <div className="flex flex-col items-center justify-center h-[320px] rounded-lg bg-[var(--bg-surface)] border border-[var(--border-divider)]">
      <div className="text-sm font-semibold text-[var(--text-primary)]">
        {statusLabel}
      </div>

      <div className="mt-2 text-xs text-[var(--text-muted)]">
        {status === "FAILED"
          ? "처리에 실패했습니다. 아래 버튼으로 재처리 요청을 보내세요."
          : "썸네일 생성 및 변환 진행 중"}
      </div>

      {onRetry && (
        <Button
          variant="outline"
          size="sm"
          className="mt-4"
          onClick={onRetry}
          disabled={isRetrying}
        >
          {isRetrying ? "요청 중…" : "재처리 요청"}
        </Button>
      )}

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
