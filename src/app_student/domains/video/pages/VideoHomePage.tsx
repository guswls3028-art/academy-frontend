/**
 * 영상 홈 — 프리미엄 SaaS 인강 느낌의 코스 카드 UI
 * 공개 영상(맨위) + 강의별 코스 카드
 *
 * 성능 최적화: /student/video/me/ 응답의 video_count, total_duration,
 * thumbnail_url 요약을 사용하여 추가 API 호출 없이 카드 렌더링.
 */
import { useEffect } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { fetchVideoMe } from "../api/video.api";
import type { StudentVideoMeLecture, StudentVideoMePublic } from "../api/video.api";
import EmptyState from "@student/layout/EmptyState";
import CourseCard from "../components/CourseCard";

function PublicCourseCard({ pub }: { pub: StudentVideoMePublic }) {
  if (!pub?.video_count) return null;
  return (
    <CourseCard
      title="전체공개영상"
      thumbnailUrl={pub?.thumbnail_url ?? null}
      videoCount={pub?.video_count ?? 0}
      totalDuration={pub?.total_duration ?? 0}
      progress={0}
      isNew={false}
      isContinue={false}
      isCompleted={false}
      to="/student/video/courses/public"
    />
  );
}

function LectureCourseCard({ lecture }: { lecture: StudentVideoMeLecture }) {
  if (!lecture.video_count) return null;

  return (
    <CourseCard
      title={lecture.title}
      thumbnailUrl={lecture.thumbnail_url ?? null}
      videoCount={lecture.video_count ?? 0}
      totalDuration={lecture.total_duration ?? 0}
      progress={0}
      isNew={false}
      isContinue={false}
      isCompleted={false}
      to={`/student/video/courses/${lecture.id}`}
    />
  );
}

export default function VideoHomePage() {
  // Preload hls.js chunk for faster video playback start
  useEffect(() => {
    import("hls.js").catch(() => {});
  }, []);

  const { data: videoMe, isLoading, isError, refetch } = useQuery({
    queryKey: ["student-video-me"],
    queryFn: fetchVideoMe,
    staleTime: 60 * 1000,
    placeholderData: keepPreviousData,
  });

  const hasLectures = (videoMe?.lectures?.length ?? 0) > 0;
  const hasPublic = (videoMe?.public?.video_count ?? 0) > 0;
  const hasAny = hasLectures || hasPublic;

  if (isLoading && videoMe == null) {
    return (
      <div className="video-page-content" style={{ padding: "var(--stu-space-4)" }}>
        <div className="stu-skel" style={{ height: 200, borderRadius: "var(--stu-radius-lg)" }} />
        <div className="stu-skel" style={{ height: 200, marginTop: 16, borderRadius: "var(--stu-radius-lg)" }} />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="video-page-content" style={{ padding: "var(--stu-space-4)" }}>
        <EmptyState
          title="영상을 불러오지 못했습니다"
          description="네트워크 연결을 확인하고 잠시 후 다시 시도해 주세요."
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  if (!hasAny) {
    return (
      <div className="video-page-content" style={{ padding: "var(--stu-space-4)" }}>
        <EmptyState
          title="등록된 영상이 없습니다"
          description="공개 영상이나 수강 중인 강의의 차시 영상이 여기에 표시됩니다."
        />
      </div>
    );
  }

  return (
    <div className="video-page-content" style={{
      padding: "var(--stu-space-4)",
    }}>
      <h1
        className="video-page-title"
        style={{
          fontSize: 24,
          fontWeight: 800,
          marginBottom: "var(--stu-space-6)",
        }}
      >
        수강 가능한 강의
      </h1>

      <div
        data-guide="video-courses"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
          gap: 16,
        }}
      >
        {/* 공개 영상 코스 카드 */}
        <PublicCourseCard pub={videoMe?.public ?? null} />

        {/* 강의별 코스 카드 */}
        {(videoMe?.lectures ?? []).map((lec) => (
          <LectureCourseCard key={lec.id} lecture={lec} />
        ))}
      </div>
    </div>
  );
}
