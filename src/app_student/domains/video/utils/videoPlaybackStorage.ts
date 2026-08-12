import {
  getLocalItem,
  getTenantUserLocalKey,
  removeLocalItem,
  setLocalItem,
} from "@/shared/utils/safeLocalStorage";

const POSITION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

type PlaybackStorageScope = {
  userId: string | number | null | undefined;
  enrollmentId: number | null;
};

function enrollmentScope(enrollmentId: number | null): string {
  return enrollmentId == null ? "self" : String(enrollmentId);
}

export function getStudentCurrentVideoStorageKey(
  scope: PlaybackStorageScope,
): string | null {
  return getTenantUserLocalKey(
    `student-current-video:enrollment:${enrollmentScope(scope.enrollmentId)}`,
    scope.userId,
  );
}

function getVideoPositionStorageKey(
  videoId: number | null,
  scope: PlaybackStorageScope,
): string | null {
  if (!videoId) return null;
  return getTenantUserLocalKey(
    `student-video-position:${videoId}:enrollment:${enrollmentScope(scope.enrollmentId)}`,
    scope.userId,
  );
}

export function getStoredVideoPosition(
  videoId: number | null,
  scope: PlaybackStorageScope,
): number {
  const key = getVideoPositionStorageKey(videoId, scope);
  if (!key) return 0;
  try {
    const raw = getLocalItem(key);
    if (!raw) return 0;
    const parsed = JSON.parse(raw) as { pos?: unknown; ts?: unknown };
    const timestamp = Number(parsed.ts);
    const position = Number(parsed.pos);
    if (!Number.isFinite(timestamp) || Date.now() - timestamp > POSITION_MAX_AGE_MS) {
      removeLocalItem(key);
      return 0;
    }
    return Number.isFinite(position) && position > 0 ? position : 0;
  } catch {
    return 0;
  }
}

export function storeVideoPosition(
  videoId: number | null,
  position: number,
  scope: PlaybackStorageScope,
): void {
  const key = getVideoPositionStorageKey(videoId, scope);
  if (!key || !Number.isFinite(position) || position < 1) return;
  setLocalItem(key, JSON.stringify({
    pos: Math.round(position),
    ts: Date.now(),
  }));
}
