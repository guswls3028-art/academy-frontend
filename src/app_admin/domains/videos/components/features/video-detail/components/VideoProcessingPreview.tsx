// PATH: src/app_admin/domains/videos/components/features/video-detail/components/VideoProcessingPreview.tsx
// Batch-only. Backend status is source of truth.

import { Button } from "@/shared/ui/ds";
import { VIDEO_STATUS_LABEL } from "@admin/domains/videos/utils/videoStatus";
import type { VideoStatus } from "@admin/domains/videos/api/videos.api";

interface Props {
  percent?: number | null;
  status: string;
  errorReason?: string | null;
  onRetry?: () => void;
  isRetrying?: boolean;
}

const STATUS_DESC: Record<string, string> = {
  UPLOADING: "파일 업로드 중…",
  UPLOADED: "업로드 완료 — 영상 처리 대기 중",
  PENDING: "영상 처리 대기 중",
  PROCESSING: "영상을 시청 가능한 형태로 변환 중입니다 (보통 5~30분 소요)",
  FAILED: "영상 처리에 실패했습니다. 아래 버튼으로 다시 시도할 수 있습니다.",
};

export default function VideoProcessingPreview({
  percent,
  status,
  errorReason,
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

      {status === "FAILED" && errorReason && (
        <div className="mt-2 text-xs text-[var(--color-danger)] max-w-[420px] text-center px-2">
          사유: {errorReason}
        </div>
      )}

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
          {safePercent != null ? `${safePercent}%` : "곧 시작됩니다…"}
        </div>
      </div>
    </div>
  );
}
