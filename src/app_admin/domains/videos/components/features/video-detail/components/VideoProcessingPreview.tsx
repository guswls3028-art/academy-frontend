// PATH: src/app_admin/domains/videos/components/features/video-detail/components/VideoProcessingPreview.tsx
// Batch-only. Backend status is source of truth.

import { Button } from "@/shared/ui/ds";
import { VIDEO_STATUS_LABEL } from "@admin/domains/videos/utils/videoStatus";
import type { VideoStatus } from "@admin/domains/videos/api/videos.api";
import styles from "./VideoProcessingPreview.module.css";

interface Props {
  percent?: number | null;
  status: string;
  errorReason?: string | null;
  onRetry?: () => void;
  isRetrying?: boolean;
}

const STATUS_DESC: Record<string, string> = {
  UPLOADING: "파일 업로드 중…",
  PENDING: "파일 업로드가 끝나면 인코딩이 시작됩니다.",
  UPLOADED: "원본 업로드 완료 — 인코딩 작업 배정 중",
  PROCESSING: "영상을 시청 가능한 형태로 인코딩 중입니다. 긴 영상은 시간이 걸릴 수 있습니다.",
  FAILED: "영상 처리에 실패했습니다. 아래 버튼으로 다시 시도할 수 있습니다.",
};

function getDescription(status: string, errorReason?: string | null) {
  if (status === "FAILED" && errorReason?.includes("source_not_found_or_empty")) {
    return "원본 업로드 파일을 찾지 못했습니다. 삭제 후 다시 업로드해 주세요.";
  }
  return STATUS_DESC[status] ?? "처리 중...";
}

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

  const description = getDescription(status, errorReason);

  return (
    <div className={styles.root}>
      <div className={styles.statusLabel}>{statusLabel}</div>

      <div className={styles.description}>{description}</div>

      {status === "FAILED" && errorReason && (
        <div className={styles.errorReason}>사유: {errorReason}</div>
      )}

      {onRetry && (
        <Button
          intent="secondary"
          size="sm"
          className={styles.retryButton}
          onClick={onRetry}
          disabled={isRetrying}
        >
          {isRetrying ? "요청 중…" : "재시도"}
        </Button>
      )}

      {/* Progress Bar */}
      <div className={styles.progressWrap}>
        <div className={styles.progressTrack}>
          {safePercent != null ? (
            <progress
              className={styles.progressBar}
              max={100}
              value={safePercent}
              aria-label="영상 처리 진행률"
            />
          ) : (
            <div
              className={styles.progressIndeterminate}
              role="progressbar"
              aria-label="영상 처리 대기 중"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuetext="곧 시작됩니다"
            />
          )}
        </div>

        <div className={styles.progressText}>
          {safePercent != null ? `${safePercent}%` : "곧 시작됩니다…"}
        </div>
      </div>
    </div>
  );
}
