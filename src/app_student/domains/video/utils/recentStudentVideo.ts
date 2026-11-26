import { getTenantUserLocalItem, setTenantUserLocalItem } from "@/shared/utils/safeLocalStorage";

const key = "student-recent-lesson-video";
const maxAge = 7 * 24 * 60 * 60 * 1000;
type UserId = string | number | undefined;
type RecentVideo = { videoId: number; sessionId: number; enrollmentId: number | null; position: number; savedAt: number };
const validId = (id: unknown): id is number => typeof id === "number" && Number.isSafeInteger(id) && id > 0;

export function rememberStudentVideo(userId: UserId, videoId: number, sessionId: number, enrollmentId: number | null, position: number) {
  if (!validId(videoId) || !validId(sessionId) || (enrollmentId !== null && !validId(enrollmentId))) return;
  setTenantUserLocalItem(key, userId, JSON.stringify({ videoId, sessionId, enrollmentId, position, savedAt: Date.now() }));
}

export function readRecentStudentVideo(userId: UserId): RecentVideo | null {
  const value = getTenantUserLocalItem(key, userId);
  if (!value) return null;
  try {
    const item: RecentVideo = JSON.parse(value);
    if (!item || !validId(item.videoId) || !validId(item.sessionId)
        || (item.enrollmentId !== null && !validId(item.enrollmentId))
        || !Number.isFinite(item.position) || item.position <= 0
        || !Number.isFinite(item.savedAt) || Date.now() - item.savedAt > maxAge) return null;
    return item;
  } catch { return null; }
}
