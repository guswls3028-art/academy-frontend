import type { User } from "@/auth/context/AuthContext";
import { getParentStudentId } from "@/shared/api/parentStudentSelection";

export function studentVideoQueryScope(user: Pick<User, "id" | "tenantRole"> | null): string {
  const selectedStudentId = user?.tenantRole === "parent" ? getParentStudentId() : null;
  return `${user?.tenantRole ?? "anonymous"}:${user?.id ?? "none"}:${selectedStudentId ?? "self"}`;
}

export const studentVideoQueryKeys = {
  me: (scope: string) => ["student-video-me", scope] as const,
  stats: (scope: string) => ["student-video-stats", scope] as const,
  sessionVideos: (scope: string, sessionId: number | null | undefined, enrollmentId?: number | null) =>
    ["student-session-videos", scope, sessionId, enrollmentId ?? null] as const,
  playback: (scope: string, videoId: number | null | undefined, enrollmentId?: number | null) =>
    ["student-video-playback", scope, videoId, enrollmentId ?? null] as const,
  currentAccess: (scope: string, videoId: number | null | undefined, enrollmentId?: number | null) =>
    ["student-video-current-access", scope, videoId, enrollmentId ?? null] as const,
  comments: (scope: string, videoId: number) => ["video-comments", scope, videoId] as const,
};
