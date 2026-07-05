// PATH: src/shared/ui/asyncStatus/asyncStatusQueryInvalidations.ts
import type { QueryClient, QueryKey } from "@tanstack/react-query";

const asyncStatusQueryKeys = {
  sessionVideos: ["session-videos"] as const,
  videoFolders: ["video-folders"] as const,
  videoStats: ["video-stats"] as const,
  videoStatsFor: (videoId: number) => ["video-stats", videoId] as const,
  lectureEnrollments: ["lecture-enrollments"] as const,
  attendanceMatrix: ["attendance-matrix"] as const,
  sessions: ["sessions"] as const,
  lecture: ["lecture"] as const,
  students: ["students"] as const,
  matchupDocuments: ["matchup-documents"] as const,
  matchupProblems: ["matchup-problems"] as const,
  adminStorageInventory: ["storage-inventory", "admin"] as const,
};

function invalidateMany(queryClient: QueryClient, queryKeys: readonly QueryKey[]) {
  queryKeys.forEach((queryKey) => {
    void queryClient.invalidateQueries({ queryKey });
  });
}

export function invalidateVideoCollections(queryClient: QueryClient) {
  invalidateMany(queryClient, [
    asyncStatusQueryKeys.sessionVideos,
    asyncStatusQueryKeys.videoFolders,
    asyncStatusQueryKeys.videoStats,
  ]);
}

export function invalidateVideoRetry(queryClient: QueryClient, videoId: number) {
  invalidateMany(queryClient, [
    asyncStatusQueryKeys.videoStatsFor(videoId),
    asyncStatusQueryKeys.sessionVideos,
  ]);
}

export function invalidateExcelSuccessCaches(queryClient: QueryClient) {
  invalidateMany(queryClient, [
    asyncStatusQueryKeys.lectureEnrollments,
    asyncStatusQueryKeys.attendanceMatrix,
    asyncStatusQueryKeys.sessions,
    asyncStatusQueryKeys.lecture,
    asyncStatusQueryKeys.students,
  ]);
}

export function invalidateExcelProgressCaches(queryClient: QueryClient) {
  invalidateMany(queryClient, [
    asyncStatusQueryKeys.students,
    asyncStatusQueryKeys.lectureEnrollments,
    asyncStatusQueryKeys.sessions,
  ]);
}

export function invalidateVideoSuccessCaches(queryClient: QueryClient) {
  invalidateMany(queryClient, [asyncStatusQueryKeys.sessionVideos]);
}

export function invalidateMatchupSuccessCaches(queryClient: QueryClient) {
  invalidateMany(queryClient, [
    asyncStatusQueryKeys.matchupDocuments,
    asyncStatusQueryKeys.matchupProblems,
    asyncStatusQueryKeys.adminStorageInventory,
  ]);
}
