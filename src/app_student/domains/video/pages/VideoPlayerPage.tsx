// PATH: src/app_student/domains/video/pages/VideoPlayerPage.tsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";

import EmptyState from "../../../layout/EmptyState";
import { fetchStudentVideoPlayback, fetchStudentSessionVideos, updateVideoProgress, toggleVideoLike } from "../api/video.api";
import type { StudentVideoListItem } from "../api/video.api";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { resolveTenantCodeString } from "@/shared/tenant";

import StudentVideoPlayer, {
  PlaybackBootstrap,
  VideoMetaLite,
} from "../playback/player/StudentVideoPlayer";
import { safeParseInt, formatClock } from "../playback/player/design/utils";
import { timeAgo, formatViewCount } from "../utils/timeAgo";
import VideoCommentSection from "../components/VideoCommentSection";
import { IconChevronRight } from "@student/shared/ui/icons/Icons";

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

/* ─── 좋아요 버튼 ─── */
function LikeButton({ videoId, initialLiked, initialCount }: { videoId: number; initialLiked: boolean; initialCount: number }) {
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const likedRef = useRef(liked);
  likedRef.current = liked;

  useEffect(() => {
    setLiked(initialLiked);
    setCount(initialCount);
  }, [initialLiked, initialCount]);

  const mutation = useMutation({
    mutationFn: () => toggleVideoLike(videoId),
    onMutate: () => {
      const wasLiked = likedRef.current;
      setLiked((prev) => !prev);
      setCount((prev) => wasLiked ? Math.max(0, prev - 1) : prev + 1);
    },
    onError: () => {
      setLiked(initialLiked);
      setCount(initialCount);
    },
  });

  return (
    <button
      type="button"
      onClick={() => mutation.mutate()}
      disabled={mutation.isPending}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "5px 12px",
        borderRadius: 20,
        background: liked ? "rgba(239,68,68,0.1)" : "var(--stu-surface-soft)",
        border: `1px solid ${liked ? "rgba(239,68,68,0.3)" : "var(--stu-border)"}`,
        color: liked ? "#ef4444" : "var(--stu-text-muted)",
        cursor: "pointer",
        fontSize: 13,
        fontWeight: 600,
        transition: "all 0.2s",
      }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill={liked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
      {count > 0 ? count : "좋아요"}
    </button>
  );
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
  const currentVideoStorageKey = `student_current_video_id:${resolveTenantCodeString()}`;

  /* ─── Playback 데이터 (React Query) ─── */
  const playbackQuery = useQuery({
    queryKey: ["student-video-playback", videoId, enrollmentId],
    queryFn: () => fetchStudentVideoPlayback(videoId!, enrollmentId ?? undefined),
    enabled: !!videoId,
    staleTime: 60_000,
    retry: 1,
  });

  // localStorage에 현재 videoId 저장 (side effect)
  useEffect(() => {
    if (videoId) {
      try { localStorage.setItem(currentVideoStorageKey, String(videoId)); } catch {}
    }
  }, [videoId, currentVideoStorageKey]);

  // playbackData → video, boot, loadError 파생
  const { video, boot, loadError } = useMemo(() => {
    if (!playbackQuery.data) {
      if (playbackQuery.error) {
        const e = playbackQuery.error as any;
        const msg =
          e?.response?.data?.detail ||
          e?.response?.data?.message ||
          e?.message ||
          "재생 페이지 로드에 실패했습니다.";
        return { video: null, boot: null, loadError: String(msg) };
      }
      if (!videoId) {
        return { video: null, boot: null, loadError: "잘못된 주소입니다." };
      }
      return { video: null, boot: null, loadError: null };
    }

    const playbackData = playbackQuery.data;
    const vd = playbackData?.video;
    if (!vd || typeof vd.id === "undefined") {
      return { video: null, boot: null, loadError: "재생 정보 형식이 올바르지 않습니다." };
    }

    const v: VideoMetaLite & { session_id?: number; last_position?: number; view_count?: number; like_count?: number; comment_count?: number; is_liked?: boolean; created_at?: string | null } = {
      id: Number(vd.id),
      title: String(vd.title ?? "영상"),
      duration: vd.duration == null ? null : Number(vd.duration),
      status: String(vd.status ?? ""),
      thumbnail_url: vd.thumbnail_url ?? null,
      hls_url: playbackData.hls_url ?? null,
      session_id: Number(vd.session_id),
      last_position: (vd as any).last_position ?? 0,
      view_count: (vd as any).view_count ?? 0,
      like_count: (vd as any).like_count ?? 0,
      comment_count: (vd as any).comment_count ?? 0,
      is_liked: !!(vd as any).is_liked,
      created_at: (vd as any).created_at ?? null,
    };

    const playUrl = playbackData.play_url || playbackData.hls_url || playbackData.mp4_url || "";

    if (!playUrl) {
      const videoStatus = playbackData?.video?.status;
      const detail = (playbackData as { detail?: string })?.detail ?? "";
      if (detail) return { video: null, boot: null, loadError: detail };
      if (videoStatus && videoStatus !== "READY")
        return { video: null, boot: null, loadError: "영상이 아직 준비 중입니다. 잠시 후 다시 시도해 주세요." };
      return { video: null, boot: null, loadError: "재생 URL을 가져올 수 없습니다." };
    }

    const b: PlaybackBootstrap = {
      token: `student-${videoId}-${Date.now()}`,
      session_id: null,
      expires_at: null,
      access_mode: (playbackData.policy?.access_mode || "FREE_REVIEW") as "FREE_REVIEW" | "PROCTORED_CLASS",
      monitoring_enabled: (playbackData.policy as any)?.monitoring_enabled ?? false,
      policy: playbackData.policy || {},
      play_url: playUrl,
    };

    return { video: v, boot: b, loadError: null };
  }, [playbackQuery.data, playbackQuery.error, videoId]);

  const loading = playbackQuery.isLoading;
  const urlSessionId = safeParseInt(q.get("session"));
  const sessionId = video?.session_id ?? urlSessionId ?? null;

  /* ─── 세션 영상 목록 (React Query, dependent) ─── */
  const sessionVideosQuery = useQuery({
    queryKey: ["student-session-videos", sessionId, enrollmentId ?? null],
    queryFn: () => fetchStudentSessionVideos(sessionId!, enrollmentId ?? undefined),
    enabled: !!sessionId && !!videoId,
    staleTime: 60_000,
    retry: 1,
  });
  const sessionVideosData = sessionVideosQuery.data ?? null;

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
      const key = ["student-session-videos", sessionId, enrollmentId ?? null] as const;
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

  // Defer comments to reduce bandwidth contention during player initialization
  const [showComments, setShowComments] = useState(false);
  useEffect(() => {
    setShowComments(false);
    const t = setTimeout(() => setShowComments(true), 2000);
    return () => clearTimeout(t);
  }, [videoId]);

  const [fatalError, setFatalError] = useState<string | null>(null);
  const onFatal = useCallback((reason: string) => setFatalError(reason), []);

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

  // Reset state when videoId changes
  useEffect(() => {
    setFatalError(null);
    // 자동재생 카운트다운 초기화 — 다른 영상으로 수동 이동 시 이전 타이머 방지
    setAutoPlayCountdown(null);
    if (autoPlayTimerRef.current) {
      clearInterval(autoPlayTimerRef.current);
      autoPlayTimerRef.current = null;
    }
  }, [videoId]);

  useEffect(() => {
    return () => {
      try { localStorage.removeItem(currentVideoStorageKey); } catch {}
    };
  }, [currentVideoStorageKey]);

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
  const [drawerOpen, setDrawerOpen] = useState(true);

  return (
    <div className="vpp-root">
      {loading ? (
        <div className="vpp-loading">
          <div className="vpp-loading-player">
            <div className="stu-skel stu-skel--media" />
          </div>
        </div>
      ) : (loadError || fatalError) ? (
        <div className="vpp-error">
          <EmptyState
            title="영상을 재생할 수 없어요"
            description={fatalError || loadError || "네트워크 연결을 확인하고 다시 시도해 주세요."}
            onRetry={() => window.location.reload()}
          />
          <button type="button" className="vpp-back-btn" onClick={() => nav(-1)} aria-label="뒤로가기">
            <IconChevronRight style={{ width: 16, height: 16, transform: "rotate(180deg)" }} aria-hidden="true" />
            <span>뒤로가기</span>
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
            {/* 메타: 조회수 · 업로드 시간 · 길이 */}
            <div className="vpp-meta-row">
              <span className="vpp-meta-item">{formatViewCount(video.view_count)}</span>
              {video.created_at && (
                <span className="vpp-meta-item">{timeAgo(video.created_at)}</span>
              )}
              {video.duration != null && video.duration > 0 && (
                <span className="vpp-meta-item">{formatClock(video.duration)}</span>
              )}
            </div>

            {/* 액션: 좋아요 · 목록 · 다음 */}
            <div className="vpp-info-row">
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <button type="button" className="vpp-back-link" onClick={() => nav(-1)} aria-label="목록으로">
                  <IconChevronRight style={{ width: 14, height: 14, transform: "rotate(180deg)" }} aria-hidden="true" />
                  <span>목록으로</span>
                </button>
                <LikeButton videoId={videoId!} initialLiked={video.is_liked ?? false} initialCount={video.like_count ?? 0} />
              </div>
              <div className="vpp-info-actions">
                {hasPlaylist && (
                  <button
                    type="button"
                    className="vpp-back-link"
                    onClick={() => setDrawerOpen((v) => !v)}
                    aria-expanded={drawerOpen}
                    aria-label={drawerOpen ? "재생목록 닫기" : "재생목록 열기"}
                  >
                    <IconChevronRight
                      style={{
                        width: 14,
                        height: 14,
                        transform: drawerOpen ? "rotate(-90deg)" : "rotate(90deg)",
                        transition: "transform var(--stu-motion-fast)",
                      }}
                      aria-hidden="true"
                    />
                    <span>
                      {drawerOpen ? "목록 닫기" : `재생목록 (${currentIndex + 1}/${items.length})`}
                    </span>
                  </button>
                )}
                {nextVideo && autoPlayCountdown != null && autoPlayCountdown > 0 && (
                  <button
                    type="button"
                    className="vpp-next-link"
                    onClick={() => {
                      setAutoPlayCountdown(null);
                      if (autoPlayTimerRef.current) { clearInterval(autoPlayTimerRef.current); autoPlayTimerRef.current = null; }
                    }}
                    style={{ fontWeight: 600 }}
                  >
                    다음 영상 {autoPlayCountdown}초 (취소)
                  </button>
                )}
                {nextVideo && (autoPlayCountdown === null || autoPlayCountdown <= 0) && (
                  <Link
                    to={`/student/video/play?video=${nextVideo.id}${enrollmentId ? `&enrollment=${enrollmentId}` : ""}`}
                    className="vpp-next-link"
                    aria-label="다음 영상"
                  >
                    <span>다음</span>
                    <IconChevronRight style={{ width: 14, height: 14 }} aria-hidden="true" />
                  </Link>
                )}
              </div>
            </div>
          </div>

          {/* ─── 댓글 섹션 (플레이어 로드 후 지연 렌더링) ─── */}
          {videoId && showComments && <VideoCommentSection videoId={videoId} />}

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
        <EmptyState title="영상 정보를 불러올 수 없어요." description="뒤로 가서 다시 시도해 주세요." />
      )}
    </div>
  );
}
