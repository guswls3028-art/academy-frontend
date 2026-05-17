/**
 * 수업 상세 페이지 — 상단에 수업 정보, 하단에 차시별 박스 (작은 썸네일 구조)
 */
import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { useParams, useNavigate, useLocation, Link } from "react-router-dom";
import { useQuery, useQueries } from "@tanstack/react-query";
import {
  fetchVideoMe,
  fetchStudentSessionVideos,
  type StudentSessionVideosResponse,
} from "../api/video.api";
import EmptyState from "@student/layout/EmptyState";
import StudentPageShell from "@student/shared/ui/pages/StudentPageShell";
import { IconChevronRight, IconPlay } from "@student/shared/ui/icons/Icons";
import { formatDuration } from "../utils/format";

function progressWidthStyle(value: number): CSSProperties {
  return { "--video-progress": `${Math.min(Math.max(value, 0), 100)}%` } as CSSProperties;
}

// 차시별 박스 컴포넌트 — pure presentational (데이터는 부모에서 주입)
function SessionBox({
  sessionId,
  sessionTitle,
  enrollmentId,
  order,
  isPublic,
  videosData,
  isLoading,
  courseTitle,
}: {
  sessionId: number;
  sessionTitle: string;
  enrollmentId?: number | null;
  order: number;
  isPublic?: boolean;
  videosData?: StudentSessionVideosResponse;
  isLoading?: boolean;
  courseTitle?: string;
}) {
  const sessionData = useMemo(() => {
    if (!videosData?.items || videosData.items.length === 0) return null;

    const videos = videosData.items;
    const firstVideo = videos[0];
    const totalDuration = videos.reduce((sum, v) => sum + (v.duration ?? 0), 0);

    // 진행률 계산: 백엔드에서 받은 progress 사용
    // 완료된 영상 수 / 전체 영상 수로 세션 전체 진행률 계산
    const completedVideos = videos.filter((v) => (v.progress ?? 0) >= 100 || v.completed).length;
    const progress = videos.length > 0 ? Math.round((completedVideos / videos.length) * 100) : 0;

    return {
      thumbnailUrl: firstVideo.thumbnail_url,
      videoCount: videos.length,
      totalDuration,
      firstVideoId: firstVideo.id,
      progress, // 0-100
    };
  }, [videosData]);

  if (isLoading) {
    return <div className="stu-skel video-card-skeleton" aria-label={`${sessionTitle} 불러오는 중`} />;
  }

  if (!sessionData) {
    return (
      <div className="video-card video-card--disabled">
        <div className="video-thumb video-thumb--placeholder">
          <span className="video-play-orb" aria-hidden="true">
            <IconPlay className="video-play-orb__icon" />
          </span>
        </div>
        <div className="video-card__body">
          <div className="video-card__kicker">{isPublic ? "공개 강의" : `${order}차시`}</div>
          <div className="video-card__title">{sessionTitle}</div>
          <div className="video-card__meta">
            <span className="video-card__meta-item">아직 재생 가능한 항목이 없습니다</span>
          </div>
        </div>
      </div>
    );
  }

  const progressLabel =
    sessionData.progress >= 100
      ? "완료"
      : sessionData.progress > 0
        ? `${sessionData.progress}% 진행`
        : "새로 시작";

  return (
    <Link
      to={`/student/video/sessions/${sessionId}${enrollmentId ? `?enrollment=${enrollmentId}` : ""}`}
      state={{ sessionTitle, courseTitle, order, isPublic }}
      className="video-card"
    >
      <div className={`video-thumb${sessionData.thumbnailUrl ? "" : " video-thumb--placeholder"}`}>
        {sessionData.thumbnailUrl ? (
          <img
            src={sessionData.thumbnailUrl}
            alt={sessionTitle}
            loading="lazy"
          />
        ) : (
          <span className="video-play-orb" aria-hidden="true">
            <IconPlay className="video-play-orb__icon" />
          </span>
        )}

        {sessionData.videoCount > 0 && (
          <span className="video-thumb-badge" aria-label={`영상 ${sessionData.videoCount}개`}>
            <IconPlay className="video-thumb-badge__icon" aria-hidden="true" />
            {sessionData.videoCount}
          </span>
        )}

        {sessionData.progress > 0 && (
          <div className="video-progress-track" aria-hidden="true">
            <div className="video-progress-fill" style={progressWidthStyle(sessionData.progress)} />
          </div>
        )}
      </div>

      <div className="video-card__body">
        <div className="video-card__kicker">{isPublic ? "공개 강의" : `${order}차시`}</div>
        <div className="video-card__title">{sessionTitle}</div>
        <div className="video-card__meta">
          <span className="video-card__meta-item">영상 {sessionData.videoCount}개</span>
          {sessionData.totalDuration > 0 && (
            <span className="video-card__meta-item">{formatDuration(sessionData.totalDuration)}</span>
          )}
          <span className="video-card__meta-item">{progressLabel}</span>
        </div>
        <div className="video-card__cta">
          <span>차시 보기</span>
          <IconChevronRight className="video-card__cta-icon" aria-hidden="true" />
        </div>
      </div>
    </Link>
  );
}

