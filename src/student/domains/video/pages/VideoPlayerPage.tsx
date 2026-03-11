// PATH: src/student/domains/video/pages/VideoPlayerPage.tsx
import { useCallback, useEffect, useMemo, useRef, useState, startTransition } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";

import EmptyState from "../../../shared/ui/layout/EmptyState";
import { fetchStudentVideoPlayback, fetchStudentSessionVideos, updateVideoProgress } from "../api/video";
import type { StudentVideoListItem } from "../api/video";
import { Link } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import StudentVideoPlayer, {
  PlaybackBootstrap,
  VideoMetaLite,
} from "../playback/player/StudentVideoPlayer";
import { safeParseInt, formatClock } from "../playback/player/design/utils";

/* ─── localStorage 기반 이어보기 ─── */
function getStoredPosition(videoId: number | null): number {
  if (!videoId) return 0;
  try {
    const raw = localStorage.getItem(`video_pos_${videoId}`);
    if (!raw) return 0;
    const parsed = JSON.parse(raw);
    if (Date.now() - (parsed.ts || 0) > 7 * 24 * 60 * 60 * 1000) return 0;
    return parsed.pos || 0;
  } catch {
    return 0;
  }
}

function storePosition(videoId: number | null, pos: number) {
  if (!videoId || pos < 1) return;
  try {
    localStorage.setItem(`video_pos_${videoId}`, JSON.stringify({ pos: Math.round(pos), ts: Date.now() }));
  } catch {}
}

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
    session_id?: number;
    last_position?: number;
  }) | null>(null);
  const [boot, setBoot] = useState<PlaybackBootstrap | null>(null);
  const [sessionVideosData, setSessionVideosData] = useState<{ items: StudentVideoListItem[] } | null>(null);

  const sessionId = video?.session_id ?? null;

  /* ─── 이어보기 위치 계산 ─── */
  const initialPosition = useMemo(() => {
    if (!videoId) return 0;
    const apiPos = video?.last_position ?? 0;
    const localPos = getStoredPosition(videoId);
    return Math.max(apiPos, localPos);
  }, [videoId, video?.last_position]);

  const progressMutation = useMutation({
    mutationFn: (data: { progress?: number; completed?: boolean; last_position?: number }) => {
      if (!videoId) throw new Error("videoId가 필요합니다.");
      return updateVideoProgress(videoId, data);
    },
    onSuccess: () => {
      if (sessionId == null) return;
      const key = ["student-session-videos", sessionId, enrollmentId ?? "public"] as const;
      setTimeout(() => queryClient.invalidateQueries({ queryKey: key }), 0);
    },
  });

  const progressMutationRef = useRef(progressMutation);
  progressMutationRef.current = progressMutation;

  /* ─── 다음 영상 ─── */
  const nextVideo = useMemo(() => {
    if (!sessionVideosData?.items?.length || !videoId) return null;
    const videos = sessionVideosData.items;
    const currentIndex = videos.findIndex((v) => v.id === videoId);
    if (currentIndex >= 0 && currentIndex < videos.length - 1) {
      return videos[currentIndex + 1];
    }
    return null;
  }, [sessionVideosData, videoId]);

  const currentIndex = useMemo(() => {
    if (!sessionVideosData?.items?.length || !videoId) return -1;
    return sessionVideosData.items.findIndex((v) => v.id === videoId);
  }, [sessionVideosData, videoId]);

  const onFatal = useCallback((reason: string) => setLoadError(reason), []);

  /* ─── 자동 다음 재생 ─── */
  const [autoPlayCountdown, setAutoPlayCountdown] = useState<number | null>(null);
  const autoPlayTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const nextVideoRef = useRef(nextVideo);
  nextVideoRef.current = nextVideo;

  const onLeaveProgress = useCallback(
    (data: { progress?: number; completed?: boolean; last_position?: number }) => {
      if (!videoId) return;
      progressMutationRef.current.mutate({
        progress: data.progress,
        last_position: data.last_position,
        completed: data.completed,
      });
      storePosition(videoId, data.last_position ?? 0);

      // 영상 완료 시 자동 다음 재생 시작 (nextVideoRef로 최신 값 참조)
      if (data.completed && nextVideoRef.current && !autoPlayTimerRef.current) {
        setAutoPlayCountdown(5);
        autoPlayTimerRef.current = setInterval(() => {
          setAutoPlayCountdown((prev) => {
            if (prev === null || prev <= 1) {
              if (autoPlayTimerRef.current) {
                clearInterval(autoPlayTimerRef.current);
                autoPlayTimerRef.current = null;
              }
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      }
    },
    [videoId]
  );

  /* ─── 재생 데이터 로드 ─── */
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

      try {
        localStorage.setItem("student_current_video_id", String(videoId));
      } catch {}

      try {
        const playbackData = await fetchStudentVideoPlayback(
          videoId,
          enrollmentId != null ? enrollmentId : undefined
        );

        if (!alive) return;

        const vd = playbackData?.video;
        if (!vd || typeof vd.id === "undefined") {
          setLoadError("재생 정보 형식이 올바르지 않습니다.");
          setLoading(false);
          return;
        }
        const v: VideoMetaLite & { session_id?: number; last_position?: number } = {
          id: Number(vd.id),
          title: String(vd.title ?? "영상"),
          duration: vd.duration == null ? null : Number(vd.duration),
          status: String(vd.status ?? ""),
          thumbnail_url: vd.thumbnail_url ?? null,
          hls_url: playbackData.hls_url ?? null,
          session_id: Number(vd.session_id),
          last_position: (vd as any).last_position ?? 0,
        };

        const playUrl = playbackData.play_url || playbackData.hls_url || playbackData.mp4_url || "";

        if (!playUrl) {
          const videoStatus = playbackData?.video?.status;
          const detail = (playbackData as { detail?: string })?.detail ?? "";
          if (detail) setLoadError(detail);
          else if (videoStatus && videoStatus !== "READY")
            setLoadError(`비디오가 아직 준비되지 않았습니다. (상태: ${videoStatus})`);
          else setLoadError("재생 URL을 가져올 수 없습니다.");
          setLoading(false);
          return;
        }

        const b: PlaybackBootstrap = {
          token: `student-${videoId}-${Date.now()}`,
          session_id: null,
          expires_at: null,
          access_mode: playbackData.policy?.access_mode || "FREE_REVIEW",
          monitoring_enabled: playbackData.policy?.monitoring_enabled ?? false,
          policy: playbackData.policy || {},
          play_url: playUrl,
        };

        startTransition(() => {
          setVideo(v);
          setBoot(b);
        });
        setLoading(false);
      } catch (e: any) {
        if (!alive) return;
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
    return () => { alive = false; };
  }, [videoId, enrollmentId]);

  useEffect(() => {
    return () => {
      try { localStorage.removeItem("student_current_video_id"); } catch {}
    };
  }, []);

  /* ─── 세션 영상 목록 로드 ─── */
  useEffect(() => {
    if (!sessionId || !videoId) {
      setSessionVideosData(null);
      return;
    }
    let cancelled = false;
    fetchStudentSessionVideos(sessionId, enrollmentId ?? undefined)
      .then((res) => { if (!cancelled) setSessionVideosData(res); })
      .catch(() => { if (!cancelled) setSessionVideosData(null); });
    return () => { cancelled = true; };
  }, [sessionId, enrollmentId ?? "public", videoId]);

  useEffect(() => {
    if (autoPlayCountdown !== null && autoPlayCountdown <= 0 && nextVideo) {
      nav(`/student/video/play?video=${nextVideo.id}${enrollmentId ? `&enrollment=${enrollmentId}` : ""}`);
    }
  }, [autoPlayCountdown, nextVideo, enrollmentId, nav]);

  useEffect(() => {
    return () => {
      if (autoPlayTimerRef.current) clearInterval(autoPlayTimerRef.current);
    };
  }, []);

  /* ─── Render ─── */
  const items = sessionVideosData?.items ?? [];
  const hasPlaylist = items.length > 1;
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="vpp-root">
      {loading ? (
        <div className="vpp-loading">
          <div className="vpp-loading-player">
            <div className="stu-skel stu-skel--media" />
          </div>
        </div>
      ) : loadError ? (
        <div className="vpp-error">
          <EmptyState title="재생을 시작할 수 없습니다" description={loadError} />
          <button type="button" className="vpp-back-btn" onClick={() => nav(-1)}>
            ← 뒤로가기
          </button>
        </div>
      ) : video && boot ? (
        <>
          {/* ─── 플레이어 ─── */}
          <div className="vpp-player-section">
            <StudentVideoPlayer
              video={video}
              bootstrap={boot}
              enrollmentId={enrollmentId != null ? Number(enrollmentId) : null}
              initialPosition={initialPosition}
              onFatal={onFatal}
              onLeaveProgress={onLeaveProgress}
            />
          </div>

          {/* ─── 영상 정보 ─── */}
          <div className="vpp-info">
            <h1 className="vpp-title">{video.title}</h1>
            <div className="vpp-info-row">
              <button type="button" className="vpp-back-link" onClick={() => nav(-1)}>
                ← 목록으로
              </button>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                {hasPlaylist && (
                  <button
                    type="button"
                    className="vpp-back-link"
                    onClick={() => setDrawerOpen((v) => !v)}
                  >
                    {drawerOpen ? "목록 닫기 ▼" : `재생목록 ▲ (${currentIndex + 1}/${items.length})`}
                  </button>
                )}
                {nextVideo && (
                  <Link
                    to={`/student/video/play?video=${nextVideo.id}${enrollmentId ? `&enrollment=${enrollmentId}` : ""}`}
                    className="vpp-next-link"
                  >
                    다음 강의 →
                  </Link>
                )}
              </div>
            </div>
          </div>

          {/* ─── 재생목록 드로어 ─── */}
          {hasPlaylist && (
            <div
              className="vpp-playlist"
              style={{
                maxHeight: drawerOpen ? 480 : 0,
                overflow: "hidden",
                transition: "max-height 0.3s ease",
                marginTop: drawerOpen ? "var(--stu-space-4)" : 0,
              }}
            >
              <div className="vpp-playlist-header">
                <span className="vpp-playlist-label">재생목록</span>
                <span className="vpp-playlist-count">
                  {currentIndex + 1} / {items.length}
                </span>
              </div>
              <div className="vpp-playlist-list">
                {items.map((v, i) => {
                  const isActive = v.id === videoId;
                  const progress = v.progress ?? 0;
                  const dur = v.duration ?? 0;
                  return (
                    <Link
                      key={v.id}
                      to={`/student/video/play?video=${v.id}${enrollmentId ? `&enrollment=${enrollmentId}` : ""}`}
                      className={`vpp-pl-item${isActive ? " vpp-pl-item--active" : ""}${v.completed ? " vpp-pl-item--done" : ""}`}
                    >
                      <span className="vpp-pl-num">{isActive ? "▶" : i + 1}</span>
                      <div className="vpp-pl-thumb">
                        {v.thumbnail_url ? (
                          <img className="vpp-pl-thumb-img" src={v.thumbnail_url} alt="" loading="lazy" />
                        ) : (
                          <div className="vpp-pl-thumb-placeholder" />
                        )}
                        {dur > 0 && (
                          <span className="vpp-pl-dur">{formatClock(dur)}</span>
                        )}
                        {progress > 0 && (
                          <div className="vpp-pl-progress">
                            <div
                              className="vpp-pl-progress-bar"
                              style={{ width: `${Math.min(100, progress)}%` }}
                            />
                          </div>
                        )}
                      </div>
                      <div className="vpp-pl-info">
                        <div className="vpp-pl-item-title">{v.title}</div>
                        {v.completed && <span className="vpp-pl-badge-done">완료</span>}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </>
      ) : (
        <EmptyState title="데이터가 없습니다" description="다시 시도해주세요." />
      )}
    </div>
  );
}
