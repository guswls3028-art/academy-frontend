// PATH: src/app_admin/domains/videos/components/features/video-detail/components/VideoProcessingPreview.tsx
// Batch-only. Backend status is source of truth.

import { Button } from "@/shared/ui/ds";
import { VIDEO_STATUS_LABEL } from "@admin/domains/videos/utils/videoStatus";
import type { VideoStatus } from "@admin/domains/videos/api/videos.api";

interface Props {
  percent?: number | null;
  status: string;
  onRetry?: () => void;
  isRetrying?: boolean;
}

const STATUS_DESC: Record<string, string> = {
  UPLOADING: "파일 업로드 중...",
  UPLOADED: "업로드 완료, 인코딩 대기 중",
  PENDING: "처리 대기 중",
  PROCESSING: "썸네일 생성 및 변환 진행 중",
  FAILED: "처리에 실패했습니다. 아래 버튼으로 재시도할 수 있습니다.",
};

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
    VIDEO_STATUS_LABEL[status as VideoStatus] ?? "처리 중";

  const description = STATUS_DESC[status] ?? "처리 중...";

  return (
    <div className="flex flex-col items-center justify-center h-[320px] rounded-lg bg-[var(--color-bg-surface)] border border-[var(--color-border-divider)]">
      <div className="text-sm font-semibold text-[var(--color-text-primary)]">
        {statusLabel}
      </div>

      <div className="mt-2 text-xs text-[var(--color-text-muted)]">
        {description}
      </div>

      {onRetry && (
        <Button
          intent="secondary"
          size="sm"
          className="mt-4"
          onClick={onRetry}
          disabled={isRetrying}
        >
          {isRetrying ? "요청 중…" : "재시도"}
        </Button>
      )}

      {/* Progress Bar */}
      <div className="mt-6 w-[260px]">
        <div className="h-2 rounded bg-[var(--color-bg-app)] overflow-hidden">
          {safePercent != null ? (
            <div
              className="h-full bg-[var(--color-primary)] transition-all"
              style={{ width: `${safePercent}%` }}
            />
          ) : (
            <div className="h-full w-full bg-[var(--color-primary)] animate-pulse opacity-60" />
          )}
        </div>

        <div className="mt-2 text-center text-xs text-[var(--color-text-secondary)]">
          {safePercent != null ? `${safePercent}%` : "진행률 계산 중..."}
        </div>
      </div>
    </div>
  );
}