export default function CourseDetailPage() {
  const { lectureId } = useParams<{ lectureId?: string }>();
  const location = useLocation();
  const nav = useNavigate();
  // 공개 영상: 정적 라우트 video/courses/public 또는 pathname에 courses/public 포함 시
  const pathname = location.pathname.replace(/\/$/, "");
  const isPublic =
    lectureId === "public" ||
    pathname.endsWith("video/courses/public") ||
    pathname.includes("/video/courses/public");
  const lectureIdNum = isPublic ? null : (lectureId ? parseInt(lectureId, 10) : null);

  const { data: videoMe, isLoading, refetch } = useQuery({
    queryKey: ["student-video-me"],
    queryFn: fetchVideoMe,
  });

  const lecture = useMemo(() => {
    if (!videoMe?.lectures || !lectureIdNum) return null;
    return videoMe.lectures.find((lec) => lec.id === lectureIdNum);
  }, [videoMe, lectureIdNum]);

  // React #310 방지: 훅은 early return 이전에 항상 호출되어야 함
  const sessionsForQuery = useMemo(() => {
    if (isLoading) return [];
    if (!isPublic && !lecture) return [];
    return isPublic
      ? (videoMe?.public?.session_id
          ? [{ id: videoMe.public.session_id, title: "공개 강의", order: 1, date: null }]
          : [{ id: 0, title: "공개 강의", order: 1, date: null }])
      : (lecture?.sessions ?? []);
  }, [isLoading, isPublic, lecture, videoMe]);
  const firstSessionIdForQuery = sessionsForQuery[0]?.id ?? 0;
  const enrollmentIdForQuery = isPublic ? null : (lecture ? (videoMe?.lectures?.find((l) => l.id === lecture.id)?.enrollment_id ?? null) : null);

  // 모든 세션의 영상을 한꺼번에 fetch (N+1 → 부모에서 일괄 관리)
  const sessionVideoQueries = useQueries({
    queries: sessionsForQuery.map((s) => ({
      queryKey: ["student-session-videos", s.id, enrollmentIdForQuery],
      queryFn: () => fetchStudentSessionVideos(s.id, enrollmentIdForQuery ?? undefined),
      enabled: !isLoading && !!s.id && s.id > 0,
      staleTime: 30_000,
    })),
  });

  // 모든 세션의 영상 수/총 재생시간 집계
  const totalVideos = useMemo(
    () => sessionVideoQueries.reduce((sum, q) => sum + (q.data?.items?.length ?? 0), 0),
    [sessionVideoQueries]
  );
  const totalDuration = useMemo(
    () => sessionVideoQueries.reduce(
      (sum, q) => sum + (q.data?.items?.reduce((s, v) => s + (v.duration ?? 0), 0) ?? 0),
      0
    ),
    [sessionVideoQueries]
  );

  // 공개 영상 리다이렉트 (훅은 early return 이전에 호출)
  const [publicRedirected, setPublicRedirected] = useState(false);
  useEffect(() => {
    if (isPublic && firstSessionIdForQuery > 0 && !publicRedirected) {
      setPublicRedirected(true);
      nav(`/student/video/sessions/${firstSessionIdForQuery}`, { replace: true });
    }
  }, [isPublic, firstSessionIdForQuery, publicRedirected, nav]);

  if (isLoading) {
    return (
      <StudentPageShell title="" noSectionFrame>
        <div className="video-page-content video-detail-skel">
          <div className="stu-skel video-detail-skel__hero" />
          <div className="stu-skel video-detail-skel__body" />
        </div>
      </StudentPageShell>
    );
  }

  // 공개 영상이 아닐 때만 수업 없음 오류 표시
  if (!isPublic && !lecture) {
    return (
      <StudentPageShell title="" noSectionFrame>
        <div className="video-page-content">
          <EmptyState
            title="수업을 찾을 수 없습니다"
            description="수업이 존재하지 않거나 접근 권한이 없습니다."
            onRetry={() => refetch()}
          />
        </div>
      </StudentPageShell>
    );
  }

  const sessions = sessionsForQuery;

  return (
    <StudentPageShell title="" noSectionFrame>
      <div className="video-page-content">
        <button type="button" className="video-back" onClick={() => nav("/student/video")}>
          <IconChevronRight className="video-back__icon" aria-hidden="true" />
          <span>강의 목록</span>
        </button>

        <section className="video-hero">
          <div className="video-hero__eyebrow">
            <IconPlay className="video-hero__icon" aria-hidden="true" />
            <span>영상</span>
          </div>
          <h1 className="video-hero__title">
            {isPublic ? "공개 강의실" : lecture?.title ?? "수업"}
          </h1>
          <div className="video-hero__desc">
            차시를 선택하면 해당 차시에 담긴 영상 목록으로 이동합니다.
          </div>
          <div className="video-hero__stats">
            <span className="video-stat-pill">차시 {sessions.length}개</span>
            {totalVideos > 0 && (
              <span className="video-stat-pill">영상 {totalVideos}개</span>
            )}
            {totalDuration > 0 && (
              <span className="video-stat-pill">{formatDuration(totalDuration)}</span>
            )}
          </div>
        </section>

        <section className="video-list" aria-label="차시 목록">
          <div className="video-section-head">
            <h2 className="video-section-title">차시 목록</h2>
            <span className="video-section-sub">{sessions.length}개</span>
          </div>

          {sessions.length === 0 ? (
            <EmptyState
              title="차시가 없습니다"
              description="이 수업에는 아직 차시가 등록되지 않았습니다."
            />
          ) : (
            <div className="video-list">
              {sessions.map((session, idx) => {
                // 공개 영상이지만 실제 세션이 없는 경우 (id === 0)
                if (isPublic && session.id === 0) {
                  return (
                    <div
                      key="public-empty"
                      className="video-card video-card--disabled"
                    >
                      <EmptyState
                        title="공개 강의가 아직 없습니다"
                        description="공개 강의가 등록되면 여기에 표시됩니다."
                      />
                    </div>
                  );
                }
                return (
                  <SessionBox
                    key={session.id}
                    sessionId={session.id}
                    sessionTitle={session.title}
                    enrollmentId={enrollmentIdForQuery}
                    order={session.order}
                    isPublic={isPublic}
                    videosData={sessionVideoQueries[idx]?.data}
                    isLoading={sessionVideoQueries[idx]?.isLoading}
                    courseTitle={isPublic ? "공개 강의실" : lecture?.title ?? "학습 강의"}
                  />
                );
              })}
            </div>
          )}
        </section>
      </div>
    </StudentPageShell>
  );
}
