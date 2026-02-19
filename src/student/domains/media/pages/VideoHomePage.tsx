/**
 * 영상 홈 — 프리미엄 SaaS 인강 느낌의 코스 카드 UI
 * 전체공개영상(맨위) + 강의별 코스 카드
 */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchVideoMe, fetchStudentSessionVideos } from "../api/media";
import EmptyState from "@/student/shared/ui/layout/EmptyState";
import CourseCard from "../components/CourseCard";

// 전체공개영상 세션용 코스 카드 데이터 계산
function usePublicCourseCard(publicSession: { session_id: number } | null) {
  const { data: videosData } = useQuery({
    queryKey: ["student-session-videos", publicSession?.session_id, null],
    queryFn: () => fetchStudentSessionVideos(publicSession!.session_id, null),
    enabled: !!publicSession?.session_id,
  });

  return useMemo(() => {
    if (!videosData?.items || videosData.items.length === 0) return null;
    
    const videos = videosData.items;
    const totalDuration = videos.reduce((sum, v) => sum + ((v as { duration?: number }).duration ?? 0), 0);
    const firstVideo = videos[0];
    
    return {
      title: "전체공개영상",
      thumbnailUrl: firstVideo.thumbnail_url,
      videoCount: videos.length,
      totalDuration,
      progress: 0, // TODO: 진행률 계산
      isNew: false,
      isContinue: false,
      isCompleted: false,
      to: `/student/video/play?video=${firstVideo.id}`,
    };
  }, [videosData]);
}

// 강의별 코스 카드 컴포넌트 (hook을 컴포넌트 내부에서 호출)
function LectureCourseCard({ lecture }: { lecture: { id: number; title: string; sessions: Array<{ id: number }> } }) {
  const sessionIds = lecture.sessions.map((s) => s.id);
  const sessionQueries = useQuery({
    queryKey: ["student-lecture-videos", lecture.id],
    queryFn: async () => {
      const allVideos: Array<{ duration?: number; thumbnail_url?: string | null; id: number }> = [];
      for (const sessionId of sessionIds) {
        const res = await fetchStudentSessionVideos(sessionId, null);
        allVideos.push(...res.items);
      }
      return allVideos;
    },
    enabled: sessionIds.length > 0,
  });

  const cardData = useMemo(() => {
    if (!sessionQueries.data || sessionQueries.data.length === 0) return null;
    
    const videos = sessionQueries.data;
    const totalDuration = videos.reduce((sum, v) => sum + (v.duration ?? 0), 0);
    const firstVideo = videos[0];
    
    return {
      title: lecture.title,
      thumbnailUrl: firstVideo.thumbnail_url,
      videoCount: videos.length,
      totalDuration,
      progress: 0, // TODO: 진행률 계산
      isNew: false,
      isContinue: false,
      isCompleted: false,
      to: `/student/video/play?video=${firstVideo.id}`,
    };
  }, [lecture, sessionQueries.data]);

  if (!cardData) return null;

  return (
    <CourseCard
      title={cardData.title}
      thumbnailUrl={cardData.thumbnailUrl}
      videoCount={cardData.videoCount}
      totalDuration={cardData.totalDuration}
      progress={cardData.progress}
      isNew={cardData.isNew}
      isContinue={cardData.isContinue}
      isCompleted={cardData.isCompleted}
      to={cardData.to}
    />
  );
}

export default function VideoHomePage() {
  const { data: videoMe, isLoading, isError } = useQuery({
    queryKey: ["student-video-me"],
    queryFn: fetchVideoMe,
  });

  const publicCard = usePublicCourseCard(videoMe?.public ?? null);

  const hasPublic = !!videoMe?.public?.session_id;
  const hasLectures = (videoMe?.lectures?.length ?? 0) > 0;
  const hasAny = hasPublic || hasLectures;

  if (isLoading) {
    return (
      <div style={{ padding: "var(--stu-space-4)" }}>
        <div className="stu-skel" style={{ height: 200, borderRadius: "var(--stu-radius-lg)" }} />
        <div className="stu-skel" style={{ height: 200, marginTop: 16, borderRadius: "var(--stu-radius-lg)" }} />
      </div>
    );
  }

  if (isError || !hasAny) {
    return (
      <div style={{ padding: "var(--stu-space-4)" }}>
        <EmptyState
          title="등록된 영상이 없습니다"
          description="전체공개 영상이나 수강 중인 강의의 차시 영상이 여기에 표시됩니다."
        />
      </div>
    );
  }

  return (
    <div style={{ padding: "var(--stu-space-4)" }}>
      <h1
        style={{
          fontSize: 24,
          fontWeight: 800,
          marginBottom: "var(--stu-space-6)",
          color: "var(--stu-text)",
        }}
      >
        수강 가능한 강의
      </h1>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
          gap: 16,
        }}
      >
        {/* 전체공개영상 코스 카드 */}
        {publicCard && (
          <CourseCard
            title={publicCard.title}
            thumbnailUrl={publicCard.thumbnailUrl}
            videoCount={publicCard.videoCount}
            totalDuration={publicCard.totalDuration}
            progress={publicCard.progress}
            isNew={publicCard.isNew}
            isContinue={publicCard.isContinue}
            isCompleted={publicCard.isCompleted}
            to={publicCard.to}
          />
        )}

        {/* 강의별 코스 카드 */}
        {(videoMe?.lectures ?? []).map((lec) => (
          <LectureCourseCard key={lec.id} lecture={lec} />
        ))}
      </div>
    </div>
  );
}
