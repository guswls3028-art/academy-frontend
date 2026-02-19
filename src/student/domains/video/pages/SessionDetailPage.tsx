/**
 * 차시 상세 페이지 — 영상 목록 (작은 썸네일 구조)
 */
import { useEffect, useState } from "react";
import { useParams, useNavigate, useSearchParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchStudentSessionVideos } from "../api/video";
import EmptyState from "@/student/shared/ui/layout/EmptyState";
import StudentPageShell from "@/student/shared/ui/pages/StudentPageShell";
import { IconPlay } from "@/student/shared/ui/icons/Icons";
import { formatDuration, formatDurationDetailed } from "../utils/format";

// 영상 목록 아이템 컴포넌트
function VideoListItem({ 
  video, 
  enrollmentId,
  isCurrent = false,
  progress = 0, // 0-100
}: { 
  video: {
    id: number;
    title: string;
    thumbnail_url?: string | null;
    duration?: number | null;
  };
  enrollmentId?: number | null;
  isCurrent?: boolean;
  progress?: number; // 0-100
}) {
  return (
    <Link
      to={`/student/video/play?video=${video.id}${enrollmentId ? `&enrollment=${enrollmentId}` : ""}`}
      style={{
        display: "flex",
        gap: 12,
        padding: "var(--stu-space-3)",
        borderRadius: 10,
        background: isCurrent ? "rgba(255,255,255,0.04)" : "#1a1a1a",
        border: isCurrent 
          ? "2px solid rgba(255,255,255,0.2)" 
          : "2px solid rgba(255,255,255,0.15)",
        borderLeft: isCurrent ? "3px solid var(--stu-primary)" : "2px solid rgba(255,255,255,0.15)",
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
          zIndex: 0,
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
              // 2번 테넌트(tchul) 브랜드색 그라데이션
              background: "linear-gradient(135deg, #0d47a1 0%, #00695c 50%, #004d40 100%)",
            }}
          >
            <IconPlay style={{ width: 32, height: 32, color: "rgba(255,255,255,0.9)", opacity: 0.8 }} />
          </div>
        )}

        {/* 현재 재생 중 오버레이 */}
        {isCurrent && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "grid",
              placeItems: "center",
              background: "rgba(0,0,0,0.3)",
              zIndex: 1,
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: "50%",
                background: "rgba(255,255,255,0.95)",
                display: "grid",
                placeItems: "center",
                boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
              }}
            >
              <IconPlay style={{ width: 24, height: 24, color: "#000", marginLeft: 2 }} />
            </div>
          </div>
        )}

        {/* 진행률 바 (YouTube 스타일) */}
        {progress > 0 && (
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
                width: `${progress}%`,
                background: "var(--stu-primary)",
                transition: "width 0.3s ease",
              }}
            />
          </div>
        )}

        {/* 영상 시간 오버레이 */}
        {video.duration && (
          <div
            style={{
              position: "absolute",
              bottom: progress > 0 ? 9 : 6,
              right: 6,
              padding: "2px 6px",
              borderRadius: 4,
              background: "rgba(0,0,0,0.8)",
              color: "#fff",
              fontSize: 11,
              fontWeight: 600,
              zIndex: 3,
            }}
          >
            {formatDurationDetailed(video.duration)}
          </div>
        )}
      </div>

      {/* 정보 */}
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
            fontWeight: isCurrent ? 700 : 600,
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
          {video.title}
        </div>
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
  
  // 현재 재생 중인 영상 ID (localStorage에서 가져오기 - VideoPlayerPage에서 설정)
  // useMemo 대신 useState + useEffect 사용하여 Hook 순서 일관성 유지
  const [currentVideoId, setCurrentVideoId] = useState<number | null>(null);
  
  useEffect(() => {
    try {
      const stored = localStorage.getItem("student_current_video_id");
      setCurrentVideoId(stored ? parseInt(stored, 10) : null);
    } catch {
      setCurrentVideoId(null);
    }
    
    // localStorage 변경 감지 (다른 탭/창에서 변경 시)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "student_current_video_id") {
        try {
          setCurrentVideoId(e.newValue ? parseInt(e.newValue, 10) : null);
        } catch {
          setCurrentVideoId(null);
        }
      }
    };
    
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  const { data: videosData, isLoading, isError, error } = useQuery({
    queryKey: ["student-session-videos", sessionIdNum, enrollmentId],
    queryFn: () => fetchStudentSessionVideos(sessionIdNum!, enrollmentId),
    enabled: !!sessionIdNum,
    retry: false,
  });

  const videos = videosData?.items ?? [];
  const res = (error as { response?: { status?: number; data?: { detail?: unknown } } })?.response;
  const is403 = isError && res?.status === 403;
  const serverMessage =
    typeof res?.data?.detail === "string"
      ? res.data.detail
      : Array.isArray(res?.data?.detail)
        ? String(res.data.detail[0] ?? "")
        : null;

  if (isLoading) {
    return (
      <StudentPageShell title="" noSectionFrame>
        <div className="video-page-content" style={{ padding: "var(--stu-space-4)" }}>
          <div className="stu-skel" style={{ height: 200, borderRadius: "var(--stu-radius-lg)" }} />
          <div className="stu-skel" style={{ height: 100, marginTop: 16, borderRadius: "var(--stu-radius-lg)" }} />
        </div>
      </StudentPageShell>
    );
  }

  if (is403) {
    return (
      <StudentPageShell title="" noSectionFrame>
        <div className="video-page-content" style={{ padding: "var(--stu-space-4)" }}>
          <EmptyState
            title="영상을 볼 수 없습니다"
            description={serverMessage || "이 차시의 영상을 볼 수 있는 권한이 없습니다. 수강 중인 강의인지 확인하거나, 선생님에게 문의해 주세요."}
          />
        </div>
      </StudentPageShell>
    );
  }

  if (!sessionIdNum || videos.length === 0) {
    return (
      <StudentPageShell title="" noSectionFrame>
        <div className="video-page-content" style={{ padding: "var(--stu-space-4)" }}>
          <EmptyState
            title="차시를 찾을 수 없습니다"
            description="차시가 존재하지 않거나 영상이 없습니다."
          />
        </div>
      </StudentPageShell>
    );
  }

  return (
    <StudentPageShell title="" noSectionFrame>
      <div className="video-page-content" style={{ padding: "var(--stu-space-4)" }}>
        {/* 하단: 영상 목록 (큰 썸네일 배너 제거) */}
        <div>
          <h2
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: "#fff",
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
            {videos.map((video) => {
              // 백엔드에서 받은 progress 사용 (0-100)
              const progress = video.progress ?? 0;
              const isCurrent = currentVideoId === video.id;
              
              return (
                <VideoListItem
                  key={video.id}
                  video={video}
                  enrollmentId={enrollmentId}
                  isCurrent={isCurrent}
                  progress={progress}
                />
              );
            })}
          </div>
        </div>
      </div>
    </StudentPageShell>
  );
}
