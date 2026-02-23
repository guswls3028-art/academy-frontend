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
 */
export const VIDEO_STATUS_RETRY_ALLOWED: VideoStatus[] = [
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
