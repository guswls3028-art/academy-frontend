/**
 * 수업 상세 페이지 — 상단에 수업 정보, 하단에 차시별 박스 (작은 썸네일 구조)
 */
import { useMemo } from "react";
import { useParams, useNavigate, useLocation, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchVideoMe, fetchStudentSessionVideos } from "../api/video";
import EmptyState from "@/student/shared/ui/layout/EmptyState";
import StudentPageShell from "@/student/shared/ui/pages/StudentPageShell";
import { IconPlay } from "@/student/shared/ui/icons/Icons";
import { formatDuration } from "../utils/format";

// 차시별 박스 컴포넌트 (영상 목록과 동일한 스타일)
function SessionBox({ 
  sessionId, 
  sessionTitle, 
  enrollmentId,
  order 
}: { 
  sessionId: number; 
  sessionTitle: string;
  enrollmentId?: number | null;
  order: number;
}) {
  const { data: videosData } = useQuery({
    queryKey: ["student-session-videos", sessionId, enrollmentId],
    queryFn: () => fetchStudentSessionVideos(sessionId, enrollmentId),
    enabled: !!sessionId,
  });

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

  if (!sessionData) return null;

  return (
    <Link
      to={`/student/video/sessions/${sessionId}${enrollmentId ? `?enrollment=${enrollmentId}` : ""}`}
      style={{
        display: "flex",
        gap: 12,
        padding: "var(--stu-space-3)",
        borderRadius: 10,
        background: "#1a1a1a",
        border: "2px solid rgba(255,255,255,0.15)",
        textDecoration: "none",
        color: "inherit",
        transition: "transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease, background 0.2s ease",
        cursor: "pointer",
        boxShadow: "0 4px 12px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)",
        position: "relative",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-4px)";
        e.currentTarget.style.boxShadow = "0 8px 20px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.1)";
        e.currentTarget.style.background = "#222";
        e.currentTarget.style.borderColor = "rgba(255,255,255,0.25)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)";
        e.currentTarget.style.background = "#1a1a1a";
        e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)";
      }}
      onMouseDown={(e) => {
        e.currentTarget.style.transform = "translateY(-2px) scale(0.98)";
      }}
      onMouseUp={(e) => {
        e.currentTarget.style.transform = "translateY(-4px)";
      }}
    >
      {/* 질감 오버레이 */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "linear-gradient(180deg, rgba(255,255,255,0.03) 0%, transparent 50%, rgba(0,0,0,0.2) 100%)",
          pointerEvents: "none",
          zIndex: 1,
          borderRadius: 10,
        }}
      />
      
      {/* 좌측: 작은 플레이 아이콘 */}
      <div
        style={{
          position: "relative",
          width: 160,
          aspectRatio: "16 / 9",
          borderRadius: 8,
          overflow: "hidden",
          background: "#111",
          flexShrink: 0,
          zIndex: 0,
        }}
      >
        {sessionData.thumbnailUrl ? (
          <img
            src={sessionData.thumbnailUrl}
            alt={sessionTitle}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
        ) : (
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "grid",
              placeItems: "center",
              // 2번 테넌트(tchul) 브랜드색 그라데이션
              background: "linear-gradient(135deg, #0d47a1 0%, #00695c 50%, #004d40 100%)",
            }}
          >
            <IconPlay style={{ width: 32, height: 32, color: "rgba(255,255,255,0.9)", opacity: 0.8 }} />
          </div>
        )}

        {/* 재생 오버레이 */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "grid",
            placeItems: "center",
            background: "rgba(0,0,0,0.2)",
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.9)",
              display: "grid",
              placeItems: "center",
            }}
          >
            <IconPlay style={{ width: 20, height: 20, color: "#000", marginLeft: 2 }} />
          </div>
        </div>

        {/* 진행률 바 (YouTube 스타일) */}
        {sessionData.progress > 0 && (
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              height: 3,
              background: "rgba(0,0,0,0.3)",
              zIndex: 2,
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${sessionData.progress}%`,
                background: "var(--stu-primary)",
                transition: "width 0.3s ease",
              }}
            />
          </div>
        )}
      </div>

      {/* 우측: 설명 */}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          position: "relative",
          zIndex: 1,
        }}
      >
        <div
          style={{
            fontSize: 15,
            fontWeight: 600,
            color: "#fff",
            marginBottom: 4,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            lineHeight: 1.4,
            textShadow: "0 1px 2px rgba(0,0,0,0.5)",
          }}
        >
          {order}차시 · {sessionTitle}
        </div>
      </div>
    </Link>
  );
}

export default function CourseDetailPage() {
  const { lectureId } = useParams<{ lectureId?: string }>();
  const location = useLocation();
  const nav = useNavigate();
  // 전체공개영상: 정적 라우트 video/courses/public 또는 pathname에 courses/public 포함 시
  const pathname = location.pathname.replace(/\/$/, "");
  const isPublic =
    lectureId === "public" ||
    pathname.endsWith("video/courses/public") ||
    pathname.includes("/video/courses/public");
  const lectureIdNum = isPublic ? null : (lectureId ? parseInt(lectureId, 10) : null);

  const { data: videoMe, isLoading } = useQuery({
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
          ? [{ id: videoMe.public.session_id, title: "전체공개영상", order: 1, date: null }]
          : [{ id: 0, title: "전체공개영상", order: 1, date: null }])
      : (lecture?.sessions ?? []);
  }, [isLoading, isPublic, lecture, videoMe]);
  const firstSessionIdForQuery = sessionsForQuery[0]?.id ?? 0;
  const enrollmentIdForQuery = isPublic ? null : (lecture ? (videoMe?.lectures?.find((l) => l.id === lecture.id)?.enrollment_id ?? null) : null);

  const { data: firstSessionVideos } = useQuery({
    queryKey: ["student-session-videos", firstSessionIdForQuery, enrollmentIdForQuery],
    queryFn: () => fetchStudentSessionVideos(firstSessionIdForQuery, enrollmentIdForQuery ?? undefined),
    enabled: !isLoading && !!firstSessionIdForQuery && firstSessionIdForQuery > 0,
  });

  const totalVideos = useMemo(() => firstSessionVideos?.items?.length ?? 0, [firstSessionVideos]);
  const totalDuration = useMemo(
    () => firstSessionVideos?.items?.reduce((sum, v) => sum + (v.duration ?? 0), 0) ?? 0,
    [firstSessionVideos]
  );

  if (isLoading) {
    return (
      <StudentPageShell title="" noSectionFrame>
        <div className="video-page-content" style={{ padding: "var(--stu-space-4)" }}>
          <div className="stu-skel" style={{ height: 200, borderRadius: "var(--stu-radius-lg)" }} />
          <div className="stu-skel" style={{ height: 120, marginTop: 16, borderRadius: "var(--stu-radius-lg)" }} />
        </div>
      </StudentPageShell>
    );
  }

  // 전체공개영상이 아닐 때만 수업 없음 오류 표시
  if (!isPublic && !lecture) {
    return (
      <StudentPageShell title="" noSectionFrame>
        <div className="video-page-content" style={{ padding: "var(--stu-space-4)" }}>
          <EmptyState
            title="수업을 찾을 수 없습니다"
            description="수업이 존재하지 않거나 접근 권한이 없습니다."
          />
        </div>
      </StudentPageShell>
    );
  }

  const sessions = sessionsForQuery;

  return (
    <StudentPageShell title="" noSectionFrame>
      <div className="video-page-content" style={{ padding: "var(--stu-space-4)" }}>
        {/* 상단: 수업 정보 (썸네일 배너 제거) */}
        <div
          style={{
            marginBottom: "var(--stu-space-6)",
          }}
        >
          <h1
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: "#fff",
              marginBottom: "var(--stu-space-3)",
              letterSpacing: "-0.01em",
            }}
          >
            {isPublic ? "전체공개영상" : lecture?.title ?? "수업"}
          </h1>
          
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 6,
              fontSize: 14,
              color: "rgba(255,255,255,0.7)",
              marginBottom: "var(--stu-space-4)",
            }}
          >
            <div>
              <span style={{ fontWeight: 600 }}>차시:</span> {sessions.length}개
            </div>
            {totalVideos > 0 && (
              <div>
                <span style={{ fontWeight: 600 }}>영상:</span> {totalVideos}개 · {formatDuration(totalDuration)}
              </div>
            )}
          </div>
        </div>

        {/* 하단: 차시별 박스 */}
        <div>
          <h2
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: "#fff",
              marginBottom: "var(--stu-space-4)",
            }}
          >
            차시 목록
          </h2>
          
          {sessions.length === 0 ? (
            <EmptyState
              title="차시가 없습니다"
              description="이 수업에는 아직 차시가 등록되지 않았습니다."
            />
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "var(--stu-space-4)",
              }}
            >
              {sessions.map((session) => {
                // 전체공개영상이지만 실제 세션이 없는 경우 (id === 0)
                if (isPublic && session.id === 0) {
                  return (
                    <div
                      key="public-empty"
                      style={{
                        padding: "var(--stu-space-6)",
                        borderRadius: 10,
                        background: "#1a1a1a",
                        border: "2px solid rgba(255,255,255,0.15)",
                        textAlign: "center",
                      }}
                    >
                      <EmptyState
                        title="전체공개영상이 없습니다"
                        description="전체공개영상이 등록되면 여기에 표시됩니다."
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
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>
    </StudentPageShell>
  );
}
