// PATH: src/student/domains/media/pages/MediaPlayerPage.tsx
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import StudentPageShell from "@/student/shared/components/StudentPageShell";
import EmptyState from "@/student/shared/components/EmptyState";

import {
  fetchStudentSessionVideos,
  fetchStudentVideoPlayback,
  StudentVideoListItem,
} from "@/student/domains/media/api/media";

// ✅ alias 사용 ❌ → 상대경로 고정
import StudentVideoPlayer from "../../../media/playback/player/StudentVideoPlayer";

export default function MediaPlayerPage() {
  const [sp] = useSearchParams();
  const sessionId = Number(sp.get("session"));
  const enrollmentId: number | null = null;

  const [selectedVideoId, setSelectedVideoId] = useState<number | null>(null);

  const listQ = useQuery({
    queryKey: ["student-session-videos", sessionId],
    queryFn: () => fetchStudentSessionVideos(sessionId, enrollmentId),
    enabled: Number.isFinite(sessionId),
  });

  const videos: StudentVideoListItem[] = listQ.data?.items ?? [];

  const activeVideoId = useMemo(() => {
    if (selectedVideoId) return selectedVideoId;
    return videos.length ? videos[0].id : null;
  }, [selectedVideoId, videos]);

  const playbackQ = useQuery({
    queryKey: ["student-video-playback", activeVideoId],
    queryFn: () => fetchStudentVideoPlayback(activeVideoId!, enrollmentId),
    enabled: !!activeVideoId,
  });

  if (!Number.isFinite(sessionId)) {
    return (
      <StudentPageShell title="영상">
        <EmptyState title="session 파라미터 오류" />
      </StudentPageShell>
    );
  }

  if (listQ.isLoading) {
    return (
      <StudentPageShell title="영상">
        <div>불러오는 중...</div>
      </StudentPageShell>
    );
  }

  if (!videos.length) {
    return (
      <StudentPageShell title="영상">
        <EmptyState title="영상이 없습니다." />
      </StudentPageShell>
    );
  }

  return (
    <StudentPageShell title="영상">
      {playbackQ.isError ? (
        <EmptyState title="재생 불가 (권한 또는 403)" />
      ) : activeVideoId ? (
        <StudentVideoPlayer
          videoId={activeVideoId}
          enrollmentId={enrollmentId ?? -1}
          previewMode="student"
        />
      ) : (
        <EmptyState title="선택된 영상 없음" />
      )}
    </StudentPageShell>
  );
}
