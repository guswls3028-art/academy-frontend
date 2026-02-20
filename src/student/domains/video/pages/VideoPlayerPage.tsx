// PATH: src/student/domains/video/pages/VideoPlayerPage.tsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";

import StudentPageShell from "../../../shared/ui/pages/StudentPageShell";
import EmptyState from "../../../shared/ui/layout/EmptyState";
import { fetchStudentVideoPlayback, fetchStudentSessionVideos, updateVideoProgress } from "../api/video";
import { IconCheck, IconRefresh, IconArrowRight, IconPlay } from "@/student/shared/ui/icons/Icons";
import { Link } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import StudentVideoPlayer, {
  PlaybackBootstrap,
  VideoMetaLite,
} from "../playback/player/StudentVideoPlayer";
import { safeParseInt } from "../playback/player/design/utils";

function useQueryParams() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

export default function VideoPlayerPage() {
  const nav = useNavigate();
  const q = useQueryParams();
  const params = useParams();
  const queryClient = useQueryClient();

  const videoId =
    safeParseInt(params.videoId) ??
    safeParseInt(q.get("video")) ??
    safeParseInt(q.get("video_id"));

  const rawEnrollmentId =
    safeParseInt(q.get("enrollment")) ??
    safeParseInt(q.get("enrollment_id")) ??
    safeParseInt(params.enrollmentId);
  const enrollmentId = rawEnrollmentId != null && Number.isFinite(rawEnrollmentId) ? rawEnrollmentId : null;

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [video, setVideo] = useState<(VideoMetaLite & { 
    description?: string | null;
    created_at?: string | null;
    view_count?: number | null;
    tags?: string[];
    session_id?: number;
  }) | null>(null);
  const [boot, setBoot] = useState<PlaybackBootstrap | null>(null);
  const [playbackData, setPlaybackData] = useState<any>(null);
  const [sessionVideosData, setSessionVideosData] = useState<{ items: { id: number; title?: string; [key: string]: unknown }[] } | null>(null);

  const sessionId = video?.session_id ?? null;

  const progressMutation = useMutation({
    mutationFn: (data: { progress?: number; completed?: boolean; last_position?: number }) => {
      if (!videoId) throw new Error("videoId가 필요합니다.");
      return updateVideoProgress(videoId, data);
    },
    onSuccess: () => {
      if (sessionId == null) return;
      const key = ["student-session-videos", sessionId, enrollmentId] as const;
      setTimeout(() => queryClient.invalidateQueries({ queryKey: key }), 0);
    },
  });

  const progressMutationRef = useRef(progressMutation);
  progressMutationRef.current = progressMutation;

  const nextVideo = useMemo(() => {
    if (!sessionVideosData?.items?.length || !videoId) return null;
    const videos = sessionVideosData.items;
    const currentIndex = videos.findIndex((v: { id: number }) => v.id === videoId);
    if (currentIndex >= 0 && currentIndex < videos.length - 1) {
      return videos[currentIndex + 1];
    }
    return null;
  }, [sessionVideosData, videoId]);

  const onFatal = useCallback((reason: string) => setLoadError(reason), []);

  const onLeaveProgress = useCallback(
    (data: { progress?: number; completed?: boolean; last_position?: number }) => {
      if (!videoId) return;
      progressMutationRef.current.mutate({
        progress: data.progress,
        last_position: data.last_position,
        completed: data.completed,
      });
    },
    [videoId]
  );

  useEffect(() => {
    let alive = true;

    async function run() {
      setLoading(true);
      setLoadError(null);

      if (!videoId) {
        setLoading(false);
        setLoadError("video_id가 필요합니다.");
        return;
      }

      // 현재 재생 중인 영상 ID를 localStorage에 저장 (SessionDetailPage에서 사용)
      try {
        localStorage.setItem("student_current_video_id", String(videoId));
      } catch (e) {
        console.warn("[VideoPlayerPage] Failed to save current video ID:", e);
      }

      try {
        // 학생 앱 전용 API: 비디오 정보와 재생 정보를 한 번에 가져오기
        const playbackData = await fetchStudentVideoPlayback(
          videoId,
          enrollmentId != null ? enrollmentId : undefined
        );
        
        if (!alive) return;

        // 비디오 정보 추출
        const vd = playbackData?.video;
        if (!vd || typeof vd.id === "undefined") {
          setLoadError("재생 정보 형식이 올바르지 않습니다.");
          setLoading(false);
          return;
        }
        const v: VideoMetaLite & {
          description?: string | null;
          created_at?: string | null;
          view_count?: number | null;
          tags?: string[];
          session_id?: number;
        } = {
          id: Number(vd.id),
          title: String(vd.title ?? "영상"),
          duration: vd.duration == null ? null : Number(vd.duration),
          status: String(vd.status ?? ""),
          thumbnail_url: vd.thumbnail_url ?? null,
          hls_url: playbackData.hls_url ?? null,
          description: (vd as Record<string, unknown>).description ?? null,
          created_at: (vd as Record<string, unknown>).created_at ?? null,
          view_count: (vd as Record<string, unknown>).view_count ?? null,
          tags: Array.isArray((vd as Record<string, unknown>).tags) ? (vd as Record<string, unknown>).tags as string[] : [],
          session_id: Number(vd.session_id),
        };

        // playbackData 저장 (다음 강의 찾기용)
        setPlaybackData(playbackData);

        // 재생 URL 확인 (play_url 우선, 없으면 hls_url 또는 mp4_url)
        const playUrl = playbackData.play_url || playbackData.hls_url || playbackData.mp4_url || "";
        
        if (!playUrl) {
          const videoStatus = playbackData?.video?.status;
          const detail = (playbackData as { detail?: string })?.detail ?? "";
          
          // 백엔드에서 제공한 상세 에러 메시지가 있으면 사용
          if (detail) {
            setLoadError(detail);
          } else if (videoStatus && videoStatus !== "READY") {
            setLoadError(`비디오가 아직 준비되지 않았습니다. (상태: ${videoStatus})`);
          } else {
            setLoadError("재생 URL을 가져올 수 없습니다. 비디오 파일이 처리 중이거나 업로드되지 않았을 수 있습니다.");
          }
          setLoading(false);
          return;
        }

        // Bootstrap 정보 생성
        const b: PlaybackBootstrap = {
          token: `student-${videoId}-${Date.now()}`, // 학생 앱용 임시 token (세션 관리 불필요)
          session_id: null,
          expires_at: null,
          access_mode: playbackData.policy?.access_mode || "FREE_REVIEW",
          monitoring_enabled: playbackData.policy?.monitoring_enabled ?? false,
          policy: playbackData.policy || {},
          play_url: playUrl,
        };

        setVideo(v);
        setBoot(b);
        setLoading(false);
      } catch (e: any) {
        if (!alive) return;
        console.error("[VideoPlayerPage] Error loading playback:", e);
        const msg =
          e?.response?.data?.detail ||
          e?.response?.data?.message ||
          e?.message ||
          "재생 페이지 로드에 실패했습니다.";
        setLoadError(String(msg));
        setLoading(false);
      }
    }

    run();

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId, enrollmentId]);

  // 컴포넌트 언마운트 시 현재 비디오 ID 제거
  useEffect(() => {
    return () => {
      try {
        localStorage.removeItem("student_current_video_id");
      } catch (e) {
        // Ignore
      }
    };
  }, []);

  // 다음 강의 찾기: useQuery 제거 → 1회 fetch만 (setData 연쇄 리렌더로 #310 발생 방지)
  const sessionId = video?.session_id ?? null;
  const [sessionVideosData, setSessionVideosData] = useState<{ items: { id: number; title?: string; [k: string]: unknown }[] } | null>(null);

  useEffect(() => {
    if (!sessionId || !videoId) {
      setSessionVideosData(null);
      return;
    }
    let cancelled = false;
    fetchStudentSessionVideos(sessionId, enrollmentId ?? undefined)
      .then((res) => {
        if (!cancelled) setSessionVideosData(res);
      })
      .catch(() => {
        if (!cancelled) setSessionVideosData(null);
      });
    return () => { cancelled = true; };
  }, [sessionId, enrollmentId, videoId]);

  const handleComplete = () => {
  const handleComplete = () => {
    if (!videoId || !video) return;
    progressMutation.mutate({
      progress: 100,
      completed: true,
    });
  };

  // 다시보기 처리 (진행률 초기화)
  const handleRewatch = () => {
    if (!videoId || !video) return;
    progressMutation.mutate({
      progress: 0,
      completed: false,
      last_position: 0,
    });
  };

  return (
    <div className="video-page-content" style={{ padding: "var(--stu-space-4)" }}>
      <div style={{ maxWidth: 1400, margin: "0 auto" }}>
        <div style={{ marginBottom: "var(--stu-space-4)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <button
            type="button"
            onClick={() => nav(-1)}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.2)",
              background: "rgba(255,255,255,0.1)",
              color: "#fff",
              fontWeight: 600,
              cursor: "pointer",
              fontSize: 14,
            }}
          >
            ← 뒤로
          </button>
          {video && (
            <h1 style={{ fontSize: 18, fontWeight: 700, color: "#fff", margin: 0 }}>
              {video.title}
            </h1>
          )}
          <div style={{ width: 80 }} />
        </div>
      {loading ? (
        <div style={{ padding: 8 }}>
          <div
            style={{
              height: 520,
              borderRadius: 14,
              border: "1px solid #eee",
              background:
                "linear-gradient(90deg, #f3f3f3, #fafafa, #f3f3f3)",
              backgroundSize: "200% 100%",
              animation: "mediaShimmer 1.1s ease-in-out infinite",
            }}
          />
          <style>{`
            @keyframes mediaShimmer {
              0% { background-position: 200% 0; }
              100% { background-position: -200% 0; }
            }
          `}</style>
        </div>
      ) : loadError ? (
        <EmptyState
          title="재생을 시작할 수 없습니다"
          description={loadError}
        />
      ) : video && boot ? (
        <>
          {/* 상단: 영상 플레이어 */}
          <StudentVideoPlayer
            video={video}
            bootstrap={boot}
            enrollmentId={enrollmentId != null ? Number(enrollmentId) : null}
            onFatal={onFatal}
            onLeaveProgress={onLeaveProgress}
          />
          
          {/* 하단: 행동 중심 UI (YouTube SaaS 스타일) */}
          <div
            style={{
              marginTop: "var(--stu-space-6)",
            }}
          >
            {/* 제목 및 행동 버튼 */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "var(--stu-space-4)",
                flexWrap: "wrap",
                gap: "var(--stu-space-3)",
              }}
            >
              <h2
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  color: "#fff",
                  margin: 0,
                }}
              >
                {video.title}
              </h2>
              
              {/* 행동 버튼 그룹 */}
              <div
                style={{
                  display: "flex",
                  gap: "var(--stu-space-2)",
                  flexWrap: "wrap",
                }}
              >
                {/* 수강 완료 버튼 */}
                <button
                  type="button"
                  onClick={handleComplete}
                  disabled={progressMutation.isPending}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "8px 16px",
                    borderRadius: 8,
                    background: "rgba(255,255,255,0.1)",
                    border: "1px solid rgba(255,255,255,0.2)",
                    color: "#fff",
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "rgba(255,255,255,0.15)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "rgba(255,255,255,0.1)";
                  }}
                >
                  <IconCheck style={{ width: 18, height: 18 }} />
                  <span>수강 완료</span>
                </button>
                
                {/* 다시보기 버튼 */}
                <button
                  type="button"
                  onClick={handleRewatch}
                  disabled={progressMutation.isPending}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "8px 16px",
                    borderRadius: 8,
                    background: "rgba(255,255,255,0.1)",
                    border: "1px solid rgba(255,255,255,0.2)",
                    color: "#fff",
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "rgba(255,255,255,0.15)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "rgba(255,255,255,0.1)";
                  }}
                >
                  <IconRefresh style={{ width: 18, height: 18 }} />
                  <span>다시보기</span>
                </button>
                
                {/* 다음 강의 버튼 */}
                {nextVideo ? (
                  <Link
                    to={`/student/video/play?video=${nextVideo.id}${enrollmentId ? `&enrollment=${enrollmentId}` : ""}`}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "8px 16px",
                      borderRadius: 8,
                      background: "var(--stu-primary)",
                      border: "none",
                      color: "#fff",
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: "pointer",
                      textDecoration: "none",
                      transition: "all 0.2s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.opacity = "0.9";
                      e.currentTarget.style.transform = "translateY(-1px)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.opacity = "1";
                      e.currentTarget.style.transform = "translateY(0)";
                    }}
                  >
                    <span>다음 강의</span>
                    <IconArrowRight style={{ width: 18, height: 18 }} />
                  </Link>
                ) : (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "8px 16px",
                      borderRadius: 8,
                      background: "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      color: "rgba(255,255,255,0.5)",
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: "not-allowed",
                    }}
                  >
                    <span>다음 강의</span>
                    <IconArrowRight style={{ width: 18, height: 18 }} />
                  </div>
                )}
              </div>
            </div>
            
            {/* 구분선 */}
            <div
              style={{
                height: 1,
                background: "rgba(255,255,255,0.1)",
                marginBottom: "var(--stu-space-4)",
              }}
            />
            
            {/* 자동 재생 안내 (다음 강의가 있을 때만) */}
            {nextVideo && (
              <div
                style={{
                  padding: "var(--stu-space-3)",
                  borderRadius: 8,
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.05)",
                  fontSize: 14,
                  color: "rgba(255,255,255,0.7)",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <IconPlay style={{ width: 16, height: 16, opacity: 0.6 }} />
                <span>다음 강의 자동재생 ON</span>
                <span style={{ opacity: 0.5 }}>·</span>
                <span style={{ opacity: 0.5 }}>5초 후 재생</span>
              </div>
            )}
          </div>
        </>
      ) : (
        <EmptyState title="데이터가 없습니다" description="다시 시도해주세요." />
      )}
      </div>
    </div>
  );
}
