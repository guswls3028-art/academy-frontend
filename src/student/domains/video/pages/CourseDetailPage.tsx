/**
 * 수업 상세 페이지 — 상단에 수업 정보, 하단에 차시별 박스
 */
import { useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
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
    
    return {
      thumbnailUrl: firstVideo.thumbnail_url,
      videoCount: videos.length,
      totalDuration,
      firstVideoId: firstVideo.id,
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
              background: "linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)",
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

        {/* 영상 개수 배지 */}
        <div
          style={{
            position: "absolute",
            bottom: 6,
            right: 6,
            padding: "2px 6px",
            borderRadius: 4,
            background: "rgba(0,0,0,0.8)",
            color: "#fff",
            fontSize: 11,
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <IconPlay style={{ width: 10, height: 10 }} />
          <span>{sessionData.videoCount}</span>
        </div>
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
        <div
          style={{
            fontSize: 13,
            color: "rgba(255,255,255,0.7)",
          }}
        >
          {sessionData.videoCount}개 영상 · {formatDuration(sessionData.totalDuration)}
        </div>
      </div>
    </Link>
  );
}

export default function CourseDetailPage() {
  const { lectureId } = useParams<{ lectureId: string }>();
  const nav = useNavigate();
  const isPublic = lectureId === "public";
  const lectureIdNum = isPublic ? null : (lectureId ? parseInt(lectureId, 10) : null);

  const { data: videoMe, isLoading } = useQuery({
    queryKey: ["student-video-me"],
    queryFn: fetchVideoMe,
  });

  const lecture = useMemo(() => {
    if (!videoMe?.lectures || !lectureIdNum) return null;
    return videoMe.lectures.find((lec) => lec.id === lectureIdNum);
  }, [videoMe, lectureIdNum]);

  if (isLoading) {
    return (
      <StudentPageShell title="">
        <div className="video-page-content" style={{ padding: "var(--stu-space-4)" }}>
          <div className="stu-skel" style={{ height: 200, borderRadius: "var(--stu-radius-lg)" }} />
          <div className="stu-skel" style={{ height: 120, marginTop: 16, borderRadius: "var(--stu-radius-lg)" }} />
        </div>
      </StudentPageShell>
    );
  }

  if (!lecture && !isPublic) {
    return (
      <StudentPageShell title="">
        <div className="video-page-content" style={{ padding: "var(--stu-space-4)" }}>
          <EmptyState
            title="수업을 찾을 수 없습니다"
            description="수업이 존재하지 않거나 접근 권한이 없습니다."
          />
        </div>
      </StudentPageShell>
    );
  }

  const sessions = isPublic 
    ? (videoMe?.public?.session_id ? [{ id: videoMe.public.session_id, title: "전체공개영상", order: 1, date: null }] : [])
    : (lecture?.sessions ?? []);

  // 첫 번째 세션의 첫 번째 영상으로 썸네일 가져오기
  const firstSessionId = sessions[0]?.id;
  const { data: firstSessionVideos } = useQuery({
    queryKey: ["student-session-videos", firstSessionId, null],
    queryFn: () => fetchStudentSessionVideos(firstSessionId!, null),
    enabled: !!firstSessionId,
  });

  const courseThumbnail = firstSessionVideos?.items?.[0]?.thumbnail_url;
  const totalVideos = useMemo(() => {
    // TODO: 모든 세션의 영상 개수 합산 (현재는 첫 번째 세션만)
    return firstSessionVideos?.items?.length ?? 0;
  }, [firstSessionVideos]);

  const totalDuration = useMemo(() => {
    // TODO: 모든 세션의 총 시간 합산
    return firstSessionVideos?.items?.reduce((sum, v) => sum + (v.duration ?? 0), 0) ?? 0;
  }, [firstSessionVideos]);

  return (
    <StudentPageShell title="">
      <div className="video-page-content" style={{ padding: "var(--stu-space-4)" }}>
        {/* 상단: 수업 정보 */}
        <div
          style={{
            borderRadius: 16,
            overflow: "hidden",
            background: "#1a1a1a",
            border: "1px solid rgba(255,255,255,0.1)",
            marginBottom: "var(--stu-space-6)",
          }}
        >
          {/* 썸네일 배너 */}
          {courseThumbnail && (
            <div
              style={{
                width: "100%",
                aspectRatio: "16 / 9",
                background: "#111",
                position: "relative",
              }}
            >
              <img
                src={courseThumbnail}
                alt={lecture?.title ?? "전체공개영상"}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                }}
              />
            </div>
          )}

          {/* 수업 정보 */}
          <div style={{ padding: "var(--stu-space-5)" }}>
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
              {sessions.map((session) => (
                <SessionBox
                  key={session.id}
                  sessionId={session.id}
                  sessionTitle={session.title}
                  order={session.order}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </StudentPageShell>
  );
}
