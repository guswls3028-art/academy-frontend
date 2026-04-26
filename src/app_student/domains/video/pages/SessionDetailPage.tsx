/**
 * 차시 상세 페이지 — 영상 목록 (작은 썸네일 구조)
 */
import { useEffect, useState } from "react";
import { useParams, useNavigate, useSearchParams, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchStudentSessionVideos, fetchStudentVideoPlayback } from "../api/video.api";
import EmptyState from "@student/layout/EmptyState";
import StudentPageShell from "@student/shared/ui/pages/StudentPageShell";
import { IconPlay } from "@student/shared/ui/icons/Icons";
import { formatDuration, formatDurationDetailed } from "../utils/format";
import { resolveTenantCodeString } from "@/shared/tenant";

// 영상 목록 아이템 컴포넌트
function VideoStatusBadge({ status }: { status: string }) {
  // UPLOADED: 업로드 완료 + 인코딩 대기 — 재생 불가
  // PENDING: 업로드 진행 / PROCESSING: 인코딩 중
  const isEncoding =
    status === "PENDING" ||
    status === "UPLOADED" ||
    status === "PROCESSING";
  const isFailed = status === "FAILED";
  if (!isEncoding && !isFailed) return null;

  // 상태별 문구 세분화 (UX 개선)
  let label = "처리 중";
  if (isFailed) label = "처리 실패";
  else if (status === "PENDING") label = "업로드 중";
  else if (status === "UPLOADED") label = "처리 대기";
  else if (status === "PROCESSING") label = "인코딩 중";

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "grid",
        placeItems: "center",
        background: "rgba(0,0,0,0.6)",
        zIndex: 4,
        borderRadius: 8,
      }}
    >
      <div
        style={{
          padding: "4px 10px",
          borderRadius: 6,
          background: isFailed ? "rgba(239,68,68,0.9)" : "rgba(255,255,255,0.15)",
          backdropFilter: "blur(4px)",
          fontSize: 11,
          fontWeight: 700,
          color: "#fff",
          letterSpacing: "0.02em",
        }}
      >
        {label}
      </div>
    </div>
  );
}

function VideoListItem({
  video,
  enrollmentId,
  sessionId,
  isCurrent = false,
  progress = 0, // 0-100
  onPrefetch,
}: {
  video: {
    id: number;
    title: string;
    thumbnail_url?: string | null;
    duration?: number | null;
    status?: string;
  };
  enrollmentId?: number | null;
  sessionId?: number | null;
  isCurrent?: boolean;
  progress?: number; // 0-100
  onPrefetch?: (videoId: number) => void;
}) {
  const videoStatus = video.status ?? "READY";
  const isPlayable = videoStatus === "READY";

  const href = isPlayable
    ? `/student/video/play?video=${video.id}${enrollmentId ? `&enrollment=${enrollmentId}` : ""}${sessionId ? `&session=${sessionId}` : ""}`
    : undefined;

  const handleClick = (e: React.MouseEvent) => {
    if (!isPlayable) {
      e.preventDefault();
    }
  };

  return (
    <Link
      to={href ?? "#"}
      onClick={handleClick}
      style={{
        display: "flex",
        gap: 12,
        padding: "var(--stu-space-3)",
        borderRadius: 10,
        background: isCurrent ? "var(--stu-tint-primary, var(--stu-surface-soft))" : "var(--stu-surface)",
        border: "1px solid var(--stu-border)",
        borderLeft: isCurrent ? "3px solid var(--stu-primary)" : "1px solid var(--stu-border)",
        textDecoration: "none",
        color: "inherit",
        transition: "transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease, background 0.2s ease",
        cursor: isPlayable ? "pointer" : "default",
        opacity: isPlayable ? 1 : 0.7,
        boxShadow: "var(--stu-shadow-1)",
        position: "relative",
      }}
      onTouchStart={() => { if (isPlayable && onPrefetch) onPrefetch(video.id); }}
      onMouseEnter={(e) => {
        if (!isPlayable) return;
        if (onPrefetch) onPrefetch(video.id);
        e.currentTarget.style.transform = "translateY(-4px)";
        e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.06)";
        e.currentTarget.style.background = "var(--stu-tint-hover)";
        e.currentTarget.style.borderColor = "var(--stu-border-strong)";
      }}
      onMouseLeave={(e) => {
        if (!isPlayable) return;
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "var(--stu-shadow-1)";
        e.currentTarget.style.background = isCurrent ? "var(--stu-tint-primary, var(--stu-surface-soft))" : "var(--stu-surface)";
        e.currentTarget.style.borderColor = "var(--stu-border)";
      }}
      onMouseDown={(e) => {
        if (!isPlayable) return;
        e.currentTarget.style.transform = "translateY(-2px) scale(0.98)";
      }}
      onMouseUp={(e) => {
        if (!isPlayable) return;
        e.currentTarget.style.transform = "translateY(-4px)";
      }}
    >
      {/* 썸네일 */}
      <div
        style={{
          position: "relative",
          width: 160,
          aspectRatio: "16 / 9",
          borderRadius: 8,
          overflow: "hidden",
          background: "var(--stu-surface-soft)",
          flexShrink: 0,
          zIndex: 0,
        }}
      >
        {video.thumbnail_url ? (
          <img
            src={video.thumbnail_url}
            alt={video.title}
            loading="lazy"
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
              background: "var(--stu-gradient, linear-gradient(135deg, #6b7280, #4b5563))",
            }}
          >
            <IconPlay style={{ width: 32, height: 32, color: "rgba(255,255,255,0.9)", opacity: 0.8 }} />
          </div>
        )}

        {/* 인코딩/실패 상태 오버레이 */}
        {!isPlayable && <VideoStatusBadge status={videoStatus} />}

        {/* 현재 재생 중 오버레이 */}
        {isCurrent && isPlayable && (
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
      </div>
    </Link>
  );
}

