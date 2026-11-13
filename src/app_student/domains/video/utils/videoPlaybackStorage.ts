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

export function getVideoResumePosition(
  videoId: number | null,
  scope: PlaybackStorageScope,
  serverPosition: number,
  serverRevision: string | null | undefined,
  localOnly: boolean,
): number {
  const fallback = localOnly ? 0 : serverPosition;
  const key = getVideoPositionStorageKey(videoId, scope);
  if (!key) return fallback;
  try {
    const raw = getLocalItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as { pos?: unknown; ts?: unknown; baseRevision?: unknown };
    const timestamp = Number(parsed.ts);
    const position = Number(parsed.pos);
    if (!Number.isFinite(timestamp) || Date.now() - timestamp > POSITION_MAX_AGE_MS) {
      removeLocalItem(key);
      return fallback;
    }
    if (!localOnly && (serverRevision === undefined || parsed.baseRevision !== serverRevision)) return fallback;
    return Number.isFinite(position) && position >= 0 ? position : fallback;
  } catch {
    return fallback;
  }
}

export function storeVideoPosition(
  videoId: number | null,
  position: number,
  scope: PlaybackStorageScope,
  baseRevision?: string | null,
): (() => void) | undefined {
  const key = getVideoPositionStorageKey(videoId, scope);
  if (!key || !Number.isFinite(position) || position < 0) return;
  const raw = JSON.stringify({
    pos: Math.round(position),
    ts: Date.now(),
    baseRevision,
  });
  setLocalItem(key, raw);
  return () => {
    if (getLocalItem(key) === raw) removeLocalItem(key);
  };
}
