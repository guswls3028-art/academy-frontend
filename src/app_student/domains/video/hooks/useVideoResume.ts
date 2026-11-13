import { useCallback, useMemo, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getTenantCodeForApiRequest } from "@/shared/tenant";
import { updateVideoProgress, type StudentSessionVideosResponse, type StudentVideoPlayback } from "../api/video.api";
import { studentVideoQueryKeys } from "../queryKeys";
import { getVideoResumePosition, storeVideoPosition } from "../utils/videoPlaybackStorage";

type ProgressPayload = Parameters<typeof updateVideoProgress>[1];

export function useVideoResume({
  userId, queryScope, videoId, enrollmentId, effectiveEnrollmentId,
  sessionId, isDirectAccess, playbackData, serverPosition,
}: {
  userId: string | number | undefined;
  queryScope: string;
  videoId: number | null;
  enrollmentId: number | null;
  effectiveEnrollmentId: number | null;
  sessionId: number | null;
  isDirectAccess: boolean;
  playbackData: StudentVideoPlayback | undefined;
  serverPosition: number;
}) {
  const queryClient = useQueryClient();
  const progressOwner = JSON.stringify([getTenantCodeForApiRequest(), queryScope]);
  const progressOwnerRef = useRef(progressOwner);
  progressOwnerRef.current = progressOwner;

  const resumeStorageScope = useMemo(() => ({
    userId,
    enrollmentId: effectiveEnrollmentId,
  }), [effectiveEnrollmentId, userId]);
  const legacyRetryPosition = useRef<{ key: string; position: number } | null>(null);
  const playbackIdentity = JSON.stringify([queryScope, videoId, effectiveEnrollmentId]);
  const initialPosition = getVideoResumePosition(
    videoId, resumeStorageScope,
    playbackData?.progress_revision === undefined && legacyRetryPosition.current?.key === playbackIdentity
      ? legacyRetryPosition.current.position
      : serverPosition,
    playbackData?.progress_revision, isDirectAccess,
  );

  const progressMutation = useMutation({
    mutationFn: ({ data, target }: {
      data: ProgressPayload;
      target: {
        videoId: number;
        enrollmentId: number;
        requestedEnrollmentId: number | null;
        sessionId: number | null;
        queryScope: string;
        baseRevision: string | null | undefined;
        acknowledge?: () => void;
      };
    }) => updateVideoProgress(target.videoId, data, target.enrollmentId),
    onSuccess: (confirmed, { target }) => {
      if (confirmed.video_id !== target.videoId || confirmed.enrollment_id !== target.enrollmentId || confirmed.id <= 0) return;
      target.acknowledge?.();
      const playbackKey = studentVideoQueryKeys.playback(target.queryScope, target.videoId, target.requestedEnrollmentId);
      queryClient.setQueryData<StudentVideoPlayback>(playbackKey, (current) => {
        if (!current || current.progress_revision !== target.baseRevision) return current;
        return {
          ...current,
          progress_revision: confirmed.progress_revision,
          video: { ...current.video, last_position: confirmed.last_position },
        };
      });
      void queryClient.invalidateQueries({ queryKey: studentVideoQueryKeys.stats(target.queryScope) });
      if (target.sessionId == null) return;
      const key = studentVideoQueryKeys.sessionVideos(target.queryScope, target.sessionId, target.enrollmentId);
      const progress = Number.isFinite(confirmed.progress_percent)
        ? confirmed.progress_percent
        : confirmed.progress;
      queryClient.setQueryData<StudentSessionVideosResponse>(key, (current) => current ? {
        ...current,
        items: current.items.map((item) => item.id === target.videoId ? {
          ...item,
          progress,
          completed: confirmed.completed,
          last_position: confirmed.last_position,
        } : item),
      } : current);
    },
  });

  const saveProgress = progressMutation.mutate;

  const onLeaveProgress = useCallback(
    (data: ProgressPayload) => {
      if (!videoId || data.last_position == null || progressOwnerRef.current !== progressOwner) return;
      if (isDirectAccess) {
        storeVideoPosition(videoId, data.last_position, resumeStorageScope);
      } else if (effectiveEnrollmentId) {
        const key = studentVideoQueryKeys.playback(queryScope, videoId, enrollmentId);
        const revision = queryClient.getQueryData<StudentVideoPlayback>(key)?.progress_revision;
        if (revision === undefined) legacyRetryPosition.current = { key: playbackIdentity, position: data.last_position };
        const acknowledge = storeVideoPosition(videoId, data.last_position, resumeStorageScope, revision);
        saveProgress({ data, target: {
          videoId, enrollmentId: effectiveEnrollmentId, requestedEnrollmentId: enrollmentId,
          sessionId, queryScope, baseRevision: revision, acknowledge,
        } });
      }
    },
    [effectiveEnrollmentId, enrollmentId, isDirectAccess, playbackIdentity, progressOwner, queryClient, queryScope, resumeStorageScope, saveProgress, sessionId, videoId]
  );

  return { initialPosition, onLeaveProgress, playbackIdentity };
}
