/**
 * 차시 상세 페이지 — 상단에 첫 영상 썸네일, 하단에 영상 목록
 */
import { useMemo } from "react";
import { useParams, useNavigate, useSearchParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchStudentSessionVideos } from "../api/media";
import EmptyState from "@/student/shared/ui/layout/EmptyState";
import StudentPageShell from "@/student/shared/ui/pages/StudentPageShell";
import { IconPlay } from "@/student/shared/ui/icons/Icons";

function formatDuration(sec: number | null | undefined): string {
  if (sec == null || sec <= 0) return "0:00";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// 영상 목록 아이템 컴포넌트
function VideoListItem({ 
  video, 
  enrollmentId 
}: { 
  video: {
    id: number;
    title: string;
    thumbnail_url?: string | null;
    duration?: number | null;
  };
  enrollmentId?: number | null;
}) {
  return (
    <Link
      to={`/student/video/play?video=${video.id}${enrollmentId ? `&enrollment=${enrollmentId}` : ""}`}
      style={{
        display: "flex",
        gap: 12,
        padding: "var(--stu-space-3)",
        borderRadius: 10,
        background: "var(--stu-surface-1)",
        border: "1px solid var(--stu-border-subtle)",
        textDecoration: "none",
        color: "inherit",
        transition: "transform var(--stu-motion-fast), filter var(--stu-motion-fast)",
      }}
      className="stu-panel--pressable"
    >
      {/* 썸네일 */}
      <div
        style={{
          position: "relative",
          width: 160,
          aspectRatio: "16 / 9",
          borderRadius: 8,
          overflow: "hidden",
          background: "#111",
          flexShrink: 0,
        }}
      >
        {video.thumbnail_url ? (
          <img
            src={video.thumbnail_url}
            alt={video.title}
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
              background: "linear-gradient(135deg, var(--stu-surface-soft) 0%, var(--stu-surface) 100%)",
            }}
          >
            <IconPlay style={{ width: 32, height: 32, color: "var(--stu-text-muted)", opacity: 0.5 }} />
          </div>
        )}

        {/* 영상 시간 오버레이 */}
        {video.duration && (
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
            }}
          >
            {formatDuration(video.duration)}
          </div>
        )}

        {/* 재생 아이콘 오버레이 */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "grid",
            placeItems: "center",
            background: "rgba(0,0,0,0.1)",
            opacity: 0,
            transition: "opacity var(--stu-motion-fast)",
          }}
          className="hover:opacity-100"
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.9)",
              display: "grid",
              placeItems: "center",
            }}
          >
            <IconPlay style={{ width: 20, height: 20, color: "#000", marginLeft: 2 }} />
          </div>
        </div>
      </div>

      {/* 정보 */}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            fontSize: 15,
            fontWeight: 600,
            color: "var(--stu-text)",
            marginBottom: 4,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            lineHeight: 1.4,
          }}
        >
          {video.title}
        </div>
        {video.duration && (
          <div
            style={{
              fontSize: 13,
              color: "var(--stu-text-muted)",
            }}
          >
            {formatDuration(video.duration)}
          </div>
        )}
      </div>
    </Link>
  );
}

export default function SessionDetailPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [searchParams] = useSearchParams();
  const nav = useNavigate();
  
  const sessionIdNum = sessionId ? parseInt(sessionId, 10) : null;
  const enrollmentId = searchParams.get("enrollment") ? parseInt(searchParams.get("enrollment")!, 10) : null;

  const { data: videosData, isLoading } = useQuery({
    queryKey: ["student-session-videos", sessionIdNum, enrollmentId],
    queryFn: () => fetchStudentSessionVideos(sessionIdNum!, enrollmentId),
    enabled: !!sessionIdNum,
  });

  const videos = videosData?.items ?? [];
  const firstVideo = videos[0];

  if (isLoading) {
    return (
      <StudentPageShell title="차시 정보">
        <div style={{ padding: "var(--stu-space-4)" }}>
          <div className="stu-skel" style={{ height: 200, borderRadius: "var(--stu-radius-lg)" }} />
          <div className="stu-skel" style={{ height: 100, marginTop: 16, borderRadius: "var(--stu-radius-lg)" }} />
        </div>
      </StudentPageShell>
    );
  }

  if (!sessionIdNum || videos.length === 0) {
    return (
      <StudentPageShell title="차시 정보">
        <div style={{ padding: "var(--stu-space-4)" }}>
          <EmptyState
            title="차시를 찾을 수 없습니다"
            description="차시가 존재하지 않거나 영상이 없습니다."
          />
        </div>
      </StudentPageShell>
    );
  }

  return (
    <StudentPageShell title={firstVideo?.title ?? "차시 정보"}>
      <div style={{ padding: "var(--stu-space-4)" }}>
        {/* 상단: 첫 번째 영상 썸네일 배너 */}
        {firstVideo && (
          <div
            style={{
              borderRadius: 16,
              overflow: "hidden",
              background: "var(--stu-surface-1)",
              border: "1px solid var(--stu-border-subtle)",
              marginBottom: "var(--stu-space-6)",
            }}
          >
            <div
              style={{
                position: "relative",
                width: "100%",
                aspectRatio: "16 / 9",
                background: "#111",
              }}
            >
              {firstVideo.thumbnail_url ? (
                <img
                  src={firstVideo.thumbnail_url}
                  alt={firstVideo.title}
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
                    background: "linear-gradient(135deg, var(--stu-surface-soft) 0%, var(--stu-surface) 100%)",
                  }}
                >
                  <IconPlay style={{ width: 64, height: 64, color: "var(--stu-text-muted)", opacity: 0.5 }} />
                </div>
              )}

              {/* 재생 버튼 */}
              <Link
                to={`/student/video/play?video=${firstVideo.id}${enrollmentId ? `&enrollment=${enrollmentId}` : ""}`}
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "grid",
                  placeItems: "center",
                  background: "rgba(0,0,0,0.2)",
                  textDecoration: "none",
                }}
              >
                <div
                  style={{
                    width: 80,
                    height: 80,
                    borderRadius: "50%",
                    background: "rgba(255,255,255,0.95)",
                    display: "grid",
                    placeItems: "center",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
                  }}
                >
                  <IconPlay style={{ width: 32, height: 32, color: "#000", marginLeft: 4 }} />
                </div>
              </Link>

              {/* 영상 시간 */}
              {firstVideo.duration && (
                <div
                  style={{
                    position: "absolute",
                    bottom: 12,
                    right: 12,
                    padding: "4px 10px",
                    borderRadius: 6,
                    background: "rgba(0,0,0,0.8)",
                    color: "#fff",
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                >
                  {formatDuration(firstVideo.duration)}
                </div>
              )}
            </div>

            {/* 영상 제목 */}
            <div style={{ padding: "var(--stu-space-4)" }}>
              <h1
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  color: "var(--stu-text)",
                  marginBottom: 4,
                }}
              >
                {firstVideo.title}
              </h1>
              <div
                style={{
                  fontSize: 14,
                  color: "var(--stu-text-muted)",
                }}
              >
                {videos.length}개 영상
              </div>
            </div>
          </div>
        )}

        {/* 하단: 영상 목록 */}
        <div>
          <h2
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: "var(--stu-text)",
              marginBottom: "var(--stu-space-4)",
            }}
          >
            영상 목록
          </h2>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "var(--stu-space-3)",
            }}
          >
            {videos.map((video) => (
              <VideoListItem
                key={video.id}
                video={video}
                enrollmentId={enrollmentId}
              />
            ))}
          </div>
        </div>
      </div>
    </StudentPageShell>
  );
}
