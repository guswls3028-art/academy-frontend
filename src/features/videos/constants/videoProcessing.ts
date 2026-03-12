// PATH: src/features/videos/constants/videoProcessing.ts
// Batch-only video processing. Backend is the single source of truth.

import type { VideoStatus } from "../api/videos";

/**
 * Backend statuses that indicate "in progress" (not yet terminal).
 * Used only for polling — when any video has one of these, we poll.
 */
export const VIDEO_STATUS_IN_PROGRESS: VideoStatus[] = [
  "PENDING",
  "UPLOADED",
  "PROCESSING",
];

/**
 * Backend statuses for which the retry button may be shown.
 * Retry always calls API; backend returns 400 if retry is not allowed.
 * PENDING: upload-complete may have failed; retry re-runs upload-complete (requires file_key).
 */
export const VIDEO_STATUS_RETRY_ALLOWED: VideoStatus[] = [
  "PENDING",
  "FAILED",
  "PROCESSING",
  "UPLOADED",
];

export function isVideoInProgress(status: string | undefined): boolean {
  return status != null && VIDEO_STATUS_IN_PROGRESS.includes(status as VideoStatus);
}

export function isRetryAllowedByStatus(status: string | undefined): boolean {
  return status != null && VIDEO_STATUS_RETRY_ALLOWED.includes(status as VideoStatus);
}

/**
 * Retry button visibility.
 * Server-side `can_retry` is the SSOT (accounts for job state).
 * Falls back to client-side status check when can_retry is not available
 * (e.g. list endpoints that use VideoSerializer instead of VideoDetailSerializer).
 */
export function canShowRetryButton(video: {
  status?: string | null;
  file_key?: string | null;
  can_retry?: boolean;
}): boolean {
  // Server SSOT: if can_retry is explicitly provided, trust it
  if (typeof video.can_retry === "boolean") {
    return video.can_retry;
  }
  // Fallback: client-side status-only check (list views)
  if (!video.status || !VIDEO_STATUS_RETRY_ALLOWED.includes(video.status as VideoStatus)) {
    return false;
  }
  if (video.status === "PENDING") {
    return !!(video.file_key && video.file_key.trim());
  }
  return true;
}