export default function SessionDetailPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [searchParams] = useSearchParams();
  const nav = useNavigate();
  const qc = useQueryClient();

  const sessionIdNum = sessionId ? parseInt(sessionId, 10) : null;
  const enrollmentId = searchParams.get("enrollment") ? parseInt(searchParams.get("enrollment")!, 10) : null;
  const currentVideoStorageKey = `student_current_video_id:${resolveTenantCodeString()}`;

  // Preload hls.js and player chunk for faster video playback start
  useEffect(() => {
    import("hls.js").catch(() => {});
    import("./VideoPlayerPage").catch(() => {});
  }, []);
  
  // 현재 재생 중인 영상 ID (localStorage에서 가져오기 - VideoPlayerPage에서 설정)
  // useMemo 대신 useState + useEffect 사용하여 Hook 순서 일관성 유지
  const [currentVideoId, setCurrentVideoId] = useState<number | null>(null);
  
  useEffect(() => {
    try {
      const stored = localStorage.getItem(currentVideoStorageKey);
      setCurrentVideoId(stored ? parseInt(stored, 10) : null);
    } catch {
      setCurrentVideoId(null);
    }
    
    // localStorage 변경 감지 (다른 탭/창에서 변경 시)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === currentVideoStorageKey) {
        try {
          setCurrentVideoId(e.newValue ? parseInt(e.newValue, 10) : null);
        } catch {
          setCurrentVideoId(null);
        }
      }
    };
    
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [currentVideoStorageKey]);

  const { data: videosData, isLoading, isError, error: queryError } = useQuery({
    queryKey: ["student-session-videos", sessionIdNum, enrollmentId],
    queryFn: () => fetchStudentSessionVideos(sessionIdNum!, enrollmentId),
    enabled: !!sessionIdNum,
    retry: false,
  });

  const videos = [...(videosData?.items ?? [])].sort((a, b) => {
    const orderDiff = (a.order ?? 1) - (b.order ?? 1);
    if (orderDiff !== 0) return orderDiff;
    const titleCmp = (a.title ?? "").localeCompare(b.title ?? "", "ko");
    return titleCmp !== 0 ? titleCmp : (a.id ?? 0) - (b.id ?? 0);
  });
  const res = (queryError as { response?: { status?: number; data?: { detail?: unknown } } })?.response;
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

  if (isError && !is403) {
    return (
      <StudentPageShell title="" noSectionFrame>
        <div className="video-page-content" style={{ padding: "var(--stu-space-4)" }}>
          <EmptyState
            title="영상을 불러오지 못했어요"
            description="잠시 후 다시 시도해 주세요."
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
            {videos.map((video) => {
              // 백엔드에서 받은 progress 사용 (0-100)
              const progress = video.progress ?? 0;
              const isCurrent = currentVideoId === video.id;

              return (
                <VideoListItem
                  key={video.id}
                  video={video}
                  enrollmentId={enrollmentId}
                  sessionId={sessionIdNum}
                  isCurrent={isCurrent}
                  progress={progress}
                  onPrefetch={(vid) => {
                    qc.prefetchQuery({
                      queryKey: ["student-video-playback", vid, enrollmentId],
                      queryFn: () => fetchStudentVideoPlayback(vid, enrollmentId ?? undefined),
                      staleTime: 60_000,
                    });
                  }}
                />
              );
            })}
          </div>
        </div>
      </div>
    </StudentPageShell>
  );
}
